//! Plattformneutraler Kern des Windows-Hosts von Workflow PDF Pro.
//! Nachbau der Android-Verträge (Java) ohne Android- oder Tauri-Abhängigkeit,
//! damit er unter Linux und Windows gleichermaßen geprüft werden kann.

pub mod crypto;
pub mod error;
pub mod fsutil;
pub mod prefs;
pub mod recovery;
pub mod vault;
pub mod locations;
pub mod inbox;
pub mod transfers;
pub mod folder;
pub mod chrome;

pub use error::{Error, Result};

/// Gerätegebundener Schutz für "auf diesem Gerät entsperrt halten".
/// Windows: DPAPI (Benutzerkonto). Tests: einfache Hülle.
pub trait DeviceProtect: Send + Sync {
    fn protect(&self, data: &[u8], entropy: &[u8]) -> Result<Vec<u8>>;
    fn unprotect(&self, data: &[u8], entropy: &[u8]) -> Result<zeroize::Zeroizing<Vec<u8>>>;
}
