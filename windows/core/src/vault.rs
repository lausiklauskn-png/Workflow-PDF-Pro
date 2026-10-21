//! Dokumenttresor in einem frei gewählten Ordner (Rechner, USB-Laufwerk).
//! Nachbau von `DocumentVault.java`: dasselbe Ordner- und Dateiformat, damit ein
//! unter Android angelegter Tresor auch unter Windows öffnet und umgekehrt.
//! Statt Android-Dokument-IDs werden nur relative Namen gespeichert.
//! Alle Aufrufe laufen nacheinander (eine Sperre im Host).

use crate::crypto::{self, Reader, Writer, CHUNK};
use crate::error::{Error, Result};
use crate::fsutil::{self, children, create_new, read_limited};
use crate::prefs::Prefs;
use crate::DeviceProtect;
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use zeroize::Zeroizing;

pub const FOLDER: &str = "Workflow PDF Pro";
pub const HEADER: &str = "workflow-pdf-pro.tresor.json";
pub const FORMAT: &str = "workflow-pdf-pro-vault";
pub const STORES: [&str; 6] = ["folders", "docs", "files", "texte", "vektoren", "settings"];

fn fail(code: &'static str) -> Error {
    Error::code(code)
}

fn is_record_file(name: &str) -> bool {
    name.len() == 40 && name.ends_with(".wpv") && name[..36].bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase() || b == b'-')
}

fn is_uuid(name: &str) -> bool {
    name.len() == 36 && name.bytes().all(|b| (b.is_ascii_hexdigit() && !b.is_ascii_uppercase()) || b == b'-')
}

fn is_commit(name: &str) -> bool {
    // commit-<20 Ziffern>-<uuid>.json
    name.len() == 7 + 20 + 1 + 36 + 5 && name.starts_with("commit-") && name.ends_with(".json")
        && name[7..27].bytes().all(|b| b.is_ascii_digit()) && &name[27..28] == "-" && is_uuid(&name[28..64])
}

fn commit_prefix(revision: i64) -> String {
    format!("commit-{revision:020}-")
}

#[derive(Clone)]
pub struct Place {
    /// Vom Nutzer gewählter Ordner.
    pub tree: PathBuf,
    /// Tresorordner (gleich `tree` oder dessen Unterordner "Workflow PDF Pro").
    pub root: PathBuf,
    pub id: String,
    pub label: String,
    key: Option<Arc<Zeroizing<Vec<u8>>>>,
    pub revision: i64,
    index: Map<String, Value>,
    setup_objects: Option<Vec<PathBuf>>,
}

impl Place {
    fn key(&self) -> Result<&[u8]> {
        self.key.as_deref().map(|k| k.as_slice()).ok_or_else(|| fail("VAULT_LOCKED"))
    }
    fn logical(&self, kind: &str) -> String {
        format!("{FORMAT}:{}:{kind}", self.id)
    }
}

struct Pending {
    store: String,
    id: String,
    file: PathBuf,
    size: u64,
    place_id: String,
    reference: Option<Value>,
}

struct Batch {
    place_id: String,
    index: Map<String, Value>,
    created: HashSet<String>,
}

pub struct DocumentVault {
    prefs_dir: PathBuf,
    prefs: Prefs,
    cache_dir: PathBuf,
    device: Arc<dyn DeviceProtect>,
    active: Option<Place>,
    pending: HashMap<String, Pending>,
    batch: Option<Batch>,
}

fn record_name(store: &str, id: &str) -> Result<String> {
    if !STORES.contains(&store) || id.is_empty() {
        return Err(fail("VAULT_INVALID_RECORD"));
    }
    Ok(format!("{store}:{id}"))
}

fn display_name(path: &Path) -> String {
    path.file_name().and_then(|n| n.to_str()).map(str::to_owned).unwrap_or_else(|| path.to_string_lossy().into_owned())
}

fn reachable_dir(path: &Path) -> Result<()> {
    match fs::metadata(path) {
        Ok(meta) if meta.is_dir() => Ok(()),
        _ => Err(fail("VAULT_FOLDER_UNAVAILABLE")),
    }
}

impl DocumentVault {
    pub fn new(prefs_dir: &Path, namespace: &str, cache_dir: &Path, device: Arc<dyn DeviceProtect>) -> Result<Self> {
        Ok(Self { prefs_dir: prefs_dir.to_owned(), prefs: Prefs::open(prefs_dir, namespace)?, cache_dir: cache_dir.to_owned(), device, active: None, pending: HashMap::new(), batch: None })
    }

    fn visible_index<'a>(&'a self, p: &'a Place) -> &'a Map<String, Value> {
        match &self.batch {
            Some(batch) if batch.place_id == p.id => &batch.index,
            _ => &p.index,
        }
    }

    fn child(&self, dir: &Path, name: &str) -> Result<Option<fsutil::Entry>> {
        reachable_dir(dir)?;
        Ok(children(dir).map_err(|_| fail("VAULT_FOLDER_UNAVAILABLE"))?.into_iter().find(|e| e.name == name))
    }

    fn create_file(p: &mut Place, name: &str, data: &[u8]) -> Result<PathBuf> {
        let path = p.root.join(name);
        create_new(&path, data)?;
        if let Some(list) = p.setup_objects.as_mut() {
            list.push(path.clone());
        }
        Ok(path)
    }

    fn reader(p: &Place, name: &str, kind: &str) -> Result<Reader<File>> {
        if !is_record_file(name) {
            return Err(fail("VAULT_DAMAGED"));
        }
        let path = p.root.join(name);
        let file = match File::open(&path) {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Err(fail("VAULT_RECORD_NOT_FOUND")),
            Err(error) => return Err(error.into()),
        };
        Reader::new(file, p.key()?, &p.logical(kind))
    }

    fn delete_name(p: &Place, name: &str) {
        let _ = fs::remove_file(p.root.join(name));
    }

    /// Verschlüsselt schreiben, vollständig zurücklesen und prüfen, dann erst nennen.
    fn encrypted(p: &mut Place, kind: &str, input: &mut dyn Read) -> Result<String> {
        let name = format!("{}.wpv", uuid::Uuid::new_v4());
        let path = p.root.join(&name);
        let file = match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => return Err(fail("VAULT_FILE_EXISTS")),
            Err(error) => return Err(error.into()),
        };
        if let Some(list) = p.setup_objects.as_mut() {
            list.push(path.clone());
        }
        let result = (|| -> Result<()> {
            let mut writer = Writer::new(BufWriter::new(file), p.key()?, &p.logical(kind))?;
            let mut buffer = Zeroizing::new(vec![0u8; CHUNK]);
            loop {
                let n = input.read(&mut buffer)?;
                if n == 0 {
                    break;
                }
                writer.write(&buffer[..n])?;
            }
            let (size, digest, out) = writer.finish()?;
            let file = out.into_inner().map_err(|e| Error::Io(e.into_error()))?;
            file.sync_all()?;
            drop(file);
            let mut verify = Reader::new(File::open(&path)?, p.key()?, &p.logical(kind))?;
            if verify.size() != size || verify.digest_hex()? != digest {
                return Err(fail("VAULT_DAMAGED"));
            }
            Ok(())
        })();
        if let Err(error) = result {
            let _ = fs::remove_file(&path);
            return Err(error);
        }
        Ok(name)
    }

    fn write_index(&mut self, p: &mut Place, next: Map<String, Value>) -> Result<()> {
        let revision = p.revision.checked_add(1).ok_or_else(|| fail("VAULT_DAMAGED"))?;
        let envelope = json!({"app": FORMAT, "v": 1, "revision": revision, "records": Value::Object(next.clone())});
        let id = Self::encrypted(p, "index", &mut serde_json::to_vec(&envelope)?.as_slice())?;
        // Die Commit-Marke erst nach vollständig geschriebenem, geprüftem Index.
        let marker_name = format!("{}{}.json", commit_prefix(revision), uuid::Uuid::new_v4());
        let data = serde_json::to_vec(&json!({"index": id, "revision": revision}))?;
        let marker = (|| -> Result<PathBuf> {
            let marker = Self::create_file(p, &marker_name, &data)?;
            let checked: Value = serde_json::from_slice(&read_limited(&marker, 65536)?)?;
            if checked["index"].as_str() != Some(id.as_str()) || checked["revision"].as_i64() != Some(revision) {
                return Err(fail("VAULT_DAMAGED"));
            }
            Ok(marker)
        })();
        if let Err(error) = marker {
            let _ = fs::remove_file(p.root.join(&marker_name));
            Self::delete_name(p, &id);
            return Err(error);
        }
        p.index = next;
        p.revision = revision;
        // Lokaler Rücksprung-Prüfpunkt ist nur ergänzend.
        if self.active.as_ref().map(|a| a.id == p.id && a.root == p.root).unwrap_or(false) {
            let _ = self.prefs.commit(|m| {
                m.insert("revision".into(), json!(revision));
            });
        }
        let _ = Self::prune(p);
        Ok(())
    }

    fn read_generation(p: &Place, marker: &fsutil::Entry) -> Result<Value> {
        let info: Value = serde_json::from_slice(&read_limited(&marker.path, 65536)?)?;
        let revision = info["revision"].as_i64().ok_or(Error::Json)?;
        if !marker.name.starts_with(&commit_prefix(revision)) {
            return Err(fail("VAULT_DAMAGED"));
        }
        let index = info["index"].as_str().ok_or(Error::Json)?;
        let mut input = Self::reader(p, index, "index")?;
        let mut state: Value = serde_json::from_slice(&input.read_all(u32::MAX as u64)?)?;
        if state["app"].as_str() != Some(FORMAT) || state["v"].as_i64() != Some(1) || state["revision"].as_i64() != Some(revision) {
            return Err(fail("VAULT_DAMAGED"));
        }
        state["physicalIndex"] = json!(index);
        Ok(state)
    }

    fn prune(p: &Place) -> Result<()> {
        if p.setup_objects.is_some() {
            return Ok(());
        }
        let all = children(&p.root)?;
        let owned: HashSet<String> = all.iter().filter(|e| is_record_file(&e.name)).map(|e| e.name.clone()).collect();
        let mut commits: Vec<&fsutil::Entry> = all.iter().filter(|e| is_commit(&e.name)).collect();
        commits.sort_by(|a, b| b.name.cmp(&a.name));
        if commits.len() <= 3 {
            return Ok(());
        }
        let (mut retained, mut expired) = (HashSet::new(), HashSet::new());
        for (i, marker) in commits.iter().enumerate() {
            // Jede Generation authentisch lesen, bevor irgendetwas gelöscht wird.
            let generation = Self::read_generation(p, marker)?;
            let target = if i < 3 { &mut retained } else { &mut expired };
            target.insert(generation["physicalIndex"].as_str().unwrap_or_default().to_owned());
            if let Some(records) = generation["records"].as_object() {
                for record in records.values() {
                    target.insert(record["file"].as_str().ok_or(Error::Json)?.to_owned());
                }
            }
        }
        for name in expired.iter().filter(|n| !retained.contains(*n) && owned.contains(*n)) {
            Self::delete_name(p, name);
        }
        for marker in commits.iter().skip(3) {
            let _ = fs::remove_file(&marker.path);
        }
        Ok(())
    }

    fn load_index(&self, p: &mut Place) -> Result<()> {
        reachable_dir(&p.root)?;
        let mut commits: Vec<fsutil::Entry> = children(&p.root)?.into_iter().filter(|e| is_commit(&e.name)).collect();
        commits.sort_by(|a, b| b.name.cmp(&a.name));
        let newest = commits.first().ok_or_else(|| fail("VAULT_DAMAGED"))?;
        // Eine beschädigte neueste Generation nie still übergehen.
        let marker: Value = serde_json::from_slice(&read_limited(&newest.path, 65536)?)?;
        let revision = marker["revision"].as_i64().ok_or(Error::Json)?;
        if !newest.name.starts_with(&commit_prefix(revision)) {
            return Err(fail("VAULT_DAMAGED"));
        }
        if self.prefs.string("id").as_deref() == Some(p.id.as_str()) && revision < self.prefs.long("revision") {
            return Err(fail("VAULT_DAMAGED"));
        }
        let mut input = Self::reader(p, marker["index"].as_str().ok_or(Error::Json)?, "index")?;
        let state: Value = serde_json::from_slice(&input.read_all(u32::MAX as u64)?)?;
        if state["app"].as_str() != Some(FORMAT) || state["v"].as_i64() != Some(1) || state["revision"].as_i64() != Some(revision) {
            return Err(fail("VAULT_DAMAGED"));
        }
        p.index = state["records"].as_object().cloned().ok_or(Error::Json)?;
        p.revision = revision;
        Ok(())
    }

    /// Gewählten Ordner prüfen. Enthält er keinen Tresor, aber einen Unterordner
    /// "Workflow PDF Pro", wird dieser verwendet.
    pub fn inspect(&self, tree: &Path) -> Result<Place> {
        reachable_dir(tree)?;
        let mut root = tree.to_owned();
        if self.child(&root, HEADER)?.is_none() {
            if let Some(own) = self.child(&root, FOLDER)? {
                if own.dir {
                    root = own.path;
                }
            }
        }
        Ok(Place { tree: tree.to_owned(), label: display_name(&root), root, id: String::new(), key: None, revision: 0, index: Map::new(), setup_objects: None })
    }

    pub fn existing(&self, p: &Place) -> Result<bool> {
        Ok(self.child(&p.root, HEADER)?.is_some())
    }

    pub fn configured(&self) -> bool {
        self.prefs.contains("tree")
    }

    pub fn transferring(&self) -> bool {
        !self.pending.is_empty() || self.batch.is_some()
    }

    pub fn identity(&self) -> String {
        self.prefs.string("id").unwrap_or_default()
    }

    pub fn location_id(&self) -> String {
        let text = format!("{}|{}|{}", self.prefs.string("tree").unwrap_or_default(), self.prefs.string("root").unwrap_or_default(), self.identity());
        crypto::hex(&Sha256::digest(text.as_bytes()))
    }

    fn stored_place(&self) -> Place {
        Place {
            tree: PathBuf::from(self.prefs.string("tree").unwrap_or_default()),
            root: PathBuf::from(self.prefs.string("root").unwrap_or_default()),
            id: self.prefs.string("id").unwrap_or_default(),
            label: self.prefs.string("label").unwrap_or_else(|| FOLDER.into()),
            key: None,
            revision: 0,
            index: Map::new(),
            setup_objects: None,
        }
    }

    pub fn unlock(&mut self, password: &str, remember: bool) -> Result<()> {
        if !self.configured() {
            return Err(fail("VAULT_NOT_CONFIGURED"));
        }
        let candidate = self.stored_place();
        self.open(candidate, password, remember)
    }

    pub fn open(&mut self, mut candidate: Place, password: &str, remember: bool) -> Result<()> {
        if self.transferring() {
            return Err(fail("VAULT_BUSY"));
        }
        let header = self.child(&candidate.root, HEADER)?.ok_or_else(|| fail("VAULT_NOT_FOUND"))?;
        let meta: Value = serde_json::from_slice(&read_limited(&header.path, 65536)?)?;
        let rounds = meta["iterations"].as_i64().ok_or(Error::Json)?;
        if meta["app"].as_str() != Some(FORMAT) || meta["v"].as_i64() != Some(1) || rounds < crypto::MIN_ITERATIONS as i64 || rounds > crypto::MAX_ITERATIONS as i64 {
            return Err(fail("VAULT_DAMAGED"));
        }
        candidate.id = meta["id"].as_str().ok_or(Error::Json)?.to_owned();
        if !is_uuid(&candidate.id) {
            return Err(fail("VAULT_DAMAGED"));
        }
        let salt = B64.decode(meta["salt"].as_str().ok_or(Error::Json)?).map_err(|_| fail("VAULT_DAMAGED"))?;
        let wrapped = B64.decode(meta["wrapped"].as_str().ok_or(Error::Json)?).map_err(|_| fail("VAULT_DAMAGED"))?;
        if salt.len() != 16 || wrapped.len() != crypto::NONCE + crypto::KEY + crypto::TAG {
            return Err(fail("VAULT_DAMAGED"));
        }
        let derived = crypto::pbkdf2(&crypto::password_bytes(password), &salt, rounds as u32)?;
        let key = crypto::open(&derived, &wrapped, candidate.logical("password").as_bytes()).map_err(|_| fail("VAULT_PASSWORD"))?;
        if key.len() != 32 {
            return Err(fail("VAULT_DAMAGED"));
        }
        candidate.key = Some(Arc::new(key));
        self.load_index(&mut candidate)?;
        self.select(candidate, remember)
    }

    pub fn initialize(&mut self, mut candidate: Place, password: &str, remember: bool) -> Result<()> {
        if self.transferring() {
            return Err(fail("VAULT_BUSY"));
        }
        if crypto::nfc_len(password) < 10 {
            return Err(fail("VAULT_PASSWORD_SHORT"));
        }
        if self.existing(&candidate)? {
            return Err(fail("VAULT_FILE_EXISTS"));
        }
        candidate.setup_objects = Some(Vec::new());
        candidate.id = uuid::Uuid::new_v4().to_string();
        candidate.key = Some(Arc::new(Zeroizing::new(crypto::random(32))));
        let salt = crypto::random(16);
        let result = (|| -> Result<Place> {
            if display_name(&candidate.root) != FOLDER || !children(&candidate.root)?.is_empty() {
                let own = candidate.root.join(FOLDER);
                match fs::create_dir(&own) {
                    Ok(()) => {}
                    Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => return Err(fail("VAULT_FILE_EXISTS")),
                    Err(error) => return Err(error.into()),
                }
                candidate.setup_objects.as_mut().unwrap().push(own.clone());
                candidate.root = own;
            }
            candidate.label = display_name(&candidate.root);
            let derived = crypto::pbkdf2(&crypto::password_bytes(password), &salt, crypto::ITERATIONS)?;
            let wrapped = crypto::seal(&derived, candidate.key()?, candidate.logical("password").as_bytes())?;
            let meta = json!({"app": FORMAT, "v": 1, "id": candidate.id, "iterations": crypto::ITERATIONS, "salt": B64.encode(&salt), "wrapped": B64.encode(&wrapped)});
            let mut working = candidate.clone();
            self.write_index(&mut working, Map::new())?;
            let text = serde_json::to_vec(&meta)?;
            let header = Self::create_file(&mut working, HEADER, &text)?;
            if read_limited(&header, 65536)? != text {
                return Err(fail("VAULT_DAMAGED"));
            }
            Ok(working)
        })();
        match result {
            Ok(mut done) => {
                let setup = done.setup_objects.take();
                if let Err(error) = self.select(done.clone(), remember) {
                    Self::undo(setup);
                    return Err(error);
                }
                Ok(())
            }
            Err(error) => {
                Self::undo(candidate.setup_objects.take());
                Err(error)
            }
        }
    }

    /// Bei misslungener Einrichtung nur selbst angelegte Objekte entfernen, rückwärts.
    fn undo(objects: Option<Vec<PathBuf>>) {
        for path in objects.unwrap_or_default().into_iter().rev() {
            if path.is_dir() {
                let _ = fs::remove_dir(&path);
            } else {
                let _ = fs::remove_file(&path);
            }
        }
    }

    fn select(&mut self, p: Place, remember: bool) -> Result<()> {
        let remembered = if remember {
            Some(B64.encode(self.device.protect(p.key()?, p.logical("device").as_bytes())?))
        } else {
            None
        };
        let (tree, root, id, label, revision) = (p.tree.to_string_lossy().into_owned(), p.root.to_string_lossy().into_owned(), p.id.clone(), p.label.clone(), p.revision);
        self.prefs.commit(|m| {
            m.insert("tree".into(), json!(tree));
            m.insert("root".into(), json!(root));
            m.insert("id".into(), json!(id));
            m.insert("label".into(), json!(label));
            m.insert("revision".into(), json!(revision));
            m.remove("remember");
            if let Some(value) = remembered {
                m.insert("remember".into(), json!(value));
            }
        }).map_err(|_| fail("VAULT_UNAVAILABLE"))?;
        self.active = Some(Place { setup_objects: None, ..p });
        Ok(())
    }

    /// Übernahme in einen neuen Namensraum (VaultLocations.adopt).
    pub fn rehome(&mut self, namespace: &str) -> Result<()> {
        if self.transferring() {
            return Err(fail("VAULT_BUSY"));
        }
        let mut next = Prefs::open(&self.prefs_dir, namespace)?;
        if Some(self.identity()) == next.string("id") && self.prefs.long("revision") < next.long("revision") {
            return Err(fail("VAULT_DAMAGED"));
        }
        let copy = self.prefs.values().clone();
        next.commit(|m| {
            m.clear();
            for key in ["tree", "root", "id", "label", "remember"] {
                if let Some(value) = copy.get(key) {
                    m.insert(key.into(), value.clone());
                }
            }
            m.insert("revision".into(), copy.get("revision").cloned().unwrap_or(json!(0)));
        }).map_err(|_| fail("VAULT_UNAVAILABLE"))?;
        let mut previous = std::mem::replace(&mut self.prefs, next);
        let _ = previous.remove_file();
        Ok(())
    }

    fn require(&mut self) -> Result<Place> {
        if let Some(active) = &self.active {
            reachable_dir(&active.root)?;
            children(&active.root).map_err(|_| fail("VAULT_FOLDER_UNAVAILABLE"))?;
            return Ok(active.clone());
        }
        if !self.configured() {
            return Err(fail("VAULT_NOT_CONFIGURED"));
        }
        let remembered = self.prefs.string("remember").ok_or_else(|| fail("VAULT_LOCKED"))?;
        let mut p = self.stored_place();
        let value = B64.decode(remembered).map_err(|_| fail("VAULT_LOCKED"))?;
        let key = self.device.unprotect(&value, p.logical("device").as_bytes()).map_err(|_| fail("VAULT_LOCKED"))?;
        if key.len() != 32 {
            return Err(fail("VAULT_LOCKED"));
        }
        p.key = Some(Arc::new(key));
        self.load_index(&mut p)?;
        self.active = Some(p.clone());
        Ok(p)
    }

    pub fn state(&mut self) -> Value {
        let mut state = json!({"configured": self.configured(), "unlocked": false});
        if !self.configured() {
            return state;
        }
        state["id"] = json!(self.identity());
        state["folder"] = json!(self.prefs.string("label").unwrap_or_else(|| FOLDER.into()));
        match self.require() {
            Ok(p) => {
                state["unlocked"] = json!(true);
                state["reachable"] = json!(true);
                state["id"] = json!(p.id);
                state["folder"] = json!(p.label);
                state["revision"] = json!(p.revision);
                state["records"] = json!(p.index.len());
            }
            Err(error) => state["problem"] = json!(error.vault_code()),
        }
        state
    }

    fn clear_working(&mut self) {
        self.abort_batch();
        for pending in self.pending.values() {
            let _ = fs::remove_file(&pending.file);
        }
        self.pending.clear();
        self.active = None;
    }

    pub fn lock(&mut self) -> Result<()> {
        self.clear_working();
        self.prefs.commit(|m| {
            m.remove("remember");
        }).map_err(|_| fail("VAULT_UNAVAILABLE"))
    }

    pub fn close_working(&mut self) {
        self.clear_working();
    }

    pub fn begin(&mut self, store: &str, id: &str, reference: Option<Value>) -> Result<String> {
        let place = self.require()?;
        record_name(store, id)?;
        if let Some(reference) = &reference {
            let valid = store == "files"
                && reference["id"].as_str() == Some(id)
                && reference["vaultId"].as_str().map(is_uuid).unwrap_or(false)
                && reference["hash"].as_str().map(|h| h.len() == 64 && h.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())).unwrap_or(false);
            if !valid {
                return Err(fail("VAULT_INVALID_RECORD"));
            }
        }
        let folder = self.cache_dir.join("workflow-vault-pending");
        fs::create_dir_all(&folder).map_err(|_| fail("VAULT_UNAVAILABLE"))?;
        let file = folder.join(format!("record-{}.tmp", uuid::Uuid::new_v4()));
        File::create(&file).map_err(|_| fail("VAULT_UNAVAILABLE"))?;
        let ticket = uuid::Uuid::new_v4().to_string();
        self.pending.insert(ticket.clone(), Pending { store: store.into(), id: id.into(), file, size: 0, place_id: place.id, reference });
        Ok(ticket)
    }

    pub fn append(&mut self, ticket: &str, offset: u64, data: &[u8]) -> Result<()> {
        let place = self.require()?;
        let pending = self.pending.get_mut(ticket).ok_or_else(|| fail("VAULT_INVALID_TRANSFER"))?;
        if pending.place_id != place.id || offset != pending.size || data.len() > CHUNK {
            return Err(fail("VAULT_INVALID_TRANSFER"));
        }
        let mut out = OpenOptions::new().append(true).open(&pending.file)?;
        out.write_all(data)?;
        out.sync_all()?;
        pending.size += data.len() as u64;
        Ok(())
    }

    pub fn abort(&mut self, ticket: &str) {
        if let Some(pending) = self.pending.remove(ticket) {
            let _ = fs::remove_file(pending.file);
        }
    }

    pub fn finish(&mut self, ticket: &str, size: u64) -> Result<()> {
        let mut place = self.require()?;
        let result = (|| -> Result<()> {
            let pending = self.pending.get(ticket).ok_or_else(|| fail("VAULT_INVALID_TRANSFER"))?;
            if pending.place_id != place.id || pending.size != size || fs::metadata(&pending.file)?.len() != size {
                return Err(fail("VAULT_INVALID_TRANSFER"));
            }
            let logical = record_name(&pending.store, &pending.id)?;
            let mut bytes = Zeroizing::new(Vec::new());
            File::open(&pending.file)?.read_to_end(&mut bytes)?;
            let hash = crypto::sha256_hex(&bytes);
            let file = Self::encrypted(&mut place, &logical, &mut bytes.as_slice())?;
            let mut next = self.visible_index(&place).clone();
            let mut entry = json!({"store": pending.store, "id": pending.id, "file": file, "size": size, "hash": hash});
            if let Some(reference) = &pending.reference {
                entry["reference"] = reference.clone();
            }
            next.insert(logical, entry);
            let committed = if let Some(batch) = self.batch.as_mut() {
                batch.index = next;
                batch.created.insert(file.clone());
                Ok(())
            } else {
                self.write_index(&mut place, next)
            };
            if committed.is_err() {
                Self::delete_name(&place, &file);
            }
            committed
        })();
        self.abort(ticket);
        if result.is_ok() {
            self.active = Some(place);
        }
        result
    }

    pub fn info(&mut self, store: &str, id: &str) -> Result<Value> {
        let p = self.require()?;
        let name = record_name(store, id)?;
        let Some(record) = self.visible_index(&p).get(&name) else { return Ok(json!({"exists": false})) };
        let mut info = json!({"exists": true, "size": record["size"].as_i64().ok_or(Error::Json)?, "hash": record["hash"].as_str().ok_or(Error::Json)?});
        if let Some(reference) = record.get("reference") {
            info["reference"] = reference.clone();
        }
        Ok(info)
    }

    pub fn read(&mut self, store: &str, id: &str, offset: u64, expected_hash: Option<&str>) -> Result<Vec<u8>> {
        let p = self.require()?;
        let name = record_name(store, id)?;
        let record = self.visible_index(&p).get(&name).cloned().ok_or_else(|| fail("VAULT_RECORD_NOT_FOUND"))?;
        if let Some(expected) = expected_hash {
            if record["hash"].as_str() != Some(expected) {
                return Err(fail("VAULT_RECORD_CHANGED"));
            }
        }
        let mut reader = Self::reader(&p, record["file"].as_str().ok_or(Error::Json)?, &name)?;
        if reader.size() as i64 != record["size"].as_i64().ok_or(Error::Json)? {
            return Err(fail("VAULT_DAMAGED"));
        }
        reader.read(offset, CHUNK)
    }

    pub fn list(&mut self, store: &str) -> Result<Vec<String>> {
        let p = self.require()?;
        if !STORES.contains(&store) {
            return Err(fail("VAULT_INVALID_RECORD"));
        }
        Ok(self.visible_index(&p).values().filter(|e| e["store"].as_str() == Some(store)).filter_map(|e| e["id"].as_str().map(str::to_owned)).collect())
    }

    pub fn remove(&mut self, store: &str, id: &str, prefix: bool) -> Result<()> {
        let mut p = self.require()?;
        record_name(store, id)?;
        let view = self.visible_index(&p).clone();
        let mut next = view.clone();
        let nested = format!("{id}#");
        for (key, entry) in view.iter() {
            let entry_id = entry["id"].as_str().unwrap_or_default();
            if entry["store"].as_str() == Some(store) && (entry_id == id || (prefix && entry_id.starts_with(&nested))) {
                next.remove(key);
            }
        }
        if let Some(batch) = self.batch.as_mut() {
            batch.index = next;
            return Ok(());
        }
        self.write_index(&mut p, next)?;
        self.active = Some(p);
        Ok(())
    }

    pub fn begin_batch(&mut self) -> Result<()> {
        if self.transferring() {
            return Err(fail("VAULT_BUSY"));
        }
        let p = self.require()?;
        self.batch = Some(Batch { place_id: p.id.clone(), index: p.index.clone(), created: HashSet::new() });
        Ok(())
    }

    pub fn commit_batch(&mut self) -> Result<()> {
        let mut p = self.require()?;
        let batch = match &self.batch {
            Some(batch) if batch.place_id == p.id && self.pending.is_empty() => batch.index.clone(),
            _ => return Err(fail("VAULT_BUSY")),
        };
        self.write_index(&mut p, batch)?;
        self.batch = None;
        self.active = Some(p);
        Ok(())
    }

    pub fn abort_batch(&mut self) {
        let Some(old) = self.batch.take() else { return };
        for pending in self.pending.values() {
            let _ = fs::remove_file(&pending.file);
        }
        self.pending.clear();
        if let Some(p) = self.active.as_ref().filter(|p| p.id == old.place_id) {
            for name in &old.created {
                Self::delete_name(p, name);
            }
        }
    }

    pub fn active_id(&self) -> Option<&str> {
        self.active.as_ref().map(|p| p.id.as_str())
    }
}
