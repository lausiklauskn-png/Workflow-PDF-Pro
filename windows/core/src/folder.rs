//! Ordner einlesen (wie FolderImport.java): ein vom Nutzer gewählter Ordner,
//! nur lesend. Die Webseite bekommt Tickets, keine Pfade.

use crate::error::{Error, Result};
use crate::fsutil::{children, filename, mime_for};
use serde_json::{json, Value};
use std::collections::{HashSet, VecDeque};
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

pub const CHUNK: usize = 262144;
const MAX_FILES: usize = 20000;

struct Item {
    path: PathBuf,
    input: Option<File>,
    offset: u64,
    done: bool,
}

#[derive(Default)]
pub struct FolderImport {
    items: Vec<(String, Item)>,
}

impl FolderImport {
    pub fn inspect(&mut self, tree: &Path) -> Result<Vec<Value>> {
        if !self.items.is_empty() {
            return Err(Error::code("IMPORT_BUSY"));
        }
        let name = filename(tree.file_name().and_then(|n| n.to_str()));
        let mut result = Vec::new();
        let mut todo = VecDeque::from([(tree.to_owned(), name)]);
        let mut seen = HashSet::new();
        let walk = (|| -> Result<()> {
            while let Some((dir, path)) = todo.pop_front() {
                let canonical = dir.canonicalize()?;
                if !seen.insert(canonical) {
                    return Err(Error::code("IMPORT_FOLDER_CYCLE"));
                }
                let mut entries = children(&dir)?;
                entries.sort_by(|a, b| a.name.cmp(&b.name));
                for entry in entries {
                    let file = filename(Some(&entry.name));
                    let child = format!("{path}/{file}");
                    if entry.dir {
                        todo.push_back((entry.path, child));
                        continue;
                    }
                    if self.items.len() >= MAX_FILES {
                        return Err(Error::code("IMPORT_FOLDER_UNAVAILABLE"));
                    }
                    let ticket = uuid::Uuid::new_v4().to_string();
                    result.push(json!({"id": ticket, "name": file, "path": child, "mime": mime_for(&file)}));
                    self.items.push((ticket, Item { path: entry.path, input: None, offset: 0, done: false }));
                }
            }
            Ok(())
        })();
        if let Err(error) = walk {
            self.close();
            return Err(error);
        }
        Ok(result)
    }

    pub fn read(&mut self, ticket: &str, offset: u64) -> Result<(Vec<u8>, bool)> {
        let item = self.items.iter_mut().find(|(id, _)| id == ticket).map(|(_, item)| item).ok_or_else(|| Error::code("IMPORT_INVALID_TRANSFER"))?;
        if offset != item.offset || item.done {
            return Err(Error::code("IMPORT_INVALID_TRANSFER"));
        }
        if item.input.is_none() {
            item.input = Some(File::open(&item.path)?);
        }
        let input = item.input.as_mut().unwrap();
        let mut out = vec![0u8; CHUNK];
        let mut filled = 0;
        while filled < CHUNK {
            let n = input.read(&mut out[filled..])?;
            if n == 0 {
                item.done = true;
                item.input = None;
                break;
            }
            filled += n;
        }
        out.truncate(filled);
        item.offset += filled as u64;
        Ok((out, item.done))
    }

    pub fn close(&mut self) {
        self.items.clear();
    }
}
