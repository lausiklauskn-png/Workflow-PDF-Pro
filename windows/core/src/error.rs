//! Fehlercodes wie in den Android-Plugins. Nur feste Codes gehen an die Webseite,
//! niemals Pfade, Ausnahmetexte oder Inhalte.

use std::fmt;

#[derive(Debug)]
pub enum Error {
    Code(&'static str),
    Io(std::io::Error),
    Json,
}

pub type Result<T> = std::result::Result<T, Error>;

impl Error {
    pub fn code(code: &'static str) -> Self {
        Error::Code(code)
    }
    /// Code für den Tresor (entspricht ProVaultPlugin.code).
    pub fn vault_code(&self) -> &'static str {
        match self {
            Error::Code(code) => code,
            Error::Json => "VAULT_DAMAGED",
            Error::Io(error) => match error.kind() {
                std::io::ErrorKind::NotFound | std::io::ErrorKind::PermissionDenied => "VAULT_FOLDER_UNAVAILABLE",
                std::io::ErrorKind::UnexpectedEof | std::io::ErrorKind::InvalidData => "VAULT_DAMAGED",
                _ => "VAULT_UNAVAILABLE",
            },
        }
    }
    pub fn code_or(&self, fallback: &'static str) -> &'static str {
        match self {
            Error::Code(code) => code,
            _ => fallback,
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.vault_code())
    }
}

impl std::error::Error for Error {}

impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        Error::Io(error)
    }
}

impl From<serde_json::Error> for Error {
    fn from(_: serde_json::Error) -> Self {
        Error::Json
    }
}
