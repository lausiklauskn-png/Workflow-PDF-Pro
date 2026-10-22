//! Tresorprüfungen mit echtem Dateisystem (gleiches Verhalten wie DocumentVault.java).

use serde_json::json;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use wfp_core::locations::VaultLocations;
use wfp_core::vault::{DocumentVault, FOLDER, HEADER};
use wfp_core::{DeviceProtect, Result};
use zeroize::Zeroizing;

/// Testersatz für DPAPI: bindet an die Entropie, keine echte Gerätebindung.
struct Fake;
impl DeviceProtect for Fake {
    fn protect(&self, data: &[u8], entropy: &[u8]) -> Result<Vec<u8>> {
        let mut out = entropy.len().to_le_bytes().to_vec();
        out.extend_from_slice(entropy);
        out.extend(data.iter().map(|b| b ^ 0x5a));
        Ok(out)
    }
    fn unprotect(&self, data: &[u8], entropy: &[u8]) -> Result<Zeroizing<Vec<u8>>> {
        let n = usize::from_le_bytes(data[..8].try_into().unwrap());
        if &data[8..8 + n] != entropy {
            return Err(wfp_core::Error::code("VAULT_LOCKED"));
        }
        Ok(Zeroizing::new(data[8 + n..].iter().map(|b| b ^ 0x5a).collect()))
    }
}

fn temp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("wfp-test-{name}-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn put(vault: &mut DocumentVault, store: &str, id: &str, data: &[u8]) {
    let ticket = vault.begin(store, id, None).unwrap();
    let mut offset = 0;
    for part in data.chunks(262144) {
        vault.append(&ticket, offset, part).unwrap();
        offset += part.len() as u64;
    }
    vault.finish(&ticket, data.len() as u64).unwrap();
}

fn get(vault: &mut DocumentVault, store: &str, id: &str) -> Vec<u8> {
    let mut out = Vec::new();
    loop {
        let part = vault.read(store, id, out.len() as u64, None).unwrap();
        if part.is_empty() {
            return out;
        }
        out.extend(part);
    }
}

fn locations(app: &Path) -> VaultLocations {
    VaultLocations::new(&app.join("prefs"), &app.join("cache"), Arc::new(Fake)).unwrap()
}

#[test]
fn create_write_lock_reopen_and_reject() {
    let app = temp("app");
    let chosen = temp("ordner");
    std::fs::write(chosen.join("fremd.txt"), b"bleibt").unwrap();
    let mut locs = locations(&app);
    assert_eq!(locs.state(None).unwrap(), json!({"configured": false, "internal": true}));

    // Einrichten in einem nicht leeren Ordner legt den Unterordner "Workflow PDF Pro" an.
    let mut candidate = locs.candidate().unwrap();
    let place = candidate.inspect(&chosen).unwrap();
    assert!(!candidate.existing(&place).unwrap());
    assert_eq!(candidate.initialize(place.clone(), "kurz", false).unwrap_err().vault_code(), "VAULT_PASSWORD_SHORT");
    candidate.initialize(place, "richtig-langes-Passwort", true).unwrap();
    assert!(chosen.join(FOLDER).join(HEADER).is_file());
    assert_eq!(std::fs::read(chosen.join("fremd.txt")).unwrap(), b"bleibt");
    let location = locs.adopt(candidate).unwrap();
    locs.select(Some(&location)).unwrap();

    let big: Vec<u8> = (0..700_000u32).map(|i| (i % 253) as u8).collect();
    {
        let v = locs.get(None).unwrap();
        put(v, "files", "doc-1", &big);
        put(v, "docs", "doc-1", br#"{"name":"Antrag"}"#);
        put(v, "texte", "doc-1#1", b"Seite 1");
        assert_eq!(get(v, "files", "doc-1"), big);
        assert_eq!(v.list("docs").unwrap(), vec!["doc-1"]);
        assert_eq!(v.info("files", "doc-1").unwrap()["size"], json!(700_000));
        // Mehr als drei Generationen: alte Indexdateien werden aufgeräumt, Daten bleiben.
        for i in 0..5 {
            put(v, "settings", &format!("s{i}"), b"x");
        }
        assert_eq!(get(v, "files", "doc-1"), big);
    }
    let commits = std::fs::read_dir(chosen.join(FOLDER)).unwrap().filter(|e| e.as_ref().unwrap().file_name().to_string_lossy().starts_with("commit-")).count();
    assert_eq!(commits, 3);

    // Neustart mit gemerktem Schlüssel: ohne Passwort entsperrt.
    drop(locs);
    let mut locs = locations(&app);
    assert_eq!(locs.state(None).unwrap()["unlocked"], json!(true));
    assert_eq!(get(locs.get(None).unwrap(), "files", "doc-1"), big);

    // Sperren: danach gesperrt, falsches Passwort wird abgewiesen, richtiges öffnet.
    locs.lock().unwrap();
    drop(locs);
    let mut locs = locations(&app);
    let state = locs.state(None).unwrap();
    assert_eq!(state["unlocked"], json!(false));
    assert_eq!(state["problem"], json!("VAULT_LOCKED"));
    let v = locs.get(None).unwrap();
    assert_eq!(v.unlock("falsches-Passwort!!", false).unwrap_err().vault_code(), "VAULT_PASSWORD");
    v.unlock("richtig-langes-Passwort", false).unwrap();
    v.remove("texte", "doc-1", true).unwrap();
    assert!(v.list("texte").unwrap().is_empty());
    assert_eq!(get(v, "docs", "doc-1"), br#"{"name":"Antrag"}"#);

    // Gleichen Tresor von einer zweiten "Installation" aus öffnen (wie ein anderes Gerät).
    let other = temp("anderes-geraet");
    let mut locs2 = locations(&other);
    let mut candidate = locs2.candidate().unwrap();
    let place = candidate.inspect(&chosen).unwrap();
    assert!(candidate.existing(&place).unwrap());
    candidate.open(place, "richtig-langes-Passwort", false).unwrap();
    let id2 = locs2.adopt(candidate).unwrap();
    assert_eq!(get(locs2.get(Some(&id2)).unwrap(), "files", "doc-1"), big);
}

#[test]
fn unreachable_and_damaged_never_look_empty() {
    let app = temp("app2");
    let chosen = temp("usb");
    let mut locs = locations(&app);
    let mut candidate = locs.candidate().unwrap();
    let place = candidate.inspect(&chosen).unwrap();
    candidate.initialize(place, "richtig-langes-Passwort", true).unwrap();
    let id = locs.adopt(candidate).unwrap();
    locs.select(Some(&id)).unwrap();
    put(locs.get(None).unwrap(), "files", "a", b"Inhalt");
    let root = if chosen.join(HEADER).exists() { chosen.clone() } else { chosen.join(FOLDER) };

    // Laufwerk abgezogen: klarer Fehler, keine leere Bibliothek.
    let moved = chosen.with_extension("weg");
    std::fs::rename(&chosen, &moved).unwrap();
    drop(locs);
    let mut locs = locations(&app);
    let state = locs.state(None).unwrap();
    assert_eq!(state["unlocked"], json!(false));
    assert_eq!(state["problem"], json!("VAULT_FOLDER_UNAVAILABLE"));
    std::fs::rename(&moved, &chosen).unwrap();
    assert_eq!(locs.state(None).unwrap()["unlocked"], json!(true));

    // Neueste Indexdatei beschädigt: VAULT_DAMAGED statt stiller Rückfall.
    let mut newest: Vec<_> = std::fs::read_dir(&root).unwrap().map(|e| e.unwrap().file_name().into_string().unwrap()).filter(|n| n.starts_with("commit-")).collect();
    newest.sort();
    let marker: serde_json::Value = serde_json::from_slice(&std::fs::read(root.join(newest.last().unwrap())).unwrap()).unwrap();
    let index = root.join(marker["index"].as_str().unwrap());
    let mut bytes = std::fs::read(&index).unwrap();
    let last = bytes.len() - 1;
    bytes[last] ^= 1;
    std::fs::write(&index, bytes).unwrap();
    drop(locs);
    let mut locs = locations(&app);
    assert_eq!(locs.state(None).unwrap()["problem"], json!("VAULT_DAMAGED"));
}

#[test]
fn batch_abort_leaves_no_records() {
    let app = temp("app3");
    let chosen = temp("ordner3");
    let mut locs = locations(&app);
    let mut candidate = locs.candidate().unwrap();
    let place = candidate.inspect(&chosen).unwrap();
    candidate.initialize(place, "richtig-langes-Passwort", false).unwrap();
    let id = locs.adopt(candidate).unwrap();
    let v = locs.get(Some(&id)).unwrap();
    v.begin_batch().unwrap();
    put(v, "docs", "x", b"1");
    v.abort_batch();
    assert!(v.list("docs").unwrap().is_empty());
    let root = chosen.join(FOLDER);
    let records = std::fs::read_dir(if root.exists() { root } else { chosen.clone() }).unwrap().filter(|e| e.as_ref().unwrap().file_name().to_string_lossy().ends_with(".wpv")).count();
    assert_eq!(records, 1, "nur die Indexdatei der Einrichtung");
}

#[test]
fn spare_keys_restore_access_with_a_new_password() {
    let app = temp("app4");
    let chosen = temp("ordner4");
    let mut locs = locations(&app);
    let mut candidate = locs.candidate().unwrap();
    let place = candidate.inspect(&chosen).unwrap();
    candidate.initialize(place, "vergessenes-Passwort-1", false).unwrap();
    let id = locs.adopt(candidate).unwrap();
    locs.select(Some(&id)).unwrap();
    let v = locs.get(None).unwrap();
    put(v, "files", "doc", b"wichtiger Inhalt");
    assert_eq!(v.recovery_info().unwrap()["exists"], json!(false));
    let first = v.create_recovery(5, 3).unwrap();
    let shares = v.create_recovery(5, 3).unwrap();
    assert_eq!(shares.len(), 5);
    assert_ne!(first, shares, "neuer Satz");
    assert_eq!(v.recovery_info().unwrap()["k"], json!(3));
    let root = chosen.join(FOLDER);
    let sets = std::fs::read_dir(&root).unwrap().filter(|e| e.as_ref().unwrap().file_name().to_string_lossy().starts_with("workflow-pdf-pro.ersatz-")).count();
    assert_eq!(sets, 1, "alter Satz entfernt");

    // Anderes Gerät, Passwort vergessen: zwei Teile reichen nicht, alte Teile gelten nicht.
    let other = temp("geraet4");
    let mut locs2 = locations(&other);
    let mut c = locs2.candidate().unwrap();
    let p = c.inspect(&chosen).unwrap();
    assert_eq!(c.recover(p.clone(), &shares[..2], "neues-Passwort-2026", false).unwrap_err().vault_code(), "VAULT_RECOVERY_INCOMPLETE");
    assert_eq!(c.recover(p.clone(), &first[..3], "neues-Passwort-2026", false).unwrap_err().vault_code(), "VAULT_RECOVERY_UNKNOWN");
    assert_eq!(c.recover(p.clone(), &[shares[4].clone(), shares[1].clone(), shares[2].clone()], "kurz", false).unwrap_err().vault_code(), "VAULT_PASSWORD_SHORT");
    c.recover(p.clone(), &[shares[4].clone(), shares[1].clone(), shares[2].clone()], "neues-Passwort-2026", false).unwrap();
    let id2 = locs2.adopt(c).unwrap();
    assert_eq!(get(locs2.get(Some(&id2)).unwrap(), "files", "doc"), b"wichtiger Inhalt");

    // Danach öffnet das neue Passwort, das alte bleibt gültig, ein falsches nicht.
    let third = temp("geraet5");
    let locs3 = locations(&third);
    for (pw, ok) in [("neues-Passwort-2026", true), ("vergessenes-Passwort-1", true), ("ganz-falsches-Passwort", false)] {
        let mut c = locs3.candidate().unwrap();
        let p = c.inspect(&chosen).unwrap();
        assert_eq!(c.open(p, pw, false).is_ok(), ok, "{pw}");
    }
}

#[test]
fn foreign_unicode_marker_name_cannot_crash_vault_reopening() {
    let app = temp("unicode-marker");
    let chosen = temp("unicode-folder");
    let mut locs = locations(&app);
    let mut c = locs.candidate().unwrap();
    let p = c.inspect(&chosen).unwrap();
    c.initialize(p, "richtig-langes-Passwort", false).unwrap();
    let root = c.inspect(&chosen).unwrap().root;
    let id = locs.adopt(c).unwrap();
    let v = locs.get(Some(&id)).unwrap();
    put(v, "files", "doc", b"Original bleibt erhalten");
    // 69 UTF-8-Bytes wie ein Commitname; U+00E9 überquert die bisherige Slice-Grenze.
    let foreign_names = [
        format!("commit-{}é{}.json", "0".repeat(19), "a".repeat(36)),
        format!("commit-{}é{}.json", "0".repeat(20), "a".repeat(35)),
    ];
    for foreign in &foreign_names {
        assert_eq!(foreign.len(), 69);
        std::fs::write(root.join(foreign), b"fremde Datei").unwrap();
    }
    v.lock().unwrap();
    v.unlock("richtig-langes-Passwort", false).unwrap();
    assert_eq!(get(v, "files", "doc"), b"Original bleibt erhalten");
    for foreign in foreign_names {
        assert_eq!(std::fs::read(root.join(foreign)).unwrap(), b"fremde Datei");
    }
}
