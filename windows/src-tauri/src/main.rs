// Workflow PDF Pro für Windows: WebView2-Host für den unveränderten, lokal
// gebündelten Webkern. Kein Fernladen von App-Inhalten.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

// Tauri-Standard plus (nur im Prüfbau) der lokale Prüfzugang für Playwright.
#[cfg(not(feature = "messprobe"))]
const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";
#[cfg(feature = "messprobe")]
const BROWSER_ARGS: &str =
    "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --remote-debugging-port=9222";

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Workflow PDF Pro")
                .inner_size(1280.0, 900.0)
                .min_inner_size(360.0, 480.0)
                .use_https_scheme(true)
                // Der Kern hat eigenes Ziehen und Ablegen von Dateien.
                .disable_drag_drop_handler()
                .additional_browser_args(BROWSER_ARGS)
                // Eine fremde Seite darf die App nie ersetzen.
                .on_navigation(|url| url.scheme() == "https" && url.host_str() == Some("tauri.localhost"))
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Workflow PDF Pro konnte nicht starten");
}
