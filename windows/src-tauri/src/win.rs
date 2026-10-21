//! Windows-Systemfunktionen: DPAPI, Laufwerke, Öffnen mit der Standard-App, Chrome finden.

use std::path::{Path, PathBuf};
use wfp_core::{DeviceProtect, Error, Result};
use zeroize::Zeroizing;

/// "Auf diesem Gerät entsperrt halten": Windows-Datenschutz (DPAPI) an das Benutzerkonto gebunden.
pub struct Dpapi;

#[cfg(windows)]
mod imp {
    use super::*;
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::Foundation::{HLOCAL, LocalFree};
    use windows::Win32::Security::Cryptography::{CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB};
    use windows::Win32::Storage::FileSystem::{GetDriveTypeW, GetLogicalDriveStringsW, GetVolumeInformationW};
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    fn blob(data: &[u8]) -> CRYPT_INTEGER_BLOB {
        CRYPT_INTEGER_BLOB { cbData: data.len() as u32, pbData: data.as_ptr() as *mut u8 }
    }

    unsafe fn take(out: CRYPT_INTEGER_BLOB) -> Vec<u8> {
        let bytes = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        std::ptr::write_bytes(out.pbData, 0, out.cbData as usize);
        let _ = LocalFree(Some(HLOCAL(out.pbData as *mut core::ffi::c_void)));
        bytes
    }

    pub fn protect(data: &[u8], entropy: &[u8]) -> Result<Vec<u8>> {
        let (input, extra) = (blob(data), blob(entropy));
        let mut out = CRYPT_INTEGER_BLOB::default();
        unsafe {
            CryptProtectData(&input, PCWSTR::null(), Some(&extra), None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut out).map_err(|_| Error::code("VAULT_UNAVAILABLE"))?;
            Ok(take(out))
        }
    }

    pub fn unprotect(data: &[u8], entropy: &[u8]) -> Result<Zeroizing<Vec<u8>>> {
        let (input, extra) = (blob(data), blob(entropy));
        let mut out = CRYPT_INTEGER_BLOB::default();
        unsafe {
            CryptUnprotectData(&input, None, Some(&extra), None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut out).map_err(|_| Error::code("VAULT_LOCKED"))?;
            Ok(Zeroizing::new(take(out)))
        }
    }

    /// Mit der zugeordneten Standard-App öffnen (Browser, Mail, PDF-Anzeige).
    pub fn shell_open(target: &str) -> bool {
        let result = unsafe { ShellExecuteW(None, &HSTRING::from("open"), &HSTRING::from(target), PCWSTR::null(), PCWSTR::null(), SW_SHOWNORMAL) };
        result.0 as isize > 32
    }

    pub fn volumes() -> Vec<serde_json::Value> {
        let mut buffer = vec![0u16; 512];
        let n = unsafe { GetLogicalDriveStringsW(Some(&mut buffer)) } as usize;
        let system = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into()).to_ascii_uppercase();
        let mut out = Vec::new();
        for raw in buffer[..n.min(buffer.len())].split(|c| *c == 0).filter(|s| !s.is_empty()) {
            let root = String::from_utf16_lossy(raw);
            let wide: Vec<u16> = raw.iter().copied().chain(Some(0)).collect();
            let kind = unsafe { GetDriveTypeW(PCWSTR(wide.as_ptr())) };
            // 2 = Wechseldatenträger, 3 = fest eingebaut. Netz/CD/RAM-Disk nicht anbieten.
            if kind != 2 && kind != 3 {
                continue;
            }
            let mut label = vec![0u16; 261];
            let ok = unsafe { GetVolumeInformationW(PCWSTR(wide.as_ptr()), Some(&mut label), None, None, None, None) }.is_ok();
            let name = if ok { String::from_utf16_lossy(&label[..label.iter().position(|c| *c == 0).unwrap_or(0)]) } else { String::new() };
            let id = root.trim_end_matches('\\').to_ascii_uppercase();
            out.push(serde_json::json!({"id": id, "primary": id == system, "removable": kind == 2, "label": if name.is_empty() { id.clone() } else { format!("{name} ({id})") }}));
        }
        out
    }

    fn app_path(hive: windows::Win32::System::Registry::HKEY, exe: &str) -> Option<PathBuf> {
        use windows::Win32::System::Registry::{RegGetValueW, RRF_RT_REG_SZ};
        let key = HSTRING::from(format!("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\{exe}"));
        let mut buffer = vec![0u16; 1024];
        let mut size = (buffer.len() * 2) as u32;
        let status = unsafe { RegGetValueW(hive, &key, PCWSTR::null(), RRF_RT_REG_SZ, None, Some(buffer.as_mut_ptr() as *mut _), Some(&mut size)) };
        if status.is_err() {
            return None;
        }
        let len = buffer.iter().position(|c| *c == 0).unwrap_or(0);
        let path = PathBuf::from(String::from_utf16_lossy(&buffer[..len]).trim_matches('"'));
        path.is_file().then_some(path)
    }

    pub fn chrome() -> Option<PathBuf> {
        use windows::Win32::System::Registry::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
        if let Some(path) = app_path(HKEY_CURRENT_USER, "chrome.exe").or_else(|| app_path(HKEY_LOCAL_MACHINE, "chrome.exe")) {
            return Some(path);
        }
        let tail = "Google\\Chrome\\Application\\chrome.exe";
        ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"].iter().filter_map(|v| std::env::var(v).ok()).map(|base| Path::new(&base).join(tail)).find(|p| p.is_file())
    }
}

#[cfg(not(windows))]
mod imp {
    use super::*;
    pub fn protect(_: &[u8], _: &[u8]) -> Result<Vec<u8>> { Err(Error::code("VAULT_UNAVAILABLE")) }
    pub fn unprotect(_: &[u8], _: &[u8]) -> Result<Zeroizing<Vec<u8>>> { Err(Error::code("VAULT_LOCKED")) }
    pub fn shell_open(_: &str) -> bool { false }
    pub fn volumes() -> Vec<serde_json::Value> { Vec::new() }
    pub fn chrome() -> Option<PathBuf> { None }
}

pub use imp::{chrome, shell_open, volumes};

impl DeviceProtect for Dpapi {
    fn protect(&self, data: &[u8], entropy: &[u8]) -> Result<Vec<u8>> {
        imp::protect(data, entropy)
    }
    fn unprotect(&self, data: &[u8], entropy: &[u8]) -> Result<Zeroizing<Vec<u8>>> {
        imp::unprotect(data, entropy)
    }
}

/// Datei im Explorer markiert zeigen (Rückweg zum Teilen, wenn das System-Teilen fehlt).
pub fn reveal(path: &Path) -> bool {
    std::process::Command::new("explorer.exe").arg(format!("/select,{}", path.display())).spawn().is_ok()
}
