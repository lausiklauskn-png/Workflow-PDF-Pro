//! Ersatz für Android-SharedPreferences: eine JSON-Datei je Namensraum, atomar ersetzt.

use crate::error::Result;
use crate::fsutil::write_atomic;
use serde_json::{Map, Value};
use std::path::{Path, PathBuf};

pub struct Prefs {
    path: PathBuf,
    values: Map<String, Value>,
}

impl Prefs {
    pub fn open(dir: &Path, namespace: &str) -> Result<Self> {
        let path = dir.join(format!("{namespace}.json"));
        let values = match std::fs::read(&path) {
            Ok(bytes) => match serde_json::from_slice::<Value>(&bytes)? {
                Value::Object(map) => map,
                _ => return Err(crate::Error::Json),
            },
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Map::new(),
            Err(error) => return Err(error.into()),
        };
        Ok(Self { path, values })
    }
    pub fn contains(&self, key: &str) -> bool {
        self.values.contains_key(key)
    }
    pub fn string(&self, key: &str) -> Option<String> {
        self.values.get(key).and_then(|v| v.as_str()).map(str::to_owned)
    }
    pub fn long(&self, key: &str) -> i64 {
        self.values.get(key).and_then(|v| v.as_i64()).unwrap_or(0)
    }
    pub fn strings(&self, key: &str) -> Vec<String> {
        self.values.get(key).and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_owned)).collect()).unwrap_or_default()
    }
    /// Änderungen gemeinsam übernehmen; erst nach erfolgreichem Schreiben sichtbar.
    pub fn commit(&mut self, change: impl FnOnce(&mut Map<String, Value>)) -> Result<()> {
        let mut next = self.values.clone();
        change(&mut next);
        write_atomic(&self.path, &serde_json::to_vec(&Value::Object(next.clone()))?)?;
        self.values = next;
        Ok(())
    }
    pub fn values(&self) -> &Map<String, Value> {
        &self.values
    }
    pub fn remove_file(&mut self) -> Result<()> {
        match std::fs::remove_file(&self.path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
        self.values.clear();
        Ok(())
    }
}
