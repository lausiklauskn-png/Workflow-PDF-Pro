//! Gebündelter kanonischer Tresor über private Prozess-Pipes. Keine Ports, kein System-Java.
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use zeroize::Zeroize;

const MAX_LINE: u64 = 30 * 1024 * 1024;
pub fn allowed(method: &str) -> bool {
    matches!(method, "tresorZustand" | "tresorVerbinden" | "tresorSperren" | "tresorFach" | "tresorUebergabe")
}
pub struct Engine { child: Child, input: ChildStdin, output: BufReader<ChildStdout> }
impl Drop for Engine { fn drop(&mut self) { let _ = self.child.kill(); let _ = self.child.wait(); } }
impl Engine {
    pub fn start(resources: &Path, config: &Path) -> Result<Self, String> {
        let root = resources.join("pro-tresor").canonicalize().map_err(|_| "TRESOR_ENGINE_FEHLT")?;
        let java = root.join("runtime/bin").join(if cfg!(windows) { "java.exe" } else { "java" });
        let jar = root.join("workflow-pro-tresor.jar");
        if !java.is_file() || !jar.is_file() { return Err("TRESOR_ENGINE_FEHLT".into()); }
        let mut command = Command::new(java);
        // Tauri can return a verbatim Windows path (\\?\C:\...). Java's
        // class loader does not accept that prefix in a classpath entry.
        // A relative entry also keeps semicolons in installation paths out
        // of Java's classpath separator syntax. The executable stays absolute.
        command.current_dir(&root);
        command.env_remove("JAVA_TOOL_OPTIONS").env_remove("_JAVA_OPTIONS").env_remove("JDK_JAVA_OPTIONS");
        command.arg("-Xmx256m").arg("-cp").arg("workflow-pro-tresor.jar").arg("de.familyprojekt.workflowpdf.pro.ProTresorEngine").arg(config)
            .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
        // Ausschließlich im nicht ausgelieferten Abnahmebau: JVM-Startfehler aufzeichnen.
        // Die Engine schreibt keine Passwörter oder Nutzdaten nach stderr.
        #[cfg(feature = "messprobe")]
        if let Some(dir) = std::env::var_os("WFP_PRUEF_ARBEIT") {
            if let Ok(file) = std::fs::OpenOptions::new().create(true).append(true).open(std::path::PathBuf::from(dir).join("pro-tresor-engine.stderr.log")) {
                command.stderr(Stdio::from(file));
            }
        }
        #[cfg(windows)]
        { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
        let mut child = command.spawn().map_err(|_| "TRESOR_ENGINE_START")?;
        let input = child.stdin.take().ok_or("TRESOR_ENGINE_PIPE")?;
        let output = BufReader::new(child.stdout.take().ok_or("TRESOR_ENGINE_PIPE")?);
        Ok(Self { child, input, output })
    }
    fn write(&mut self, value: Value) -> Result<(), String> {
        let mut bytes = serde_json::to_vec(&value).map_err(|_| "TRESOR_ENGINE_ANFRAGE")?;
        if bytes.len() as u64 > MAX_LINE { bytes.zeroize(); return Err("TRESOR_UEBERGABE_ZU_GROSS".into()); }
        let result = self.input.write_all(&bytes).and_then(|_| self.input.write_all(b"\n")).and_then(|_| self.input.flush());
        bytes.zeroize();
        result.map_err(|_| "TRESOR_ENGINE_PIPE".into())
    }
    pub fn call(&mut self, method: &str, options: &Value, mut host: impl FnMut(&str, &Value) -> Result<Value, String>) -> Result<Value, String> {
        if !allowed(method) { return Err("TRESOR_AKTION_UNGUELTIG".into()); }
        self.write(json!({"method": method, "options": options}))?;
        loop {
            let mut bytes = Vec::new();
            self.output.by_ref().take(MAX_LINE + 1).read_until(b'\n', &mut bytes).map_err(|_| "TRESOR_ENGINE_PIPE")?;
            if bytes.is_empty() || bytes.len() as u64 > MAX_LINE || !bytes.ends_with(b"\n") { return Err("TRESOR_ENGINE_ANTWORT".into()); }
            let result: Value = serde_json::from_slice(&bytes).map_err(|_| "TRESOR_ENGINE_ANTWORT")?;
            bytes.zeroize();
            if let Some(method) = result.get("host").and_then(Value::as_str) {
                let reply = match host(method, result.get("options").ok_or("TRESOR_ENGINE_ANTWORT")?) {
                    Ok(ok) => json!({"ok": ok}), Err(_) => json!({"error": "TRESOR_NICHT_VERFUEGBAR"}),
                };
                self.write(reply)?;
            } else if let Some(error) = result.get("error").and_then(Value::as_str) {
                return Err(error.into());
            } else { return result.get("ok").cloned().ok_or_else(|| "TRESOR_ENGINE_ANTWORT".into()); }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn only_common_vault_methods() {
        for method in ["tresorZustand", "tresorVerbinden", "tresorSperren", "tresorFach", "tresorUebergabe"] { assert!(allowed(method)); }
        for method in ["shell", "password", "protect", "tresorEinziehen", "writeFile", ""] { assert!(!allowed(method)); }
    }
    #[test] fn missing_runtime_never_creates_storage() {
        assert!(matches!(Engine::start(Path::new("missing"), Path::new("unused.json")), Err(e) if e=="TRESOR_ENGINE_FEHLT"));
    }
    #[cfg(windows)]
    #[test] fn bundled_runtime_uses_private_pipe() {
        let config=std::env::temp_dir().join(format!("wfp-pipe-{}-{}.json",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        // canonicalize produces the same verbatim prefix as the installed
        // Tauri host. A relative development path hid the former failure.
        let resources=std::fs::canonicalize(".").unwrap();
        let mut engine=Engine::start(&resources,&config).expect("gebündelte Laufzeit");
        let state=engine.call("tresorZustand",&json!({}),|_,_|panic!("keine Dialoge ohne Verbindung")).unwrap();
        assert_eq!(state,json!({"gewaehlt":false,"offen":false,"eingezogen":false,"uebergaben":true,"gemerkt":false}));
        assert!(!config.exists());
    }
}
