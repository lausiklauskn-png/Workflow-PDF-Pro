//! Update transport is native-only. The page never supplies a URL, key or bytes.
//! The updater verifies the signature AND its signed version before installation.
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde_json::{json, Value};
use std::{sync::{atomic::{AtomicBool, Ordering}, Mutex}, time::Duration};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::{Update, UpdaterExt};

pub const PUBLIC_KEY: &str = include_str!("../../signing/updater.pub");
pub const ENDPOINT: &str = "https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/windows-updates/latest.json";
const BASE: &str = "https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/";

#[derive(Default)]
pub struct Updates {
    busy: AtomicBool,
    pending: Mutex<Option<Update>>,
    downloaded: Mutex<Option<Vec<u8>>>,
}
struct Busy<'a>(&'a AtomicBool);
impl Drop for Busy<'_> { fn drop(&mut self) { self.0.store(false, Ordering::SeqCst); } }
fn key_valid(value: &str) -> bool {
    let Ok(raw) = B64.decode(value.trim()) else {return false;};
    let Ok(text) = std::str::from_utf8(&raw) else {return false;};
    let Some(line) = text.lines().nth(1) else {return false;};
    let Ok(bytes) = B64.decode(line) else {return false;};
    bytes.len() == 42 && &bytes[..2] == b"Ed"
}
fn allowed_download(version: &str, url: &str) -> bool {
    let parts: Vec<_> = version.split('.').collect();
    parts.len() == 3 && parts.iter().all(|s| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit()) && (s.len() == 1 || !s.starts_with('0')))
        && url == format!("{BASE}windows-v{version}/Workflow-PDF-Pro-Windows-{version}-Setup.exe")
}
impl Updates {
    pub async fn call(&self, app: AppHandle, operation: &str, expected: Option<&str>, language: Option<&str>) -> Result<Value, String> {
        if operation == "status" { return Ok(json!({"configured": key_valid(PUBLIC_KEY), "current": app.package_info().version.to_string()})); }
        if self.busy.swap(true, Ordering::SeqCst) { return Err("UPDATE_BUSY".into()); }
        let _busy = Busy(&self.busy);
        if !key_valid(PUBLIC_KEY) {return Err("UPDATE_NOT_CONFIGURED".into());}
        match operation {
            "check" => {
                *self.pending.lock().map_err(|_| "UPDATE_FAILED")? = None;
                *self.downloaded.lock().map_err(|_| "UPDATE_FAILED")? = None;
                let updater = app.updater_builder().pubkey(PUBLIC_KEY.trim())
                    .endpoints(vec![ENDPOINT.parse().map_err(|_| "UPDATE_FAILED")?]).map_err(|_| "UPDATE_FAILED")?
                    .timeout(Duration::from_secs(20)).build().map_err(|_| "UPDATE_FAILED")?;
                let update = updater.check().await.map_err(|_| "UPDATE_CHECK_FAILED")?;
                let Some(update) = update else {return Ok(json!({"available":false}));};
                if !allowed_download(&update.version, update.download_url.as_str()) {return Err("UPDATE_REJECTED".into());}
                let info=json!({"available":true,"version":update.version,"notes":update.body});
                *self.pending.lock().map_err(|_| "UPDATE_FAILED")? = Some(update);
                Ok(info)
            }
            "download" => {
                let update = self.pending.lock().map_err(|_| "UPDATE_FAILED")?.clone().ok_or("UPDATE_CHECK_REQUIRED")?;
                if expected != Some(update.version.as_str()) {return Err("UPDATE_REJECTED".into());}
                let host=app.state::<std::sync::Arc<crate::host::Host>>().inner().clone();
                let mut received=0u64;
                let bytes=update.download(move |chunk,total| {received+=chunk as u64;host.emit("WorkflowUpdates","progress",json!({"received":received,"total":total}));},||{})
                    .await.map_err(|_| "UPDATE_DOWNLOAD_OR_SIGNATURE_FAILED")?;
                *self.downloaded.lock().map_err(|_| "UPDATE_FAILED")? = Some(bytes);
                Ok(json!({"verified":true,"version":update.version}))
            }
            "install" => {
                let update = self.pending.lock().map_err(|_| "UPDATE_FAILED")?.clone().ok_or("UPDATE_CHECK_REQUIRED")?;
                if expected != Some(update.version.as_str()) {return Err("UPDATE_REJECTED".into());}
                let index=["de","en","ru","ar"].iter().position(|s|Some(*s)==language).unwrap_or(0);
                let messages=["Das geprüfte Update jetzt installieren? Workflow PDF Pro wird geschlossen und anschließend neu gestartet.","Install the verified update now? Workflow PDF Pro will close and restart.","Установить проверенное обновление? Workflow PDF Pro закроется и запустится снова.","هل تريد تثبيت التحديث الذي تم التحقق منه الآن؟ سيُغلق التطبيق ويُعاد تشغيله."];
                let dialog_app=app.clone();
                let accepted=tauri::async_runtime::spawn_blocking(move ||dialog_app.dialog().message(messages[index]).title("Workflow PDF Pro").buttons(MessageDialogButtons::OkCancel).blocking_show())
                    .await.map_err(|_| "UPDATE_FAILED")?;
                if !accepted {return Ok(json!({"cancelled":true}));}
                let bytes=self.downloaded.lock().map_err(|_| "UPDATE_FAILED")?.take().ok_or("UPDATE_DOWNLOAD_REQUIRED")?;
                // install() repeats the cryptographic check. No unsigned fallback.
                update.install(bytes).map_err(|_| "UPDATE_INSTALL_FAILED")?;
                Ok(json!({"installing":true}))
            }
            _ => Err("NOT_ALLOWED".into())
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn reject_foreign_http_prerelease_and_injected_versions() {
        assert!(allowed_download("1.2.3",&format!("{BASE}windows-v1.2.3/Workflow-PDF-Pro-Windows-1.2.3-Setup.exe")));
        for (version,url) in [("1.2.3","http://github.com/x"),("1.2.3","https://evil.test/setup.exe"),("1.2.3-beta","https://github.com/x"),("../1.2.3","https://github.com/x"),("01.2.3","https://github.com/x")] {assert!(!allowed_download(version,url));}
    }
    #[test] fn missing_or_invalid_key_never_enables_updates() {for key in ["","test","cHVibGljIGtleQ=="]{assert!(!key_valid(key));}}
}
