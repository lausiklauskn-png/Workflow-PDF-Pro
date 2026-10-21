// Workflow PDF Pro für Windows: WebView2-Host für den unveränderten, lokal
// gebündelten Webkern. Kein Fernladen von App-Inhalten.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Workflow PDF Pro konnte nicht starten");
}
