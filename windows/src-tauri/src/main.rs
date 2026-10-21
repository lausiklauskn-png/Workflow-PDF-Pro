// Workflow PDF Pro für Windows: WebView2-Host für den unveränderten, lokal
// gebündelten Webkern. Kein Fernladen von App-Inhalten.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod host;
mod win;

use host::{DialogMessage, Host};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};


const BRIDGE: &str = include_str!("../../bridge/capacitor-tauri.js");

/// Aufrufe der Geräteadapter. Nur das Hauptfenster darf sie verwenden.
#[tauri::command]
async fn wfp_call(window: WebviewWindow, host: tauri::State<'_, Arc<Host>>, plugin: String, method: String, options: Value) -> Result<Value, String> {
    if window.label() != "main" {
        return Err("NOT_ALLOWED".into());
    }
    let host = host.inner().clone();
    tauri::async_runtime::spawn_blocking(move || host.call(&plugin, &method, options)).await.map_err(|_| "NATIVE_ACTIVITY_CLOSED".to_string())?
}

/// Eingaben aus den eigenen Dialogfenstern (Passwort, Übersetzung abbrechen).
#[tauri::command]
async fn wfp_dialog(window: WebviewWindow, host: tauri::State<'_, Arc<Host>>, action: String, fields: Option<Value>) -> Result<Value, String> {
    let host = host.inner().clone();
    match (window.label(), action.as_str()) {
        ("kennwort", "senden") => {
            let fields = fields.unwrap_or(Value::Null);
            let text = |k: &str| fields.get(k).and_then(|v| v.as_str()).unwrap_or("").to_owned();
            let flag = |k: &str| fields.get(k).and_then(|v| v.as_bool()).unwrap_or(false);
            let (answer, reply) = std::sync::mpsc::channel();
            let sender = host.dialog.lock().unwrap().clone().ok_or("VAULT_CANCELLED")?;
            sender.send(DialogMessage::Submit { password: text("password"), repeat: text("repeat"), notice: flag("notice"), remember: flag("remember"), answer }).map_err(|_| "VAULT_CANCELLED")?;
            tauri::async_runtime::spawn_blocking(move || reply.recv().unwrap_or(json!({"status": 9}))).await.map_err(|_| "VAULT_CANCELLED".to_string())
        }
        ("kennwort", "abbrechen") => {
            if let Some(sender) = host.dialog.lock().unwrap().clone() {
                let _ = sender.send(DialogMessage::Cancel);
            }
            Ok(json!({}))
        }
        ("uebersetzung", "abbrechen") => {
            host.chrome_stop("CHROME_CANCELLED");
            Ok(json!({}))
        }
        _ => Err("NOT_ALLOWED".into()),
    }
}

/// Dateien aus der Befehlszeile ("Öffnen mit", auf das Programmsymbol gezogen).
fn file_arguments(argv: &[String], cwd: Option<&str>) -> Vec<PathBuf> {
    argv.iter().skip(1).filter(|a| !a.starts_with('-')).map(|a| {
        let p = PathBuf::from(a);
        match (p.is_absolute(), cwd) {
            (false, Some(cwd)) => PathBuf::from(cwd).join(p),
            _ => p,
        }
    }).filter(|p| p.is_file()).collect()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            if let Some(host) = app.try_state::<Arc<Host>>() {
                host.receive(file_arguments(&argv, Some(&cwd)));
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![wfp_call, wfp_dialog])
        .setup(|app| {
            let host = Arc::new(Host::new(app.handle().clone()));
            app.manage(host.clone());
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Workflow PDF Pro")
                .inner_size(1280.0, 900.0)
                .min_inner_size(360.0, 480.0)
                .use_https_scheme(true)
                // Der Kern hat eigenes Ziehen und Ablegen von Dateien.
                .disable_drag_drop_handler()
                .additional_browser_args(host::BROWSER_ARGS)
                .initialization_script(BRIDGE)
                // Eine fremde Seite darf die App nie ersetzen.
                .on_navigation(|url| url.scheme() == "https" && url.host_str() == Some("tauri.localhost"))
                .build()?;
            let args: Vec<String> = std::env::args().collect();
            let host2 = host.clone();
            std::thread::spawn(move || host2.receive(file_arguments(&args, None)));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let Some(host) = window.app_handle().try_state::<Arc<Host>>() else { return };
                match window.label() {
                    "kennwort" => {
                        if let Some(sender) = host.dialog.lock().unwrap().clone() {
                            let _ = sender.send(DialogMessage::Cancel);
                        }
                    }
                    "uebersetzung" => host.chrome_stop("CHROME_CANCELLED"),
                    "main" => {
                        host.chrome_stop("CHROME_APP_CLOSED");
                        window.app_handle().exit(0);
                    }
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Workflow PDF Pro konnte nicht starten");
}
