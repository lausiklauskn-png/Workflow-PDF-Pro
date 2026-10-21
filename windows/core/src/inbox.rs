//! Empfangene Dateien ("Öffnen mit", Ziehen auf das App-Symbol) wie IncomingInbox.java:
//! app-privater, dauerhafter Eingang, getrennt von der Bibliothek. Ganze Sendungen
//! werden vor der Anzeige kopiert; nur ausdrückliches Verwerfen löscht Kopien.

use crate::error::{Error, Result};
use crate::fsutil::{filename, mime_for, write_atomic};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

pub const CHUNK: usize = 262144;
const MAX_FILE: u64 = 2 * 1024 * 1024 * 1024;

pub struct Inbox {
    root: PathBuf,
    entries: Vec<Value>,
    input: Option<File>,
    reading: Option<String>,
    offset: u64,
    done: bool,
}

fn fail() -> Error {
    Error::code("INCOMING_INVALID_TRANSFER")
}

fn now_ms() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

fn valid_id(id: &str) -> bool {
    uuid::Uuid::parse_str(id).map(|u| u.hyphenated().to_string() == id).unwrap_or(false)
}

impl Inbox {
    pub fn open(dir: &Path) -> Result<Self> {
        let root = dir.join("incoming-v1");
        fs::create_dir_all(&root).map_err(|_| Error::code("INCOMING_STORAGE_UNAVAILABLE"))?;
        let mut entries = Vec::new();
        for item in fs::read_dir(&root)? {
            let item = item?;
            let Ok(name) = item.file_name().into_string() else { continue };
            if !valid_id(&name) || !item.file_type()?.is_dir() {
                continue;
            }
            let parsed = fs::read(item.path().join("receipt.json")).ok().and_then(|b| serde_json::from_slice::<Value>(&b).ok()).filter(|e| e["id"].as_str() == Some(name.as_str()));
            entries.push(parsed.unwrap_or_else(|| {
                // Unbekannte oder beschädigte Bytes bleiben; ausdrückliches Verwerfen nötig.
                let at = item.metadata().and_then(|m| m.modified()).ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_millis() as i64).unwrap_or(0);
                json!({"id": name, "at": at, "problem": true, "ready": false})
            }));
        }
        entries.sort_by_key(|e| e["at"].as_i64().unwrap_or(0));
        Ok(Self { root, entries, input: None, reading: None, offset: 0, done: false })
    }

    fn dir(&self, id: &str) -> Result<PathBuf> {
        if !valid_id(id) {
            return Err(fail());
        }
        Ok(self.root.join(id))
    }

    fn save(&self, entry: &Value) -> Result<()> {
        let dir = self.dir(entry["id"].as_str().unwrap_or_default())?;
        fs::create_dir_all(&dir)?;
        write_atomic(&dir.join("receipt.json"), &serde_json::to_vec(entry)?)
    }

    /// Eine Sendung sofort vollständig in den privaten Eingang kopieren.
    /// Windows-Pfade können verschwinden (USB, Download-Ordner) – deshalb gleich kopieren.
    pub fn add(&mut self, paths: &[PathBuf]) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        let dir = self.root.join(&id);
        fs::create_dir_all(&dir)?;
        let mut entry = json!({"id": id, "at": now_ms(), "ready": false});
        let staged = (|| -> Result<Vec<Value>> {
            if paths.is_empty() {
                return Err(Error::code("INCOMING_EMPTY"));
            }
            let mut files = Vec::new();
            for path in paths {
                let meta = fs::metadata(path)?;
                if !meta.is_file() || meta.len() > MAX_FILE {
                    return Err(Error::code("INCOMING_INVALID"));
                }
                let file_id = uuid::Uuid::new_v4().to_string();
                let target = dir.join(format!("{file_id}.bin"));
                let mut input = File::open(path)?;
                let mut out = File::create(&target)?;
                let mut digest = Sha256::new();
                let mut size = 0u64;
                let mut block = vec![0u8; 65536];
                loop {
                    let n = input.read(&mut block)?;
                    if n == 0 {
                        break;
                    }
                    std::io::Write::write_all(&mut out, &block[..n])?;
                    digest.update(&block[..n]);
                    size += n as u64;
                }
                out.sync_all()?;
                let name = filename(path.file_name().and_then(|n| n.to_str()));
                files.push(json!({"id": file_id, "name": name, "mime": mime_for(&name), "size": size, "sha256": crate::crypto::hex(&digest.finalize())}));
            }
            Ok(files)
        })();
        match staged {
            Ok(files) => {
                entry["files"] = json!(files);
                entry["ready"] = json!(true);
            }
            Err(_) => entry["problem"] = json!(true),
        }
        self.save(&entry)?;
        self.entries.push(entry);
        Ok(id)
    }

    fn first(&self) -> Option<usize> {
        self.entries.iter().position(|e| !e["archived"].as_bool().unwrap_or(false))
    }

    fn rewind(&mut self) {
        self.input = None;
        self.reading = None;
        self.offset = 0;
        self.done = false;
    }

    pub fn pending(&mut self) -> Value {
        self.rewind();
        let Some(i) = self.first() else { return json!({"empty": true}) };
        let entry = &self.entries[i];
        if entry["ready"].as_bool() == Some(true) && entry["files"].is_array() {
            json!({"id": entry["id"], "files": entry["files"]})
        } else {
            json!({"id": entry["id"], "problem": true})
        }
    }

    pub fn read(&mut self, batch: &str, id: &str, requested: u64) -> Result<(Vec<u8>, bool)> {
        let i = self.first().ok_or_else(fail)?;
        let entry = self.entries[i].clone();
        if entry["id"].as_str() != Some(batch) || entry["ready"].as_bool() != Some(true) {
            return Err(fail());
        }
        let item = entry["files"].as_array().and_then(|f| f.iter().find(|f| f["id"].as_str() == Some(id))).cloned().ok_or_else(fail)?;
        let ticket = format!("{batch}:{id}");
        if self.reading.as_deref() != Some(ticket.as_str()) {
            if requested != 0 || (self.reading.is_some() && !self.done) {
                return Err(fail());
            }
            self.rewind();
            if !valid_id(id) {
                return Err(fail());
            }
            let path = self.dir(batch)?.join(format!("{id}.bin"));
            if fs::metadata(&path)?.len() as i64 != item["size"].as_i64().unwrap_or(-1) {
                return Err(fail());
            }
            if crate::crypto::hex(&crate::transfers::hash_file(&path)?) != item["sha256"].as_str().unwrap_or_default() {
                return Err(fail());
            }
            self.input = Some(File::open(&path)?);
            self.reading = Some(ticket);
        }
        if self.done || requested != self.offset {
            return Err(fail());
        }
        let input = self.input.as_mut().ok_or_else(fail)?;
        let mut out = vec![0u8; CHUNK];
        let mut filled = 0;
        while filled < CHUNK {
            let n = input.read(&mut out[filled..])?;
            if n == 0 {
                self.input = None;
                self.done = true;
                break;
            }
            filled += n;
        }
        out.truncate(filled);
        self.offset += filled as u64;
        Ok((out, self.done))
    }

    pub fn done(&self) -> bool {
        self.done
    }

    pub fn acknowledge(&mut self, id: &str, discard: bool) -> Result<()> {
        let i = self.first().ok_or_else(fail)?;
        if self.entries[i]["id"].as_str() != Some(id) {
            return Err(fail());
        }
        self.rewind();
        if discard {
            return self.remove(i);
        }
        let mut archived = self.entries[i].clone();
        archived["archived"] = json!(true);
        self.save(&archived)?;
        self.entries[i] = archived;
        Ok(())
    }

    pub fn history(&self) -> Vec<Value> {
        self.entries.iter().filter(|e| e["archived"].as_bool() == Some(true)).map(|e| json!({"id": e["id"], "at": e["at"].as_i64().unwrap_or(0), "files": e.get("files").cloned().unwrap_or(Value::Null)})).collect()
    }

    pub fn restore(&mut self, id: &str) -> Result<()> {
        let i = self.entries.iter().position(|e| e["id"].as_str() == Some(id) && e["archived"].as_bool() == Some(true)).ok_or_else(|| Error::code("INCOMING_OPERATION_FAILED"))?;
        let mut entry = self.entries[i].clone();
        entry["archived"] = json!(false);
        self.save(&entry)?;
        self.entries[i] = entry;
        Ok(())
    }

    pub fn discard_archived(&mut self, id: &str) -> Result<()> {
        let i = self.entries.iter().position(|e| e["id"].as_str() == Some(id) && e["archived"].as_bool() == Some(true)).ok_or_else(|| Error::code("INCOMING_OPERATION_FAILED"))?;
        self.remove(i)
    }

    fn remove(&mut self, i: usize) -> Result<()> {
        let dir = self.dir(self.entries[i]["id"].as_str().unwrap_or_default())?;
        fs::remove_dir_all(&dir)?;
        self.entries.remove(i);
        Ok(())
    }
}
