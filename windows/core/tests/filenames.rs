//! Dateinamen am echten Dateisystem: lange Unicode-Namen behalten ihre Endung und bleiben unter den Grenzen
//! von Windows (UTF-16-Einheiten) und ext4/FAT (UTF-8-Bytes). Befund aus Klaus' Sichttest (Workflow-PDF-Pro #20,
//! hier neu gebaut, 2026-10-26).
use base64::Engine;
use std::fs;
use wfp_core::{fsutil, transfers::Transfers};

#[test]
fn lange_unicode_namen_behalten_die_endung_und_passen_als_echte_datei() {
    let root = std::env::temp_dir().join(format!("wfp-namen-{}", uuid::Uuid::new_v4()));
    let mut transfers = Transfers::new(&root);
    let bytes = b"%PDF-1.4 Unicode-Name";
    for stamm in ["a".repeat(220), "Ж".repeat(170), "😀".repeat(150), "e\u{301}".repeat(170), "Grüße ".repeat(50)] {
        let name = format!("{stamm}.pdf");
        let sicher = fsutil::filename(Some(&name));
        assert!(sicher.ends_with(".pdf"), "Endung verloren: {sicher}");
        assert!(sicher.encode_utf16().count() <= 180, "UTF-16-Grenze: {}", sicher.encode_utf16().count());
        assert!(sicher.len() <= 240, "UTF-8-Grenze: {}", sicher.len());
        assert!(sicher.len() > 4, "Stamm darf nicht leer werden: {sicher}");
        let ticket = transfers.begin(Some(&name), Some("application/pdf")).unwrap();
        transfers.append(Some(&ticket), Some(&serde_json::json!(0)), &base64::engine::general_purpose::STANDARD.encode(bytes)).unwrap();
        transfers.finish(Some(&ticket), Some(&serde_json::json!(bytes.len()))).unwrap();
        let fertig = transfers.finished(Some(&ticket)).unwrap();
        assert_eq!(fs::read(&fertig.file).unwrap(), bytes, "Datei muss unter dem gekürzten Namen wirklich liegen");
        assert_eq!(fertig.name, sicher);
        transfers.abort(Some(&ticket));
    }
    // NFC: zerlegtes é wird ein Zeichen; kurze Namen bleiben sonst unverändert.
    assert_eq!(fsutil::filename(Some("Cafe\u{301}.pdf")), "Café.pdf");
    assert_eq!(fsutil::filename(Some("Rechnung 2026.pdf")), "Rechnung 2026.pdf");
    // Nur ein Stamm ohne Endung: wird gekürzt, nichts angehängt.
    let ohne = fsutil::filename(Some(&"x".repeat(300)));
    assert_eq!(ohne.len(), 180);
    // Eine „Endung" mit Leerzeichen ist keine.
    assert!(!fsutil::filename(Some(&format!("{}.mit leer", "y".repeat(300)))).ends_with(".mit leer"));
    fs::remove_dir_all(root).unwrap();
}
