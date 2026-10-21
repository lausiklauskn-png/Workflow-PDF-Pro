//! Tresor-Dateiformat PBV1, bytegleich zu `VaultCrypto.java` (Android) und damit
//! zu Private Brain Pro. Datei = Kopf (Kennung, Version, Stückgröße, umhüllter
//! Dateischlüssel) + AES-256-GCM-Stücke zu 256 KiB. Jedes Stück bindet Kopf,
//! logischen Namen, Index und Endmarke: Vertauschen, Austauschen oder Abschneiden
//! wird erkannt.

use crate::error::{Error, Result};
use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::io::{Read, Seek, SeekFrom, Write};
use unicode_normalization::UnicodeNormalization;
use zeroize::{Zeroize, Zeroizing};

pub const CHUNK: usize = 256 * 1024;
pub const NONCE: usize = 12;
pub const TAG: usize = 16;
pub const KEY: usize = 32;
pub const OVERHEAD: usize = NONCE + TAG;
pub const ITERATIONS: u32 = 600_000;
pub const MIN_ITERATIONS: u32 = 100_000;
pub const MAX_ITERATIONS: u32 = 10_000_000;
pub const HEADER: usize = 4 + 1 + 4 + NONCE + KEY + TAG;
const MAGIC: &[u8; 4] = b"PBV1";

pub fn random(length: usize) -> Vec<u8> {
    let mut value = vec![0u8; length];
    getrandom::getrandom(&mut value).expect("Systemzufall nicht verfügbar");
    value
}

pub fn hex(value: &[u8]) -> String {
    value.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn sha256_hex(data: &[u8]) -> String {
    hex(&Sha256::digest(data))
}

/// NFC zuerst: dasselbe Passwort von einer anderen Tastatur muss öffnen.
pub fn password_bytes(password: &str) -> Zeroizing<Vec<u8>> {
    let normalized: Zeroizing<String> = Zeroizing::new(password.nfc().collect());
    Zeroizing::new(normalized.as_bytes().to_vec())
}

pub fn nfc_len(password: &str) -> usize {
    password.nfc().count()
}

/// PBKDF2-HMAC-SHA256, ein Block (32 Byte), wie in VaultCrypto.pbkdf2.
pub fn pbkdf2(password: &[u8], salt: &[u8], iterations: u32) -> Result<Zeroizing<Vec<u8>>> {
    if password.is_empty() || salt.is_empty() || iterations < 1 {
        return Err(Error::code("VAULT_UNAVAILABLE"));
    }
    let base = <Hmac<Sha256> as Mac>::new_from_slice(password).map_err(|_| Error::code("VAULT_UNAVAILABLE"))?;
    let mut mac = base.clone();
    mac.update(salt);
    mac.update(&[0, 0, 0, 1]);
    let mut u: Zeroizing<Vec<u8>> = Zeroizing::new(mac.finalize().into_bytes().to_vec());
    let mut result = Zeroizing::new(u.to_vec());
    for _ in 1..iterations {
        let mut mac = base.clone();
        mac.update(&u);
        u = Zeroizing::new(mac.finalize().into_bytes().to_vec());
        for (r, x) in result.iter_mut().zip(u.iter()) {
            *r ^= x;
        }
    }
    Ok(result)
}

fn cipher(key: &[u8]) -> Result<Aes256Gcm> {
    Aes256Gcm::new_from_slice(key).map_err(|_| Error::code("VAULT_UNAVAILABLE"))
}

pub fn seal(key: &[u8], plain: &[u8], aad: &[u8]) -> Result<Vec<u8>> {
    let nonce = random(NONCE);
    let sealed = cipher(key)?
        .encrypt(Nonce::from_slice(&nonce), Payload { msg: plain, aad })
        .map_err(|_| Error::code("VAULT_UNAVAILABLE"))?;
    let mut out = nonce;
    out.extend_from_slice(&sealed);
    Ok(out)
}

/// Fehler beim Öffnen sind "falscher Schlüssel oder verändert"; der Aufrufer
/// ordnet sie VAULT_PASSWORD bzw. VAULT_DAMAGED zu.
pub fn open(key: &[u8], sealed: &[u8], aad: &[u8]) -> std::result::Result<Zeroizing<Vec<u8>>, ()> {
    if sealed.len() < OVERHEAD {
        return Err(());
    }
    let c = Aes256Gcm::new_from_slice(key).map_err(|_| ())?;
    c.decrypt(Nonce::from_slice(&sealed[..NONCE]), Payload { msg: &sealed[NONCE..], aad })
        .map(Zeroizing::new)
        .map_err(|_| ())
}

fn key_aad(id: &str) -> Vec<u8> {
    format!("pbv1-key|{id}").into_bytes()
}

fn chunk_aad(header: &[u8], id: &str, index: u64, last: bool) -> Vec<u8> {
    let mut aad = Vec::with_capacity(header.len() + id.len() + 10);
    aad.extend_from_slice(header);
    aad.extend_from_slice(id.as_bytes());
    aad.push(0);
    aad.extend_from_slice(&(index as i64).to_be_bytes());
    aad.push(u8::from(last));
    aad
}

/// Klartextgröße aus der verschlüsselten Größe; unmögliche Längen sind beschädigt.
pub fn plain_size(encrypted: u64) -> Result<u64> {
    let full = (CHUNK + OVERHEAD) as u64;
    if encrypted < (HEADER + OVERHEAD) as u64 {
        return Err(Error::code("VAULT_DAMAGED"));
    }
    let body = encrypted - HEADER as u64;
    let (chunks, rest) = (body / full, body % full);
    if rest == 0 {
        return Ok(chunks * CHUNK as u64);
    }
    if rest < OVERHEAD as u64 {
        return Err(Error::code("VAULT_DAMAGED"));
    }
    Ok(chunks * CHUNK as u64 + rest - OVERHEAD as u64)
}

pub fn encrypted_size(plain: u64) -> u64 {
    let chunks = if plain == 0 { 1 } else { plain.div_ceil(CHUNK as u64) };
    HEADER as u64 + plain + chunks * OVERHEAD as u64
}

/// Schreibt Klartext stückweise. Erst `finish` schreibt das letzte Stück.
pub struct Writer<W: Write> {
    out: Option<W>,
    key: Zeroizing<Vec<u8>>,
    header: Vec<u8>,
    buffer: Zeroizing<Vec<u8>>,
    id: String,
    index: u64,
    size: u64,
    digest: Sha256,
}

impl<W: Write> Writer<W> {
    pub fn new(mut out: W, data_key: &[u8], id: &str) -> Result<Self> {
        let key = Zeroizing::new(random(KEY));
        let wrapped = seal(data_key, &key, &key_aad(id))?;
        let mut header = Vec::with_capacity(HEADER);
        header.extend_from_slice(MAGIC);
        header.push(1);
        header.extend_from_slice(&(CHUNK as i32).to_be_bytes());
        header.extend_from_slice(&wrapped);
        debug_assert_eq!(header.len(), HEADER);
        out.write_all(&header)?;
        Ok(Self { out: Some(out), key, header, buffer: Zeroizing::new(Vec::with_capacity(CHUNK)), id: id.to_owned(), index: 0, size: 0, digest: Sha256::new() })
    }

    pub fn write(&mut self, mut data: &[u8]) -> Result<()> {
        self.digest.update(data);
        self.size += data.len() as u64;
        while !data.is_empty() {
            // Ein volles Stück geht nur hinaus, wenn noch Daten folgen.
            if self.buffer.len() == CHUNK {
                self.emit(false)?;
            }
            let n = data.len().min(CHUNK - self.buffer.len());
            self.buffer.extend_from_slice(&data[..n]);
            data = &data[n..];
        }
        Ok(())
    }

    fn emit(&mut self, last: bool) -> Result<()> {
        let aad = chunk_aad(&self.header, &self.id, self.index, last);
        self.index += 1;
        let sealed = seal(&self.key, &self.buffer, &aad)?;
        self.out.as_mut().ok_or_else(|| Error::code("VAULT_UNAVAILABLE"))?.write_all(&sealed)?;
        self.buffer.zeroize();
        self.buffer.clear();
        Ok(())
    }

    /// Schließt ab und liefert (Klartextgröße, SHA-256 des Klartexts, Ausgabe).
    pub fn finish(mut self) -> Result<(u64, String, W)> {
        self.emit(true)?;
        let mut out = self.out.take().ok_or_else(|| Error::code("VAULT_UNAVAILABLE"))?;
        out.flush()?;
        let digest = hex(&std::mem::take(&mut self.digest).finalize());
        Ok((self.size, digest, out))
    }
}

/// Wahlfreier Lesezugriff.
pub struct Reader<R: Read + Seek> {
    input: R,
    key: Zeroizing<Vec<u8>>,
    header: Vec<u8>,
    id: String,
    chunks: u64,
    plain: u64,
}

impl<R: Read + Seek> Reader<R> {
    pub fn new(mut input: R, data_key: &[u8], id: &str) -> Result<Self> {
        let encrypted = input.seek(SeekFrom::End(0))?;
        let plain = plain_size(encrypted)?;
        let chunks = if plain == 0 { 1 } else { plain.div_ceil(CHUNK as u64) };
        let mut header = vec![0u8; HEADER];
        input.seek(SeekFrom::Start(0))?;
        input.read_exact(&mut header)?;
        if &header[..4] != MAGIC || header[4] != 1 || i32::from_be_bytes(header[5..9].try_into().unwrap()) != CHUNK as i32 {
            return Err(Error::code("VAULT_DAMAGED"));
        }
        let key = open(data_key, &header[9..9 + NONCE + KEY + TAG], &key_aad(id)).map_err(|_| Error::code("VAULT_DAMAGED"))?;
        Ok(Self { input, key, header, id: id.to_owned(), chunks, plain })
    }

    pub fn size(&self) -> u64 {
        self.plain
    }

    pub fn chunk(&mut self, index: u64) -> Result<Zeroizing<Vec<u8>>> {
        if index >= self.chunks {
            return Err(Error::code("INVALID_INPUT"));
        }
        let last = index == self.chunks - 1;
        let length = (if last { self.plain - index * CHUNK as u64 } else { CHUNK as u64 }) as usize + OVERHEAD;
        let mut sealed = vec![0u8; length];
        self.input.seek(SeekFrom::Start(HEADER as u64 + index * (CHUNK + OVERHEAD) as u64))?;
        self.input.read_exact(&mut sealed)?;
        open(&self.key, &sealed, &chunk_aad(&self.header, &self.id, index, last)).map_err(|_| Error::code("VAULT_DAMAGED"))
    }

    /// Höchstens ein Stück ab `offset`.
    pub fn read(&mut self, offset: u64, max: usize) -> Result<Vec<u8>> {
        if offset > self.plain {
            return Err(Error::code("INVALID_INPUT"));
        }
        if offset == self.plain {
            return Ok(Vec::new());
        }
        let index = offset / CHUNK as u64;
        let block = self.chunk(index)?;
        let start = (offset - index * CHUNK as u64) as usize;
        let n = max.min(block.len() - start);
        Ok(block[start..start + n].to_vec())
    }

    /// Alles lesen, mit Obergrenze (Index, Einstellungen).
    pub fn read_all(&mut self, limit: u64) -> Result<Zeroizing<Vec<u8>>> {
        if self.plain > limit {
            return Err(Error::code("VAULT_DAMAGED"));
        }
        let mut out = Zeroizing::new(Vec::with_capacity(self.plain as usize));
        for i in 0..self.chunks {
            out.extend_from_slice(&self.chunk(i)?);
        }
        Ok(out)
    }

    /// SHA-256 des gesamten Klartexts (prüft dabei jedes Stück).
    pub fn digest_hex(&mut self) -> Result<String> {
        let mut digest = Sha256::new();
        for i in 0..self.chunks {
            digest.update(&*self.chunk(i)?);
        }
        Ok(hex(&digest.finalize()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn sizes_round_trip() {
        for plain in [0u64, 1, CHUNK as u64 - 1, CHUNK as u64, CHUNK as u64 + 1, 3 * CHUNK as u64] {
            assert_eq!(plain_size(encrypted_size(plain)).unwrap(), plain);
        }
    }

    #[test]
    fn write_read_and_detect_tampering() {
        let key = random(32);
        for len in [0usize, 5, CHUNK, CHUNK + 7] {
            let data: Vec<u8> = (0..len).map(|i| (i * 31 % 251) as u8).collect();
            let mut w = Writer::new(Vec::new(), &key, "logisch").unwrap();
            w.write(&data).unwrap();
            let (size, digest, bytes) = w.finish().unwrap();
            assert_eq!(size as usize, len);
            assert_eq!(bytes.len() as u64, encrypted_size(len as u64));
            let mut r = Reader::new(Cursor::new(bytes.clone()), &key, "logisch").unwrap();
            assert_eq!(&*r.read_all(u64::MAX).unwrap(), &data[..]);
            assert_eq!(r.digest_hex().unwrap(), digest);
            assert!(Reader::new(Cursor::new(bytes.clone()), &key, "anderer-name").is_err());
            if len > 0 {
                let mut bad = bytes.clone();
                *bad.last_mut().unwrap() ^= 1;
                let mut r = Reader::new(Cursor::new(bad), &key, "logisch").unwrap();
                assert!(r.read_all(u64::MAX).is_err());
            }
        }
    }

    #[test]
    fn pbkdf2_rfc_vector() {
        // RFC 7914 §11: PBKDF2-HMAC-SHA256("passwd", "salt", 1)
        let out = pbkdf2(b"passwd", b"salt", 1).unwrap();
        assert_eq!(hex(&out), "55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc");
    }
}
