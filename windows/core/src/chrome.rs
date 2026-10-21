//! Nachbau von `ChromeSession.java` (Variante A): nur über 127.0.0.1 erreichbarer,
//! zeitlich begrenzter Austausch bereits bereinigter Absätze mit Chrome. Keine PDFs,
//! Kennungen, Zugangsdaten oder Datenbankeinträge gelangen in den Browser.
//! Eine Sitzung startet nie neu; Geheimnis nur im Fragment der Adresse.

use crate::crypto::{hex, random};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub const MAX_BODY: usize = 16 * 1024 * 1024;
const LIFETIME: Duration = Duration::from_secs(30 * 60);
const MAX_CONNECTIONS: usize = 8;

pub type Outcome = std::result::Result<Value, String>;

struct Pending {
    id: i64,
    texts: Value,
    result: Sender<Outcome>,
}

struct State {
    closed: bool,
    secret: Vec<u8>,
    sequence: i64,
    pending: Option<Pending>,
    deadline: Instant,
    origin: Option<String>,
    listener: Option<TcpListener>,
}

pub struct ChromeSession {
    pub id: String,
    pub from: String,
    pub to: String,
    pub language: String,
    assets: HashMap<&'static str, Vec<u8>>,
    state: Mutex<State>,
    on_stopped: Mutex<Option<Box<dyn Fn(String) + Send>>>,
    connections: AtomicUsize,
}

impl ChromeSession {
    /// `assets`: Hilfsseite, deren Skript und die unveränderte Übersetzungslogik des Kerns.
    pub fn new(from: &str, to: &str, language: &str, helper_html: Vec<u8>, helper_js: Vec<u8>, engine_js: Vec<u8>) -> std::result::Result<Arc<Self>, &'static str> {
        let langs = ["de", "en", "ru"];
        if !langs.contains(&from) || !langs.contains(&to) || from == to {
            return Err("CHROME_LANGUAGE_PAIR");
        }
        let mut assets = HashMap::new();
        assets.insert("/", helper_html);
        assets.insert("/helper.js", helper_js);
        assets.insert("/uebersetzung.js", engine_js);
        let session = Arc::new(Self {
            id: uuid::Uuid::new_v4().to_string(),
            from: from.into(),
            to: to.into(),
            language: language.into(),
            assets,
            state: Mutex::new(State { closed: false, secret: random(32), sequence: 0, pending: None, deadline: Instant::now() + LIFETIME, origin: None, listener: None }),
            on_stopped: Mutex::new(None),
            connections: AtomicUsize::new(0),
        });
        let watcher = Arc::downgrade(&session);
        std::thread::Builder::new().name("wfp-chrome-ablauf".into()).spawn(move || loop {
            std::thread::sleep(Duration::from_secs(5));
            let Some(session) = watcher.upgrade() else { return };
            let expired = { let s = session.state.lock().unwrap(); if s.closed { return; } Instant::now() >= s.deadline };
            if expired {
                session.stop("CHROME_EXPIRED");
                return;
            }
        }).map_err(|_| "CHROME_FOREGROUND_UNAVAILABLE")?;
        Ok(session)
    }

    pub fn set_on_stopped(&self, f: Box<dyn Fn(String) + Send>) {
        *self.on_stopped.lock().unwrap() = Some(f);
    }

    pub fn closed(&self) -> bool {
        self.state.lock().unwrap().closed
    }

    fn touch(state: &mut State) {
        state.deadline = Instant::now() + LIFETIME;
    }

    /// Adresse für Chrome; das Geheimnis steht nur im Fragment und wird nie an einen Server gesendet.
    pub fn browser_url(&self) -> std::result::Result<String, &'static str> {
        let s = self.state.lock().unwrap();
        match (&s.origin, s.closed) {
            (Some(origin), false) => Ok(format!("{origin}/#{}", hex(&s.secret))),
            _ => Err("CHROME_NOT_READY"),
        }
    }

    pub fn origin(&self) -> Option<String> {
        self.state.lock().unwrap().origin.clone()
    }

    fn listen(self: &Arc<Self>) -> std::result::Result<(), &'static str> {
        let mut s = self.state.lock().unwrap();
        if s.listener.is_some() {
            return Ok(());
        }
        let listener = TcpListener::bind("127.0.0.1:0").map_err(|_| "CHROME_FOREGROUND_UNAVAILABLE")?;
        let port = listener.local_addr().map_err(|_| "CHROME_FOREGROUND_UNAVAILABLE")?.port();
        s.origin = Some(format!("http://127.0.0.1:{port}"));
        let accept = listener.try_clone().map_err(|_| "CHROME_FOREGROUND_UNAVAILABLE")?;
        s.listener = Some(listener);
        drop(s);
        let session = Arc::downgrade(self);
        std::thread::Builder::new().name("wfp-chrome-loopback".into()).spawn(move || {
            for stream in accept.incoming() {
                let Some(session) = session.upgrade() else { return };
                if session.closed() {
                    return;
                }
                let Ok(stream) = stream else { continue };
                if session.connections.fetch_add(1, Ordering::SeqCst) >= MAX_CONNECTIONS {
                    session.connections.fetch_sub(1, Ordering::SeqCst);
                    let _ = stream.shutdown(Shutdown::Both);
                    continue;
                }
                std::thread::spawn(move || {
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
                    let _ = stream.set_write_timeout(Some(Duration::from_secs(10)));
                    let cancel = session.serve(stream);
                    session.connections.fetch_sub(1, Ordering::SeqCst);
                    if cancel {
                        session.stop("CHROME_CANCELLED");
                    }
                });
            }
        }).map_err(|_| "CHROME_FOREGROUND_UNAVAILABLE")?;
        Ok(())
    }

    /// Ein Paket Absätze anbieten; das Ergebnis kommt über den Empfänger.
    pub fn offer(self: &Arc<Self>, texts: &Value) -> std::result::Result<Receiver<Outcome>, &'static str> {
        let list = texts.as_array().ok_or("CHROME_INVALID_TEXT")?;
        if list.iter().any(|t| !t.is_string()) {
            return Err("CHROME_INVALID_TEXT");
        }
        if serde_json::to_vec(texts).map(|b| b.len()).unwrap_or(usize::MAX) > MAX_BODY {
            return Err("CHROME_PACKET_TOO_LARGE");
        }
        {
            let s = self.state.lock().unwrap();
            if s.closed {
                return Err("CHROME_CANCELLED");
            }
            if s.pending.is_some() {
                return Err("CHROME_BUSY");
            }
        }
        self.listen()?;
        let (tx, rx) = channel();
        let mut s = self.state.lock().unwrap();
        if s.closed {
            return Err("CHROME_CANCELLED");
        }
        s.sequence += 1;
        let id = s.sequence;
        s.pending = Some(Pending { id, texts: texts.clone(), result: tx });
        Self::touch(&mut s);
        Ok(rx)
    }

    fn packet(&self) -> Value {
        let s = self.state.lock().unwrap();
        match &s.pending {
            None => json!({"waiting": true}),
            Some(p) => json!({"id": p.id, "von": self.from, "nach": self.to, "uiLang": self.language, "texte": p.texts}),
        }
    }

    fn result(&self, body: &Value) -> u16 {
        let mut s = self.state.lock().unwrap();
        let Some(pending) = &s.pending else { return 409 };
        if body["id"].as_i64() != Some(pending.id) {
            return 409;
        }
        if body.get("error").is_some() {
            let old = s.pending.take().unwrap();
            let _ = old.result.send(Err("CHROME_TRANSLATION_FAILED".into()));
            return 200;
        }
        let expected = pending.texts.as_array().map(|a| a.len()).unwrap_or(0);
        let Some(texts) = body["texte"].as_array() else { return 422 };
        if texts.len() != expected || texts.iter().any(|t| !t.is_string()) {
            return 422;
        }
        let Some(stats) = body["stat"].as_object() else { return 422 };
        let mut clean = serde_json::Map::new();
        for key in ["ohne", "zeichen", "anfragen"] {
            let Some(number) = stats.get(key).and_then(|v| v.as_f64()) else { return 422 };
            if number < 0.0 || number > 9007199254740991.0 || number != number.trunc() {
                return 422;
            }
            clean.insert(key.into(), json!(number as i64));
        }
        let old = s.pending.take().unwrap();
        Self::touch(&mut s);
        let _ = old.result.send(Ok(json!({"texte": texts, "stat": Value::Object(clean)})));
        200
    }

    fn authorized(&self, header: Option<&String>) -> bool {
        let s = self.state.lock().unwrap();
        let Some(header) = header else { return false };
        if s.closed {
            return false;
        }
        let expected = format!("Bearer {}", hex(&s.secret));
        // Vergleich in konstanter Zeit.
        expected.len() == header.len() && expected.bytes().zip(header.bytes()).fold(0u8, |acc, (a, b)| acc | (a ^ b)) == 0
    }

    fn reply(out: &mut TcpStream, status: u16, mime: &str, bytes: &[u8]) {
        let headers = format!(
            "HTTP/1.1 {status} Response\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\nX-Frame-Options: DENY\r\nContent-Security-Policy: default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'\r\n\r\n",
            bytes.len()
        );
        let _ = out.write_all(headers.as_bytes());
        let _ = out.write_all(bytes);
        let _ = out.flush();
    }

    fn json(out: &mut TcpStream, status: u16, body: Value) {
        Self::reply(out, status, "application/json; charset=utf-8", body.to_string().as_bytes());
    }

    fn error(out: &mut TcpStream, status: u16, reason: &str) {
        Self::json(out, status, json!({"error": reason}));
    }

    /// Liefert true, wenn die Gegenseite ausdrücklich abgebrochen hat.
    fn serve(&self, stream: TcpStream) -> bool {
        let mut out = match stream.try_clone() { Ok(s) => s, Err(_) => return false };
        let peer_ok = stream.peer_addr().map(|a| a.ip().is_loopback()).unwrap_or(false);
        let mut input = BufReader::new(stream);
        let mut budget = 8192usize;
        let mut line = |input: &mut BufReader<TcpStream>| -> Option<String> {
            let mut raw = Vec::new();
            let n = input.by_ref().take(budget as u64).read_until(b'\n', &mut raw).ok()?;
            if n == 0 { return None; }
            budget = budget.saturating_sub(n);
            if !raw.ends_with(b"\n") { return None; }
            while matches!(raw.last(), Some(b'\n' | b'\r')) { raw.pop(); }
            String::from_utf8(raw).ok()
        };
        let Some(first) = line(&mut input) else { return false };
        let start: Vec<&str> = first.split(' ').collect();
        if start.len() != 3 {
            Self::error(&mut out, 400, "invalid-request");
            return false;
        }
        let mut headers: HashMap<String, String> = HashMap::new();
        loop {
            let Some(header) = line(&mut input) else { return false };
            if header.is_empty() { break; }
            let Some(colon) = header.find(':').filter(|c| *c > 0) else { return false };
            let key = header[..colon].to_ascii_lowercase();
            if headers.insert(key, header[colon + 1..].trim().to_owned()).is_some() {
                return false;
            }
        }
        let own = match self.origin() { Some(origin) => origin, None => return false };
        let authority = own.trim_start_matches("http://");
        if !peer_ok || headers.get("host").map(String::as_str) != Some(authority) {
            Self::error(&mut out, 403, "host-rejected");
            return false;
        }
        if headers.get("origin").is_some_and(|o| o != &own) {
            Self::error(&mut out, 403, "origin-rejected");
            return false;
        }
        let (method, path) = (start[0], start[1]);
        if method == "OPTIONS" {
            Self::error(&mut out, 403, "cross-origin-disabled");
            return false;
        }
        if method == "GET" {
            if let Some(asset) = self.assets.get(path) {
                let mime = if path.ends_with(".js") { "text/javascript; charset=utf-8" } else { "text/html; charset=utf-8" };
                Self::reply(&mut out, 200, mime, asset);
                return false;
            }
        }
        if !self.authorized(headers.get("authorization")) {
            Self::error(&mut out, 401, "session-required");
            return false;
        }
        if method == "GET" && path == "/batch" {
            Self::json(&mut out, 200, self.packet());
            return false;
        }
        if method != "POST" || !["/result", "/cancel"].contains(&path) {
            Self::error(&mut out, 404, "route-not-found");
            return false;
        }
        if headers.get("origin") != Some(&own) {
            Self::error(&mut out, 403, "origin-required");
            return false;
        }
        if headers.get("content-type").map(String::as_str) != Some("application/json") || headers.contains_key("transfer-encoding") {
            Self::error(&mut out, 415, "json-required");
            return false;
        }
        let length: i64 = headers.get("content-length").and_then(|v| v.parse().ok()).unwrap_or(-1);
        if length < 0 {
            Self::error(&mut out, 411, "length-required");
            return false;
        }
        if length as usize > MAX_BODY {
            Self::error(&mut out, 413, "packet-too-large");
            return false;
        }
        let mut body = vec![0u8; length as usize];
        if input.read_exact(&mut body).is_err() {
            return false;
        }
        let Ok(data) = serde_json::from_slice::<Value>(&body) else { return false };
        if path == "/cancel" {
            Self::json(&mut out, 200, json!({"cancelled": true}));
            return true;
        }
        let status = self.result(&data);
        Self::json(&mut out, status, json!({"accepted": status == 200}));
        false
    }

    pub fn stop(&self, reason: &str) {
        let old = {
            let mut s = self.state.lock().unwrap();
            if s.closed {
                return;
            }
            s.closed = true;
            for b in s.secret.iter_mut() {
                *b = 0;
            }
            // Wartenden accept()-Aufruf mit einer Selbstverbindung beenden.
            if let Some(listener) = s.listener.take() {
                if let Ok(addr) = listener.local_addr() {
                    let _ = TcpStream::connect_timeout(&addr, Duration::from_millis(200));
                }
            }
            s.pending.take()
        };
        if let Some(old) = old {
            let _ = old.result.send(Err(reason.to_owned()));
        }
        if let Some(f) = self.on_stopped.lock().unwrap().take() {
            f(reason.to_owned());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(origin: &str, raw: String) -> (u16, String) {
        let mut s = TcpStream::connect(origin.trim_start_matches("http://")).unwrap();
        s.write_all(raw.as_bytes()).unwrap();
        let mut text = String::new();
        s.read_to_string(&mut text).unwrap();
        let status = text[9..12].parse().unwrap();
        (status, text.split("\r\n\r\n").nth(1).unwrap_or_default().to_owned())
    }

    #[test]
    fn exchange_and_rejections() {
        let session = ChromeSession::new("de", "en", "de", b"<html>".to_vec(), b"js".to_vec(), b"engine".to_vec()).unwrap();
        assert!(ChromeSession::new("de", "de", "de", vec![], vec![], vec![]).is_err());
        let rx = session.offer(&json!(["Hallo Welt"])).unwrap();
        let url = session.browser_url().unwrap();
        let origin = session.origin().unwrap();
        let host = origin.trim_start_matches("http://").to_owned();
        let secret = url.split('#').nth(1).unwrap().to_owned();
        // Öffentliche Hilfsseite ohne Geheimnis.
        assert_eq!(request(&origin, format!("GET / HTTP/1.1\r\nHost: {host}\r\n\r\n")).0, 200);
        // Fremder Host, fremder Ursprung, fehlende Sitzung.
        assert_eq!(request(&origin, "GET /batch HTTP/1.1\r\nHost: evil.example\r\n\r\n".into()).0, 403);
        assert_eq!(request(&origin, format!("GET /batch HTTP/1.1\r\nHost: {host}\r\nOrigin: http://evil.example\r\n\r\n")).0, 403);
        assert_eq!(request(&origin, format!("GET /batch HTTP/1.1\r\nHost: {host}\r\n\r\n")).0, 401);
        let (status, body) = request(&origin, format!("GET /batch HTTP/1.1\r\nHost: {host}\r\nAuthorization: Bearer {secret}\r\n\r\n"));
        assert_eq!(status, 200);
        let packet: Value = serde_json::from_str(&body).unwrap();
        assert_eq!(packet["texte"], json!(["Hallo Welt"]));
        let result = json!({"id": packet["id"], "texte": ["Hello world"], "stat": {"ohne": 0, "zeichen": 10, "anfragen": 1}}).to_string();
        // Ohne Origin wird ein Ergebnis abgewiesen.
        assert_eq!(request(&origin, format!("POST /result HTTP/1.1\r\nHost: {host}\r\nAuthorization: Bearer {secret}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{result}", result.len())).0, 403);
        let (status, _) = request(&origin, format!("POST /result HTTP/1.1\r\nHost: {host}\r\nOrigin: {origin}\r\nAuthorization: Bearer {secret}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{result}", result.len()));
        assert_eq!(status, 200);
        assert_eq!(rx.recv().unwrap().unwrap()["texte"], json!(["Hello world"]));
        // Abbruch durch die Seite beendet die Sitzung endgültig.
        let body = "{}";
        assert_eq!(request(&origin, format!("POST /cancel HTTP/1.1\r\nHost: {host}\r\nOrigin: {origin}\r\nAuthorization: Bearer {secret}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}", body.len())).0, 200);
        std::thread::sleep(Duration::from_millis(300));
        assert!(session.closed());
        assert!(session.offer(&json!(["x"])).is_err());
    }
}
