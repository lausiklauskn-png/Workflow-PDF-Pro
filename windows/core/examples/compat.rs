//! Gegenprobe zu compat/VaultCompat.java.
//! write <ordner> <passwort> <datei>  |  read <ordner> <passwort>
use std::path::Path;
use std::sync::Arc;
use wfp_core::locations::VaultLocations;
use wfp_core::{DeviceProtect, Result};
use zeroize::Zeroizing;

struct NoRemember;
impl DeviceProtect for NoRemember {
    fn protect(&self, _: &[u8], _: &[u8]) -> Result<Vec<u8>> { Err(wfp_core::Error::code("VAULT_UNAVAILABLE")) }
    fn unprotect(&self, _: &[u8], _: &[u8]) -> Result<Zeroizing<Vec<u8>>> { Err(wfp_core::Error::code("VAULT_LOCKED")) }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args[1] == "share-split" {
        let secret: Vec<u8> = (0..32).map(|i| u8::from_str_radix(&args[2][2 * i..2 * i + 2], 16).unwrap()).collect();
        for s in wfp_core::recovery::split(&secret, [5, 6, 7, 8], 5, 3).unwrap() { println!("{}", wfp_core::recovery::encode(&s)); }
        return;
    }
    if args[1] == "share-combine" {
        let shares: Vec<_> = args[2..].iter().map(|t| wfp_core::recovery::decode(t).unwrap()).collect();
        println!("{}", wfp_core::crypto::hex(&wfp_core::recovery::combine(&shares).unwrap()));
        return;
    }
    let app = std::env::temp_dir().join(format!("wfp-compat-{}", uuid::Uuid::new_v4()));
    let mut locs = VaultLocations::new(&app.join("prefs"), &app.join("cache"), Arc::new(NoRemember)).unwrap();
    let mut candidate = locs.candidate().unwrap();
    let place = candidate.inspect(Path::new(&args[2])).unwrap();
    if args[1] == "write" {
        candidate.initialize(place, &args[3], false).unwrap();
        let id = locs.adopt(candidate).unwrap();
        let v = locs.get(Some(&id)).unwrap();
        let data = std::fs::read(&args[4]).unwrap();
        let ticket = v.begin("files", "doc-1", None).unwrap();
        let mut offset = 0u64;
        for part in data.chunks(262144) { v.append(&ticket, offset, part).unwrap(); offset += part.len() as u64; }
        v.finish(&ticket, data.len() as u64).unwrap();
        println!("{}", v.info("files", "doc-1").unwrap()["hash"].as_str().unwrap());
    } else {
        candidate.open(place, &args[3], false).unwrap();
        let id = locs.adopt(candidate).unwrap();
        let v = locs.get(Some(&id)).unwrap();
        let mut out = Vec::new();
        loop { let part = v.read("files", "doc-1", out.len() as u64, None).unwrap(); if part.is_empty() { break; } out.extend(part); }
        let hash = wfp_core::crypto::sha256_hex(&out);
        assert_eq!(hash, v.info("files", "doc-1").unwrap()["hash"].as_str().unwrap());
        println!("{hash}");
    }
}
