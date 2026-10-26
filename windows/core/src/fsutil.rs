//! Kleine Dateihelfer: vollständig geschrieben, synchronisiert, dann sichtbar.

use crate::error::{Error, Result};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use unicode_normalization::UnicodeNormalization;

/// Atomar ersetzen: temporäre Datei schreiben, auf Platte bringen, umbenennen.
pub fn write_atomic(path: &Path, data: &[u8]) -> Result<()> {
    let dir = path.parent().ok_or_else(|| Error::code("VAULT_UNAVAILABLE"))?;
    fs::create_dir_all(dir)?;
    let tmp = dir.join(format!(".{}.{}.tmp", path.file_name().and_then(|n| n.to_str()).unwrap_or("datei"), uuid::Uuid::new_v4()));
    let result = (|| -> Result<()> {
        let mut file = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
        file.write_all(data)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&tmp, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

/// Neue Datei anlegen; vorhandene Dateien werden nie überschrieben.
pub fn create_new(path: &Path, data: &[u8]) -> Result<()> {
    let mut file = match OpenOptions::new().write(true).create_new(true).open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => return Err(Error::code("VAULT_FILE_EXISTS")),
        Err(error) => return Err(error.into()),
    };
    let result = file.write_all(data).and_then(|_| file.sync_all());
    if let Err(error) = result {
        drop(file);
        let _ = fs::remove_file(path);
        return Err(error.into());
    }
    Ok(())
}

pub fn read_limited(path: &Path, limit: u64) -> Result<Vec<u8>> {
    let file = File::open(path)?;
    let mut out = Vec::new();
    file.take(limit + 1).read_to_end(&mut out)?;
    if out.len() as u64 > limit {
        return Err(Error::code("VAULT_DAMAGED"));
    }
    Ok(out)
}

pub struct Entry {
    pub name: String,
    pub path: PathBuf,
    pub dir: bool,
}

/// Einträge eines Ordners; Verknüpfungen (Symlinks/Junctions) werden nicht verfolgt.
pub fn children(dir: &Path) -> Result<Vec<Entry>> {
    let mut out = Vec::new();
    for item in fs::read_dir(dir)? {
        let item = item?;
        let kind = item.file_type()?;
        if kind.is_symlink() {
            continue;
        }
        let name = match item.file_name().into_string() {
            Ok(name) => name,
            Err(_) => continue,
        };
        out.push(Entry { name, path: item.path(), dir: kind.is_dir() });
    }
    Ok(out)
}

/// Dateiname für Ablagen: Steuerzeichen und Pfadtrenner ersetzen (wie ProFilesPlugin.filename),
/// zusätzlich unter Windows unzulässige Zeichen und reservierte Namen.
pub fn filename(value: Option<&str>) -> String {
    let raw = value.unwrap_or("Dokument");
    // NFC (Klaus 2026-10-26): „Café" aus e + Akzent wird EIN Zeichen — sonst gelten zwei Schreibweisen desselben
    // Namens als zwei Dateien, und die Grenzen unten zählen falsch.
    let mut name: String = raw.nfc().map(|c| if c.is_control() || "/\\:*?\"<>|".contains(c) { '_' } else { c }).collect();
    name = name.trim().trim_end_matches(['.', ' ']).to_string();
    if name.is_empty() || name == "." || name == ".." {
        return "Dokument".into();
    }
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    const RESERVED: [&str; 22] = ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"];
    if RESERVED.contains(&stem.as_str()) {
        name.insert(0, '_');
    }
    // Grenzen: Windows zählt UTF-16-Einheiten (Pfadbudget), ext4/FAT zählen UTF-8-Bytes (255 je Name).
    // Beim Kürzen bleibt die Dateiendung — sonst verliert „Öffnen mit" den Typ (Klaus' Sichttest, 1.0.4).
    const MAX_UTF16: usize = 180;
    const MAX_BYTES: usize = 240;
    if name.encode_utf16().count() > MAX_UTF16 || name.len() > MAX_BYTES {
        let endung = name.rsplit_once('.').map(|(_, e)| e)
            .filter(|e| !e.is_empty() && e.len() <= 16 && e.is_ascii() && !e.contains(' '))
            .map(|e| format!(".{e}")).unwrap_or_default();
        let stamm = &name[..name.len() - endung.len()];
        let (mut einheiten, mut bytes) = (0usize, 0usize);
        let kurz: String = stamm.chars().take_while(|c| {
            einheiten += c.len_utf16();
            bytes += c.len_utf8();
            einheiten + endung.len() <= MAX_UTF16 && bytes + endung.len() <= MAX_BYTES
        }).collect();
        let kurz = kurz.trim_end_matches(['.', ' ']);
        name = if kurz.is_empty() { format!("Dokument{endung}") } else { format!("{kurz}{endung}") };
    }
    name
}

/// Ganzzahl aus JSON wie ProFilesPlugin.integer: endlich, nicht negativ, ganzzahlig, sicher.
pub fn integer(value: Option<&serde_json::Value>) -> Result<u64> {
    let number = value.and_then(|v| v.as_f64()).ok_or_else(|| Error::code("INVALID_NUMBER"))?;
    if !number.is_finite() || number < 0.0 || number != number.trunc() || number > 9007199254740991.0 {
        return Err(Error::code("INVALID_NUMBER"));
    }
    Ok(number as u64)
}

pub fn mime_for(name: &str) -> &'static str {
    let lower = name.to_ascii_lowercase();
    let ext = lower.rsplit('.').next().unwrap_or("");
    match ext {
        "pdf" => "application/pdf",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "tif" | "tiff" => "image/tiff",
        "heic" => "image/heic",
        "json" => "application/json",
        "txt" => "text/plain",
        "html" | "htm" => "text/html",
        "zip" => "application/zip",
        _ if lower.ends_with(".workfloh.json") => "application/json",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn names() {
        assert_eq!(filename(Some("a/b\\c:d?.pdf")), "a_b_c_d_.pdf");
        assert_eq!(filename(Some("  ")), "Dokument");
        assert_eq!(filename(Some("con.pdf")), "_con.pdf");
        assert_eq!(filename(None), "Dokument");
    }
}
