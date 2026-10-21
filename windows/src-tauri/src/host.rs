//! Verteilt die Aufrufe der gemeinsamen Adapter (Capacitor-Schnittstelle) auf die
//! Windows-Umsetzungen. Verträge wie in den Android-Plugins (Java).

use crate::win;
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;
use wfp_core::chrome::ChromeSession;
use wfp_core::folder::FolderImport;
use wfp_core::fsutil::integer;
use wfp_core::inbox::Inbox;
use wfp_core::locations::VaultLocations;
use wfp_core::transfers::{copy_verified, Transfers};
use wfp_core::vault::{DocumentVault, Place};
use wfp_core::Error;

// Tauri-Standard plus (nur im Prüfbau) der lokale Prüfzugang für Playwright.
// WebView2 verlangt für alle Fenster einer App dieselben Startoptionen;
// ein Fenster mit abweichenden Optionen lässt sich nicht erzeugen.
#[cfg(not(feature = "messprobe"))]
pub const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";
#[cfg(feature = "messprobe")]
pub const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --remote-debugging-port=9222";

pub type Reply = std::result::Result<Value, String>;

pub enum DialogMessage {
    Submit { password: String, repeat: String, notice: bool, remember: bool, answer: Sender<Value> },
    Cancel,
}

pub struct Host {
    pub app: AppHandle,
    files: Mutex<Transfers>,
    saving: AtomicBool,
    import: Mutex<FolderImport>,
    importing: AtomicBool,
    inbox: Mutex<Option<Inbox>>,
    vault: Mutex<Option<VaultLocations>>,
    choosing: AtomicBool,
    pub dialog: Mutex<Option<Sender<DialogMessage>>>,
    chrome: Mutex<Option<(Arc<ChromeSession>, bool)>>,
    data_dir: PathBuf,
    cache_dir: PathBuf,
}

fn s<'a>(options: &'a Value, key: &str) -> Option<&'a str> {
    options.get(key).and_then(|v| v.as_str())
}

fn code(error: Error, fallback: &'static str) -> String {
    error.code_or(fallback).to_owned()
}

/// Nur im Prüfbau (Feature "messprobe"): feste Ordner statt Systemdialog, damit die
/// Abnahme auf dem GitHub-Rechner ohne Bedienung läuft. Im ausgelieferten Bau immer leer.
fn test_override(name: &str) -> Option<PathBuf> {
    #[cfg(feature = "messprobe")]
    {
        return std::env::var_os(name).map(PathBuf::from);
    }
    #[cfg(not(feature = "messprobe"))]
    {
        let _ = name;
        None
    }
}

fn language_index(options: &Value) -> usize {
    ["de", "en", "ru", "ar"].iter().position(|l| Some(*l) == s(options, "language")).unwrap_or(0)
}

impl Host {
    pub fn new(app: AppHandle) -> Self {
        let data_dir = app.path().app_local_data_dir().unwrap_or_else(|_| std::env::temp_dir().join("workflow-pdf-pro"));
        let cache_dir = app.path().app_cache_dir().unwrap_or_else(|_| data_dir.join("cache"));
        Self {
            files: Mutex::new(Transfers::new(&cache_dir)),
            saving: AtomicBool::new(false),
            import: Mutex::new(FolderImport::default()),
            importing: AtomicBool::new(false),
            inbox: Mutex::new(None),
            vault: Mutex::new(None),
            choosing: AtomicBool::new(false),
            dialog: Mutex::new(None),
            chrome: Mutex::new(None),
            data_dir,
            cache_dir,
            app,
        }
    }

    /// Ereignis an die Adapter im Hauptfenster melden.
    pub fn emit(&self, plugin: &str, event: &str, data: Value) {
        if let Some(window) = self.app.get_webview_window("main") {
            let script = format!("window.__wfpHostEvent&&window.__wfpHostEvent({},{},{})", json!(plugin), json!(event), data);
            let _ = window.eval(&script);
        }
    }

    pub fn call(self: &Arc<Self>, plugin: &str, method: &str, options: Value) -> Reply {
        match plugin {
            "WorkflowFiles" => self.files(method, &options),
            "WorkflowImport" => self.import(method, &options),
            "WorkflowIncoming" => self.incoming(method, &options),
            "WorkflowVault" => self.vault(method, &options),
            "WorkflowChrome" => self.chrome(method, &options),
            _ => Err("NOT_IMPLEMENTED".into()),
        }
    }

    // ---------- Dateien: Speichern, Teilen, Drucken, Links ----------
    fn files(&self, method: &str, o: &Value) -> Reply {
        let fail = |e: Error| code(e, "FILE_OPERATION_FAILED");
        match method {
            "begin" => Ok(json!({"id": self.files.lock().unwrap().begin(s(o, "name"), s(o, "mime")).map_err(fail)?})),
            "append" => Ok(json!({"size": self.files.lock().unwrap().append(s(o, "id"), o.get("offset"), s(o, "data").unwrap_or("")).map_err(fail)?})),
            "finish" => Ok(json!({"size": self.files.lock().unwrap().finish(s(o, "id"), o.get("size")).map_err(fail)?})),
            "abort" => {
                self.files.lock().unwrap().abort(s(o, "id"));
                Ok(json!({}))
            }
            "save" => {
                let (file, name) = {
                    let mut files = self.files.lock().unwrap();
                    let t = files.finished(s(o, "id")).map_err(|_| "FILE_OPERATION_FAILED".to_string())?;
                    (t.file.clone(), t.name.clone())
                };
                if self.saving.swap(true, Ordering::SeqCst) {
                    return Err("FILE_BUSY".into());
                }
                let result = (|| {
                    let mut dialog = self.app.dialog().file().set_file_name(&name);
                    if let Some(ext) = name.rsplit_once('.').map(|(_, e)| e.to_owned()).filter(|e| !e.is_empty() && e.len() <= 12) {
                        dialog = dialog.add_filter(ext.to_uppercase(), &[ext.as_str()]);
                    }
                    if let Ok(docs) = self.app.path().document_dir() {
                        dialog = dialog.set_directory(docs);
                    }
                    if let Some(window) = self.app.get_webview_window("main") {
                        dialog = dialog.set_parent(&window);
                    }
                    let chosen = match test_override("WFP_PRUEF_SPEICHERN") {
                        Some(dir) => Some(dir.join(&name)),
                        None => dialog.blocking_save_file().map(|t| t.into_path().map_err(|_| "FILE_SAVE_FAILED".to_string())).transpose()?,
                    };
                    let Some(target) = chosen else { return Ok(json!({"cancelled": true})) };
                    copy_verified(&file, &target).map_err(|_| "FILE_SAVE_FAILED".to_string())?;
                    Ok(json!({"saved": true}))
                })();
                self.saving.store(false, Ordering::SeqCst);
                result
            }
            "share" => {
                // Rückweg, wenn das Teilen-Fenster von Windows nicht verfügbar ist:
                // die Dateien im Explorer zeigen. Eine Zustellung wird nie bestätigt.
                let ids: Vec<String> = o.get("ids").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_owned)).collect()).unwrap_or_default();
                let mut files = self.files.lock().unwrap();
                let mut paths = Vec::new();
                for id in &ids {
                    paths.push(files.finished(Some(id)).map_err(|_| "FILE_OPERATION_FAILED".to_string())?.file.clone());
                }
                if let Some(url) = s(o, "url").filter(|u| !u.is_empty()) {
                    if !(url.starts_with("https://") || url.starts_with("http://")) {
                        return Err("FILE_OPERATION_FAILED".into());
                    }
                }
                let Some(first) = paths.first() else { return Err("SHARE_UNAVAILABLE".into()) };
                if !win::reveal(first) {
                    return Err("SHARE_UNAVAILABLE".into());
                }
                Ok(json!({"opened": true, "deliveryConfirmed": false}))
            }
            "print" => {
                let file = {
                    let mut files = self.files.lock().unwrap();
                    let t = files.finished(s(o, "id")).map_err(|_| "PRINT_UNAVAILABLE".to_string())?;
                    if t.mime != "application/pdf" {
                        return Err("PRINT_UNAVAILABLE".into());
                    }
                    t.file.clone()
                };
                // Öffnet die PDF in der Standard-PDF-Anzeige; gedruckt wird dort.
                if !win::shell_open(&file.to_string_lossy()) {
                    return Err("PRINT_UNAVAILABLE".into());
                }
                Ok(json!({"opened": true, "printed": false}))
            }
            "openLink" => {
                let url = s(o, "url").unwrap_or("");
                let scheme = url.split(':').next().unwrap_or("").to_ascii_lowercase();
                if !["https", "http", "mailto", "tel"].contains(&scheme.as_str()) || url.chars().any(|c| c.is_control()) {
                    return Err("LINK_NOT_ALLOWED".into());
                }
                if !win::shell_open(url) {
                    return Err("LINK_UNAVAILABLE".into());
                }
                Ok(json!({}))
            }
            _ => Err("NOT_IMPLEMENTED".into()),
        }
    }

    // ---------- Ordner einlesen ----------
    fn import(&self, method: &str, o: &Value) -> Reply {
        match method {
            "chooseFolder" => {
                if self.importing.swap(true, Ordering::SeqCst) {
                    return Err("IMPORT_BUSY".into());
                }
                let mut dialog = self.app.dialog().file();
                if let Some(window) = self.app.get_webview_window("main") {
                    dialog = dialog.set_parent(&window);
                }
                let chosen = match test_override("WFP_PRUEF_IMPORT") {
                    Some(dir) => Some(Ok(dir)),
                    None => dialog.blocking_pick_folder().map(|f| f.into_path().map_err(|_| Error::code("IMPORT_FOLDER_UNAVAILABLE"))),
                };
                let Some(folder) = chosen else {
                    self.importing.store(false, Ordering::SeqCst);
                    return Ok(json!({"cancelled": true}));
                };
                let result = folder.and_then(|path| {
                    let mut import = self.import.lock().unwrap();
                    import.close();
                    import.inspect(&path)
                });
                match result {
                    Ok(files) => Ok(json!({"files": files})),
                    Err(_) => {
                        self.import.lock().unwrap().close();
                        self.importing.store(false, Ordering::SeqCst);
                        Err("IMPORT_FOLDER_UNAVAILABLE".into())
                    }
                }
            }
            "read" => {
                let offset = integer(o.get("offset")).map_err(|_| "IMPORT_READ_FAILED".to_string())?;
                let (data, done) = self.import.lock().unwrap().read(s(o, "id").unwrap_or(""), offset).map_err(|_| "IMPORT_READ_FAILED".to_string())?;
                Ok(json!({"data": B64.encode(data), "done": done}))
            }
            "release" => {
                self.import.lock().unwrap().close();
                self.importing.store(false, Ordering::SeqCst);
                Ok(json!({}))
            }
            _ => Err("NOT_IMPLEMENTED".into()),
        }
    }

    // ---------- Empfang ("Öffnen mit", Ziehen auf das Programmsymbol) ----------
    fn with_inbox<T>(&self, f: impl FnOnce(&mut Inbox) -> wfp_core::Result<T>) -> std::result::Result<T, String> {
        let mut guard = self.inbox.lock().unwrap();
        if guard.is_none() {
            *guard = Some(Inbox::open(&self.data_dir).map_err(|_| "INCOMING_STORAGE_UNAVAILABLE".to_string())?);
        }
        f(guard.as_mut().unwrap()).map_err(|e| e.code_or("INCOMING_OPERATION_FAILED").to_owned())
    }

    /// Dateipfade aus der Befehlszeile (Start oder zweiter Start) entgegennehmen.
    pub fn receive(&self, paths: Vec<PathBuf>) {
        if paths.is_empty() {
            return;
        }
        if self.with_inbox(|inbox| inbox.add(&paths)).is_ok() {
            self.emit("WorkflowIncoming", "available", json!({}));
        }
    }

    fn incoming(&self, method: &str, o: &Value) -> Reply {
        match method {
            "pending" => self.with_inbox(|i| Ok(i.pending())).map_err(|_| "INCOMING_STORAGE_UNAVAILABLE".into()),
            "read" => {
                let offset = integer(o.get("offset")).map_err(|_| "INCOMING_READ_FAILED".to_string())?;
                let (data, done) = self.with_inbox(|i| i.read(s(o, "batch").unwrap_or(""), s(o, "id").unwrap_or(""), offset)).map_err(|_| "INCOMING_READ_FAILED".to_string())?;
                Ok(json!({"data": B64.encode(data), "done": done}))
            }
            "acknowledge" => {
                let discard = o.get("discard").and_then(|v| v.as_bool()).unwrap_or(false);
                self.with_inbox(|i| i.acknowledge(s(o, "id").unwrap_or(""), discard)).map_err(|_| "INCOMING_INVALID_TRANSFER".to_string())?;
                Ok(json!({}))
            }
            "history" => Ok(json!({"receipts": self.with_inbox(|i| Ok(i.history())).map_err(|_| "INCOMING_STORAGE_UNAVAILABLE".to_string())?})),
            "restore" => {
                self.with_inbox(|i| i.restore(s(o, "id").unwrap_or(""))).map_err(|_| "INCOMING_OPERATION_FAILED".to_string())?;
                self.emit("WorkflowIncoming", "available", json!({}));
                Ok(json!({}))
            }
            "discardArchived" => {
                self.with_inbox(|i| i.discard_archived(s(o, "id").unwrap_or(""))).map_err(|_| "INCOMING_OPERATION_FAILED".to_string())?;
                Ok(json!({}))
            }
            _ => Err("NOT_IMPLEMENTED".into()),
        }
    }

    // ---------- Dokumenttresor ----------
    fn with_vault<T>(&self, f: impl FnOnce(&mut VaultLocations) -> wfp_core::Result<T>) -> std::result::Result<T, String> {
        let mut guard = self.vault.lock().unwrap();
        if guard.is_none() {
            let dir = self.data_dir.join("tresor");
            *guard = Some(VaultLocations::new(&dir, &self.cache_dir, Arc::new(win::Dpapi)).map_err(|e| e.vault_code().to_string())?);
        }
        f(guard.as_mut().unwrap()).map_err(|e| e.vault_code().to_owned())
    }

    fn vault(self: &Arc<Self>, method: &str, o: &Value) -> Reply {
        let location = s(o, "location");
        let store = s(o, "store").unwrap_or("");
        let id = s(o, "id").unwrap_or("");
        match method {
            "state" => self.with_vault(|l| l.state(location)),
            "locations" => self.with_vault(|l| Ok(json!({"items": l.list()?}))),
            "migration" => self.with_vault(|l| Ok(json!({"location": l.migration()}))),
            "prepareMigration" => self.with_vault(|l| { l.prepare_migration(location.unwrap_or(""))?; Ok(json!({"saved": true})) }),
            "completeMigration" => self.with_vault(|l| { l.complete_migration(location.unwrap_or(""))?; l.state(None) }),
            "cancelMigration" => self.with_vault(|l| { l.cancel_migration()?; Ok(json!({"saved": true})) }),
            "beginBatch" => self.with_vault(|l| { l.get(location)?.begin_batch()?; Ok(json!({"started": true})) }),
            "commitBatch" => self.with_vault(|l| { l.get(location)?.commit_batch()?; Ok(json!({"saved": true})) }),
            "abortBatch" => self.with_vault(|l| { l.get(location)?.abort_batch(); Ok(json!({"aborted": true})) }),
            "setPrimary" => self.with_vault(|l| { l.select(location)?; l.state(None) }),
            "volumes" => Ok(json!({"items": win::volumes()})),
            "lock" => self.with_vault(|l| { l.lock()?; l.state(None) }),
            "begin" => {
                let reference = o.get("reference").filter(|v| v.is_object()).cloned();
                self.with_vault(|l| Ok(json!({"ticket": l.get(location)?.begin(store, id, reference)?})))
            }
            "append" => {
                let data = s(o, "data").unwrap_or("");
                if data.len() > 349528 {
                    return Err("VAULT_INVALID_TRANSFER".into());
                }
                let bytes = B64.decode(data).map_err(|_| "VAULT_INVALID_TRANSFER".to_string())?;
                let offset = integer(o.get("offset")).map_err(|_| "VAULT_INVALID_TRANSFER".to_string())?;
                self.with_vault(|l| { l.get(location)?.append(s(o, "ticket").unwrap_or(""), offset, &bytes)?; Ok(json!({"ok": true})) })
            }
            "finish" => {
                let size = integer(o.get("size")).map_err(|_| "VAULT_INVALID_TRANSFER".to_string())?;
                self.with_vault(|l| {
                    let v = l.get(location)?;
                    v.finish(s(o, "ticket").unwrap_or(""), size)?;
                    let mut info = v.info(store, id)?;
                    info["saved"] = json!(true);
                    Ok(info)
                })
            }
            "abort" => self.with_vault(|l| { l.get(location)?.abort(s(o, "ticket").unwrap_or("")); Ok(json!({})) }),
            "info" => self.with_vault(|l| l.get(location)?.info(store, id)),
            "read" => {
                let offset = integer(o.get("offset")).map_err(|_| "VAULT_INVALID_TRANSFER".to_string())?;
                self.with_vault(|l| Ok(json!({"data": B64.encode(l.get(location)?.read(store, id, offset, s(o, "hash"))?)})))
            }
            "list" => self.with_vault(|l| Ok(json!({"ids": l.get(location)?.list(store)?}))),
            "remove" => {
                let prefix = o.get("prefix").and_then(|v| v.as_bool()).unwrap_or(false);
                self.with_vault(|l| { l.get(location)?.remove(store, id, prefix)?; Ok(json!({"saved": true})) })
            }
            "choose" => self.vault_choose(o),
            "unlock" => self.vault_unlock(o),
            _ => Err("NOT_IMPLEMENTED".into()),
        }
    }

    fn vault_choose(self: &Arc<Self>, o: &Value) -> Reply {
        if self.choosing.swap(true, Ordering::SeqCst) {
            return Err("VAULT_BUSY".into());
        }
        let result = (|| {
            let mut dialog = self.app.dialog().file();
            if let Some(volume) = s(o, "volume").filter(|v| v.len() == 2 && v.ends_with(':')) {
                dialog = dialog.set_directory(format!("{volume}\\"));
            }
            if let Some(window) = self.app.get_webview_window("main") {
                dialog = dialog.set_parent(&window);
            }
            let chosen = match test_override("WFP_PRUEF_TRESOR") {
                Some(dir) => Some(dir),
                None => dialog.blocking_pick_folder().map(|f| f.into_path().map_err(|_| "VAULT_FOLDER_UNAVAILABLE".to_string())).transpose()?,
            };
            let Some(tree) = chosen else { return Ok(json!({"cancelled": true})) };
            let (candidate, place, exists) = self.with_vault(|l| {
                l.ensure_idle()?;
                let candidate = l.candidate()?;
                let place = candidate.inspect(&tree)?;
                let exists = candidate.existing(&place)?;
                Ok((candidate, place, exists))
            })?;
            if s(o, "expectedVaultId").is_some() && !exists {
                return Err("VAULT_WRONG_FOLDER".to_string());
            }
            self.password(o, Target::Candidate(candidate, place), if exists { 1 } else { 0 })
        })();
        self.choosing.store(false, Ordering::SeqCst);
        result
    }

    fn vault_unlock(self: &Arc<Self>, o: &Value) -> Reply {
        if self.choosing.swap(true, Ordering::SeqCst) {
            return Err("VAULT_BUSY".into());
        }
        let location = s(o, "location").map(str::to_owned);
        let result = self.with_vault(|l| l.get(location.as_deref()).map(|_| ())).and_then(|_| self.password(o, Target::Existing(location), 2));
        self.choosing.store(false, Ordering::SeqCst);
        result
    }

    /// Passwort in einem eigenen Fenster abfragen. Das Passwort gelangt nie in die
    /// Webseite des Hauptfensters und nie in den Ordner.
    fn password(self: &Arc<Self>, o: &Value, mut target: Target, mode: u8) -> Reply {
        let (tx, rx): (Sender<DialogMessage>, Receiver<DialogMessage>) = channel();
        *self.dialog.lock().unwrap() = Some(tx);
        let lang = ["de", "en", "ru", "ar"][language_index(o)];
        let url = format!("windows/kennwort.html?modus={mode}&sprache={lang}");
        let opened = self.open_dialog("kennwort", &url, 460.0, if mode == 0 { 470.0 } else { 330.0 });
        if let Err(error) = opened {
            *self.dialog.lock().unwrap() = None;
            return Err(error);
        }
        let expected = s(o, "expectedVaultId").map(str::to_owned);
        let outcome = loop {
            match rx.recv() {
                Err(_) | Ok(DialogMessage::Cancel) => break Ok(json!({"cancelled": true})),
                Ok(DialogMessage::Submit { password, repeat, notice, remember, answer }) => {
                    let password = zeroize::Zeroizing::new(password);
                    let repeat = zeroize::Zeroizing::new(repeat);
                    if mode == 0 && (wfp_core::crypto::nfc_len(&password) < 10 || wfp_core::crypto::password_bytes(&password) != wfp_core::crypto::password_bytes(&repeat) || !notice) {
                        let _ = answer.send(json!({"status": 8}));
                        continue;
                    }
                    match self.apply(&mut target, mode, &password, remember, expected.as_deref()) {
                        Ok(value) => {
                            let _ = answer.send(json!({"done": true}));
                            break Ok(value);
                        }
                        Err(_) => {
                            let _ = answer.send(json!({"status": 9}));
                        }
                    }
                }
            }
        };
        *self.dialog.lock().unwrap() = None;
        if let Some(window) = self.app.get_webview_window("kennwort") {
            let _ = window.destroy();
        }
        outcome
    }

    fn apply(&self, target: &mut Target, mode: u8, password: &str, remember: bool, expected: Option<&str>) -> std::result::Result<Value, String> {
        match target {
            Target::Candidate(candidate, place) => {
                if mode == 0 {
                    candidate.initialize(place.clone(), password, remember).map_err(|e| e.vault_code().to_string())?;
                } else {
                    candidate.open(place.clone(), password, remember).map_err(|e| e.vault_code().to_string())?;
                }
                if let Some(expected) = expected {
                    if expected != candidate.identity() {
                        let _ = candidate.lock();
                        return Err("VAULT_WRONG_FOLDER".into());
                    }
                }
                // Der Kandidat wird übernommen; ein späterer Fehler braucht einen neuen Kandidaten.
                let taken = std::mem::replace(candidate, self.with_vault(|l| l.candidate())?);
                let location = self.with_vault(|l| l.adopt(taken))?;
                let state = self.with_vault(|l| l.state(Some(&location)))?;
                Ok(json!({"location": location, "state": state, "created": mode == 0, "opened": mode == 1, "unlocked": true}))
            }
            Target::Existing(location) => self.with_vault(|l| {
                let v = l.get(location.as_deref())?;
                v.unlock(password, remember)?;
                if let Some(expected) = expected {
                    if expected != v.identity() {
                        v.lock()?;
                        return Err(Error::code("VAULT_WRONG_FOLDER"));
                    }
                }
                let id = v.location_id();
                let state = l.state(Some(&id))?;
                Ok(json!({"location": id, "state": state, "created": false, "opened": false, "unlocked": true}))
            }),
        }
    }

    pub fn open_dialog(&self, label: &str, url: &str, width: f64, height: f64) -> std::result::Result<(), String> {
        if let Some(old) = self.app.get_webview_window(label) {
            let _ = old.destroy();
        }
        let mut builder = WebviewWindowBuilder::new(&self.app, label, WebviewUrl::App(url.into()))
            .title("Workflow PDF Pro")
            .inner_size(width, height)
            .resizable(false)
            .minimizable(false)
            .maximizable(false)
            .always_on_top(true)
            .focused(true)
            .center()
            .use_https_scheme(true)
            .disable_drag_drop_handler()
            .additional_browser_args(BROWSER_ARGS)
            .on_navigation(|u| u.scheme() == "https" && u.host_str() == Some("tauri.localhost"));
        if let Some(main) = self.app.get_webview_window("main") {
            builder = builder.parent(&main).map_err(|_| "VAULT_UNAVAILABLE".to_string())?;
        }
        builder.build().map(|_| ()).map_err(|_| "VAULT_UNAVAILABLE".to_string())
    }

    // ---------- Chrome-Übersetzung (Variante A) ----------
    fn asset(&self, path: &str) -> std::result::Result<Vec<u8>, String> {
        self.app.asset_resolver().get(path.to_owned()).map(|a| a.bytes().to_vec()).ok_or_else(|| "CHROME_FOREGROUND_UNAVAILABLE".to_string())
    }

    pub fn chrome_stop(&self, reason: &str) {
        let current = self.chrome.lock().unwrap().take();
        if let Some((session, _)) = current {
            session.stop(reason);
        }
    }

    fn chrome(self: &Arc<Self>, method: &str, o: &Value) -> Reply {
        match method {
            "begin" => {
                self.chrome_stop("CHROME_REPLACED");
                let session = ChromeSession::new(
                    s(o, "von").unwrap_or(""),
                    s(o, "nach").unwrap_or(""),
                    s(o, "language").unwrap_or("de"),
                    self.asset("native/chrome/helper.html")?,
                    self.asset("native/chrome/helper.js")?,
                    self.asset("assets/uebersetzung.js")?,
                ).map_err(str::to_owned)?;
                let host = Arc::downgrade(self);
                let id = session.id.clone();
                session.set_on_stopped(Box::new(move |reason| {
                    if let Some(host) = host.upgrade() {
                        {
                            let mut current = host.chrome.lock().unwrap();
                            if current.as_ref().map(|(s, _)| s.id == id).unwrap_or(false) {
                                *current = None;
                            }
                        }
                        host.emit("WorkflowChrome", "stopped", json!({"id": id, "reason": reason}));
                        if let Some(window) = host.app.get_webview_window("uebersetzung") {
                            let _ = window.destroy();
                        }
                    }
                }));
                let lang = ["de", "en", "ru", "ar"][language_index(o)];
                // Sichtbarer Laufhinweis mit Abbrechen, wie die Android-Benachrichtigung.
                let _ = self.open_dialog("uebersetzung", &format!("windows/uebersetzung.html?sprache={lang}"), 380.0, 190.0);
                let id = session.id.clone();
                *self.chrome.lock().unwrap() = Some((session, false));
                Ok(json!({"id": id}))
            }
            "translate" => {
                let wanted = s(o, "id").unwrap_or("");
                let (session, opened) = match &*self.chrome.lock().unwrap() {
                    Some((session, opened)) if session.id == wanted && !session.closed() => (session.clone(), *opened),
                    _ => return Err("CHROME_CANCELLED".into()),
                };
                let texts = o.get("texte").cloned().ok_or_else(|| "CHROME_INVALID_TEXT".to_string())?;
                let receiver = session.offer(&texts).map_err(|e| {
                    session.stop(e);
                    e.to_owned()
                })?;
                if !opened {
                    let Some(chrome) = win::chrome() else {
                        session.stop("CHROME_NOT_INSTALLED");
                        return Err("CHROME_NOT_INSTALLED".into());
                    };
                    let url = session.browser_url().map_err(str::to_owned)?;
                    if std::process::Command::new(chrome).arg("--new-window").arg(url).spawn().is_err() {
                        session.stop("CHROME_NOT_INSTALLED");
                        return Err("CHROME_NOT_INSTALLED".into());
                    }
                    if let Some((current, flag)) = self.chrome.lock().unwrap().as_mut() {
                        if current.id == session.id {
                            *flag = true;
                        }
                    }
                }
                match receiver.recv() {
                    Ok(Ok(value)) => Ok(value),
                    Ok(Err(reason)) => Err(reason),
                    Err(_) => Err("CHROME_CANCELLED".into()),
                }
            }
            "close" => {
                let wanted = s(o, "id").unwrap_or("");
                let matches = self.chrome.lock().unwrap().as_ref().map(|(s, _)| s.id == wanted).unwrap_or(false);
                if matches {
                    self.chrome_stop("CHROME_CANCELLED");
                }
                Ok(json!({}))
            }
            _ => Err("NOT_IMPLEMENTED".into()),
        }
    }
}

pub enum Target {
    Candidate(DocumentVault, Place),
    Existing(Option<String>),
}
