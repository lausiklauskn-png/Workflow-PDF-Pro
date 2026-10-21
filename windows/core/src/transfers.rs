//! Übergaben für Speichern/Teilen/Drucken (wie ProFilesPlugin): nur von der App
//! erzeugte Tickets. Die Webseite liefert nie einen Dateipfad.

use crate::error::{Error, Result};
use crate::fsutil::{filename, integer};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub const CHUNK: usize = 262144;

pub struct Transfer {
    pub file: PathBuf,
    pub name: String,
    pub mime: String,
    pub size: u64,
    pub finished: bool,
}

pub struct Transfers {
    dir: PathBuf,
    items: HashMap<String, Transfer>,
}

fn fail() -> Error {
    Error::code("FILE_OPERATION_FAILED")
}

fn valid_mime(mime: &str) -> bool {
    let mut parts = mime.split('/');
    let ok = |s: &str| !s.is_empty() && s.bytes().all(|b| b.is_ascii_alphanumeric() || b".+-".contains(&b));
    matches!((parts.next(), parts.next(), parts.next()), (Some(a), Some(b), None) if ok(a) && ok(b))
}

impl Transfers {
    pub fn new(cache: &Path) -> Self {
        let dir = cache.join("workflow-exports");
        // Reste früherer Läufe (abgebrochen oder geteilt) beim Start entfernen.
        let _ = fs::remove_dir_all(&dir);
        Self { dir, items: HashMap::new() }
    }

    pub fn begin(&mut self, name: Option<&str>, mime: Option<&str>) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        let place = self.dir.join(&id);
        fs::create_dir_all(&place).map_err(|_| fail())?;
        let name = filename(name);
        let mime = mime.filter(|m| valid_mime(m)).unwrap_or("application/octet-stream").to_owned();
        let file = place.join(&name);
        OpenOptions::new().write(true).create_new(true).open(&file).map_err(|_| fail())?;
        self.items.insert(id.clone(), Transfer { file, name, mime, size: 0, finished: false });
        Ok(id)
    }

    fn get(&mut self, id: Option<&str>, finished: bool) -> Result<&mut Transfer> {
        match self.items.get_mut(id.unwrap_or_default()) {
            Some(t) if t.finished == finished => Ok(t),
            _ => Err(fail()),
        }
    }

    pub fn append(&mut self, id: Option<&str>, offset: Option<&Value>, data: &str) -> Result<u64> {
        let t = self.get(id, false)?;
        let offset = integer(offset)?;
        if offset != t.size || data.len() > (CHUNK + 2) / 3 * 4 {
            return Err(fail());
        }
        let bytes = B64.decode(data).map_err(|_| fail())?;
        if bytes.len() > CHUNK {
            return Err(fail());
        }
        let mut out = OpenOptions::new().append(true).open(&t.file).map_err(|_| fail())?;
        out.write_all(&bytes).and_then(|_| out.sync_all()).map_err(|_| fail())?;
        t.size += bytes.len() as u64;
        Ok(t.size)
    }

    pub fn finish(&mut self, id: Option<&str>, size: Option<&Value>) -> Result<u64> {
        let t = self.get(id, false)?;
        let size = integer(size)?;
        if size != t.size || fs::metadata(&t.file).map_err(|_| fail())?.len() != size {
            return Err(fail());
        }
        t.finished = true;
        Ok(t.size)
    }

    pub fn abort(&mut self, id: Option<&str>) {
        if let Some(t) = self.items.remove(id.unwrap_or_default()) {
            let _ = fs::remove_file(&t.file);
            if let Some(parent) = t.file.parent() {
                let _ = fs::remove_dir(parent);
            }
        }
    }

    pub fn finished(&mut self, id: Option<&str>) -> Result<&Transfer> {
        self.get(id, true).map(|t| &*t)
    }
}

pub fn hash_file(path: &Path) -> Result<Vec<u8>> {
    let mut file = File::open(path)?;
    let mut digest = Sha256::new();
    let mut buffer = vec![0u8; CHUNK];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        digest.update(&buffer[..n]);
    }
    Ok(digest.finalize().to_vec())
}

/// In das gewählte Ziel kopieren und danach Byte für Byte über die Prüfsumme bestätigen.
pub fn copy_verified(source: &Path, target: &Path) -> Result<()> {
    let tmp = target.with_file_name(format!(".{}.wfp-tmp", uuid::Uuid::new_v4()));
    let result = (|| -> Result<()> {
        let mut input = File::open(source)?;
        let mut out = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
        std::io::copy(&mut input, &mut out)?;
        out.sync_all()?;
        drop(out);
        if hash_file(source)? != hash_file(&tmp)? {
            return Err(Error::code("FILE_SAVE_FAILED"));
        }
        // Ersetzt eine bestehende Datei nur, wenn der Nutzer sie im Dialog bestätigt hat.
        fs::rename(&tmp, target)?;
        if hash_file(source)? != hash_file(target)? {
            return Err(Error::code("FILE_SAVE_FAILED"));
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}
