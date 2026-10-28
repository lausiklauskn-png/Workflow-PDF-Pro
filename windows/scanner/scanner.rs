//! Scanner über Windows-WIA für die Pro-Hüllen (Pro-Umbau 5). Quelle: Workflow PDF Pro windows/scanner/, byte-gleich
//! kopiert (Pin native/pro-scanner-herkunft.json). Die Seite ruft nur ProScanner.geraete / ProScanner.scannen.
//! Das Skript wia.ps1 ist fest eingebaut; der Auftrag geht als Base64-JSON über die Umgebung, nie als Befehlstext.
use base64::{Engine as _, engine::general_purpose::STANDARD as B64};
use serde_json::{json, Value};
use std::{path::Path, time::{Duration, Instant}};

const SKRIPT: &str = include_str!("wia.ps1");
const GRENZE: u64 = 160 * 1024 * 1024;

/// Prüft die Angaben der Seite. Nur feste Werte gehen weiter.
pub fn auftrag(method: &str, o: &Value, ziel: &Path) -> Result<Value, String> {
    let text = |k: &str| o.get(k).and_then(Value::as_str).unwrap_or("").to_owned();
    match method {
        "geraete" => Ok(json!({"aktion": "geraete"})),
        "scannen" => {
            let geraet = text("geraet");
            if geraet.is_empty() || geraet.len() > 512 || geraet.chars().any(|c| c.is_control()) { return Err("SCANNER_FEHLT".into()); }
            let quelle = if text("quelle") == "einzug" { "einzug" } else { "glas" };
            let farbe = match text("farbe").as_str() { "grau" => "grau", "sw" => "sw", _ => "farbe" };
            let dpi = o.get("dpi").and_then(Value::as_u64).unwrap_or(300);
            if ![150, 200, 300, 600].contains(&dpi) { return Err("INVALID_INPUT".into()); }
            Ok(json!({"aktion": "scannen", "geraet": geraet, "quelle": quelle, "farbe": farbe, "dpi": dpi, "ziel": ziel.to_string_lossy()}))
        }
        _ => Err("NOT_ALLOWED".into()),
    }
}

/// geraete → {geraete:[{id,name,art,verbindung,einzug,glas}]} · scannen → {seiten:[{mime,data}]}
/// `arbeit` ist ein app-eigener, leerer Arbeitsordner; er wird danach geleert.
pub fn call(method: &str, o: &Value, arbeit: &Path) -> Result<Value, String> {
    let _ = std::fs::remove_dir_all(arbeit);
    std::fs::create_dir_all(arbeit).map_err(|_| "SCANNER_FEHLER")?;
    let ergebnis = (|| {
        let a = auftrag(method, o, arbeit)?;
        let antwort = ausfuehren(&a, if method == "geraete" { 60 } else { 900 })?;
        if let Some(code) = antwort.get("fehler").and_then(Value::as_str) { return Err(code.to_owned()); }
        if method == "geraete" { return Ok(json!({"geraete": antwort.get("geraete").cloned().unwrap_or(json!([]))})); }
        let mut seiten = Vec::new(); let mut summe = 0u64;
        for p in antwort.get("dateien").and_then(Value::as_array).cloned().unwrap_or_default() {
            let Some(p) = p.as_str() else { continue };
            let pfad = Path::new(p);
            if !pfad.starts_with(arbeit) { return Err("SCANNER_FEHLER".into()); }
            let bytes = std::fs::read(pfad).map_err(|_| "SCANNER_FEHLER")?;
            summe += bytes.len() as u64; if summe > GRENZE { return Err("SCANNER_ZU_GROSS".into()); }
            seiten.push(json!({"mime": "image/jpeg", "data": B64.encode(&bytes)}));
        }
        Ok(json!({"seiten": seiten}))
    })();
    let _ = std::fs::remove_dir_all(arbeit);
    ergebnis
}

#[cfg(windows)]
fn ausfuehren(a: &Value, sekunden: u64) -> Result<Value, String> {
    use std::{io::Read, os::windows::process::CommandExt, process::{Command, Stdio}};
    let skript: Vec<u8> = SKRIPT.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
    let root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into());
    let ps = Path::new(&root).join("System32\\WindowsPowerShell\\v1.0\\powershell.exe");
    let mut kind = Command::new(ps)
        .args(["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-EncodedCommand"]).arg(B64.encode(&skript))
        .env("PRO_SCANNER_AUFTRAG", B64.encode(a.to_string()))
        .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null())
        .creation_flags(0x08000000).spawn().map_err(|_| "SCANNER_WIA_FEHLT")?;
    let mut out = kind.stdout.take().ok_or("SCANNER_FEHLER")?;
    let leser = std::thread::spawn(move || { let mut s = String::new(); let _ = out.by_ref().take(4 * 1024 * 1024).read_to_string(&mut s); s });
    let start = Instant::now();
    loop {
        match kind.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if start.elapsed() > Duration::from_secs(sekunden) => { let _ = kind.kill(); return Err("SCANNER_ZEIT".into()); }
            Ok(None) => std::thread::sleep(Duration::from_millis(100)),
            Err(_) => return Err("SCANNER_FEHLER".into()),
        }
    }
    let text = leser.join().map_err(|_| "SCANNER_FEHLER")?;
    serde_json::from_str(text.trim()).map_err(|_| "SCANNER_FEHLER".into())
}
#[cfg(not(windows))]
fn ausfuehren(_: &Value, _: u64) -> Result<Value, String> { Err("SCANNER_WIA_FEHLT".into()) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn nur_feste_werte() {
        let z = Path::new("/tmp/x");
        assert!(auftrag("scannen", &json!({"geraet": "", "dpi": 300}), z).is_err());
        assert!(auftrag("scannen", &json!({"geraet": "a\nb", "dpi": 300}), z).is_err());
        assert!(auftrag("scannen", &json!({"geraet": "x", "dpi": 299}), z).is_err());
        assert!(auftrag("loeschen", &json!({}), z).is_err());
        let a = auftrag("scannen", &json!({"geraet": "{6BDD1FC6}\\0001", "dpi": 600, "quelle": "einzug; rm", "farbe": "x"}), z).unwrap();
        assert_eq!(a["quelle"], "glas"); assert_eq!(a["farbe"], "farbe"); assert_eq!(a["dpi"], 600);
    }
}
