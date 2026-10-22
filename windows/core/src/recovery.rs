//! Ersatzschlüssel für den Dokumenttresor: Shamir-Aufteilung (Standard 5 Teile,
//! 3 genügen) eines zufälligen 256-Bit-Wiederherstellungsschlüssels.
//!
//! Der Wiederherstellungsschlüssel umhüllt den Datenschlüssel des Tresors in einer
//! eigenen Datei `workflow-pdf-pro.ersatz-<satz>.json`. Mit genug Teilen lässt sich
//! der Datenschlüssel öffnen und ein neues Passwort setzen, ohne den bestehenden
//! Tresorkopf zu verändern. Gleiches Format unter Android (`VaultRecovery.java`).
//!
//! Teil (zum Ausdrucken/Abtippen):
//!   `WFP1-` + Crockford-Base32 von [Version 1][Satz 4 Byte][Schwelle k][Index x][32 Byte][Prüfung 2 Byte],
//!   in Fünfergruppen mit Bindestrichen. Groß/klein, Leerzeichen und O/0, I/L/1 werden toleriert.

use crate::crypto::random;
use crate::error::{Error, Result};
use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

pub const SECRET: usize = 32;
pub const DEFAULT_N: u8 = 5;
pub const DEFAULT_K: u8 = 3;
const PREFIX: &str = "WFP1";
const VERSION: u8 = 1;
const ALPHABET: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/// GF(2^8) mit dem AES-Polynom 0x11B und Erzeuger 3 (wie Private Brain Pro).
struct Gf {
    exp: [u8; 512],
    log: [u8; 256],
}

fn gf() -> &'static Gf {
    static TABLES: std::sync::OnceLock<Gf> = std::sync::OnceLock::new();
    TABLES.get_or_init(|| {
        let mut t = Gf { exp: [0; 512], log: [0; 256] };
        let mut x: u8 = 1;
        for i in 0..255 {
            t.exp[i] = x;
            t.log[x as usize] = i as u8;
            // x * 3 = x * 2 ^ x
            let hi = x & 0x80;
            let mut two = x << 1;
            if hi != 0 {
                two ^= 0x1b;
            }
            x = two ^ x;
        }
        for i in 255..512 {
            t.exp[i] = t.exp[i - 255];
        }
        t
    })
}

fn mul(a: u8, b: u8) -> u8 {
    if a == 0 || b == 0 {
        return 0;
    }
    let t = gf();
    t.exp[t.log[a as usize] as usize + t.log[b as usize] as usize]
}

fn inv(a: u8) -> u8 {
    let t = gf();
    t.exp[255 - t.log[a as usize] as usize]
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Share {
    pub set: [u8; 4],
    pub k: u8,
    pub x: u8,
    pub data: Vec<u8>,
}

/// Teilt `secret` in `n` Teile mit Schwelle `k`.
pub fn split(secret: &[u8], set: [u8; 4], n: u8, k: u8) -> Result<Vec<Share>> {
    if k < 2 || n < k {
        return Err(Error::code("VAULT_RECOVERY_INVALID"));
    }
    let mut shares: Vec<Share> = (1..=n).map(|x| Share { set, k, x, data: vec![0; secret.len()] }).collect();
    for (i, &byte) in secret.iter().enumerate() {
        let mut coeffs = Zeroizing::new(random(k as usize));
        coeffs[0] = byte;
        for share in shares.iter_mut() {
            let mut y = 0u8;
            for d in (0..k as usize).rev() {
                y = mul(y, share.x) ^ coeffs[d];
            }
            share.data[i] = y;
        }
    }
    Ok(shares)
}

/// Setzt das Geheimnis aus mindestens `k` Teilen desselben Satzes zusammen.
pub fn combine(shares: &[Share]) -> Result<Zeroizing<Vec<u8>>> {
    let first = shares.first().ok_or_else(|| Error::code("VAULT_RECOVERY_INCOMPLETE"))?;
    let mut seen = std::collections::HashSet::new();
    for s in shares {
        if s.set != first.set || s.k != first.k || s.data.len() != first.data.len() || s.x == 0 {
            return Err(Error::code("VAULT_RECOVERY_MIXED"));
        }
        if !seen.insert(s.x) {
            return Err(Error::code("VAULT_RECOVERY_DUPLICATE"));
        }
    }
    if shares.len() < first.k as usize {
        return Err(Error::code("VAULT_RECOVERY_INCOMPLETE"));
    }
    let used = &shares[..first.k as usize];
    let mut out = Zeroizing::new(vec![0u8; first.data.len()]);
    for (b, slot) in out.iter_mut().enumerate() {
        let mut acc = 0u8;
        for (i, si) in used.iter().enumerate() {
            let (mut num, mut den) = (1u8, 1u8);
            for (j, sj) in used.iter().enumerate() {
                if i != j {
                    num = mul(num, sj.x);
                    den = mul(den, sj.x ^ si.x);
                }
            }
            acc ^= mul(si.data[b], mul(num, inv(den)));
        }
        *slot = acc;
    }
    Ok(out)
}

fn base32(bytes: &[u8]) -> String {
    let mut out = String::new();
    let (mut buffer, mut bits) = (0u32, 0u32);
    for &b in bytes {
        buffer = (buffer << 8) | b as u32;
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            out.push(ALPHABET[((buffer >> bits) & 31) as usize] as char);
        }
    }
    if bits > 0 {
        out.push(ALPHABET[((buffer << (5 - bits)) & 31) as usize] as char);
    }
    out
}

fn unbase32(text: &str) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    let (mut buffer, mut bits) = (0u32, 0u32);
    for c in text.chars() {
        let c = match c.to_ascii_uppercase() {
            'O' => '0',
            'I' | 'L' => '1',
            other => other,
        };
        let v = ALPHABET.iter().position(|&a| a as char == c)? as u32;
        buffer = (buffer << 5) | v;
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            out.push((buffer >> bits) as u8);
        }
    }
    Some(out)
}

fn checksum(payload: &[u8]) -> [u8; 2] {
    let d = Sha256::digest(payload);
    [d[0], d[1]]
}

pub fn encode(share: &Share) -> String {
    let mut payload = vec![VERSION];
    payload.extend_from_slice(&share.set);
    payload.push(share.k);
    payload.push(share.x);
    payload.extend_from_slice(&share.data);
    let check = checksum(&payload);
    payload.extend_from_slice(&check);
    let body = base32(&payload);
    let groups: Vec<String> = body.as_bytes().chunks(5).map(|c| String::from_utf8_lossy(c).into_owned()).collect();
    format!("{PREFIX}-{}", groups.join("-"))
}

/// Liest einen abgetippten Teil. Tippfehler werden über die Prüfsumme erkannt.
pub fn decode(text: &str) -> Result<Share> {
    let cleaned: String = text.chars().filter(|c| !c.is_whitespace() && *c != '-').collect::<String>().to_ascii_uppercase();
    let body = cleaned.strip_prefix(PREFIX).ok_or_else(|| Error::code("VAULT_RECOVERY_TYPO"))?;
    let bytes = unbase32(body).ok_or_else(|| Error::code("VAULT_RECOVERY_TYPO"))?;
    if bytes.len() != 1 + 4 + 1 + 1 + SECRET + 2 || bytes[0] != VERSION {
        return Err(Error::code("VAULT_RECOVERY_TYPO"));
    }
    let (payload, check) = bytes.split_at(bytes.len() - 2);
    if checksum(payload) != [check[0], check[1]] {
        return Err(Error::code("VAULT_RECOVERY_TYPO"));
    }
    let share = Share { set: payload[1..5].try_into().unwrap(), k: payload[5], x: payload[6], data: payload[7..].to_vec() };
    if share.k < 2 || share.x == 0 {
        return Err(Error::code("VAULT_RECOVERY_TYPO"));
    }
    Ok(share)
}

pub fn set_hex(set: &[u8; 4]) -> String {
    crate::crypto::hex(set)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_three_of_five_restore_and_two_do_not() {
        let secret = random(SECRET);
        let shares = split(&secret, [1, 2, 3, 4], 5, 3).unwrap();
        let mut combos = 0;
        for a in 0..5 {
            for b in a + 1..5 {
                for c in b + 1..5 {
                    let picked = vec![shares[a].clone(), shares[b].clone(), shares[c].clone()];
                    assert_eq!(&*combine(&picked).unwrap(), &secret[..]);
                    combos += 1;
                }
            }
        }
        assert_eq!(combos, 10);
        assert_eq!(combine(&shares[..2]).unwrap_err().vault_code(), "VAULT_RECOVERY_INCOMPLETE");
        // Zwei Teile verraten nichts Brauchbares: Ergebnis ist nicht das Geheimnis.
        let mut fake = shares[..2].to_vec();
        fake.push(Share { x: 9, ..shares[0].clone() });
        assert_ne!(&*combine(&fake).unwrap(), &secret[..]);
    }

    #[test]
    fn encoding_round_trip_and_typos() {
        let shares = split(&random(SECRET), [0xde, 0xad, 0xbe, 0xef], 5, 3).unwrap();
        for s in &shares {
            let text = encode(s);
            assert!(text.starts_with("WFP1-"));
            assert_eq!(&decode(&text).unwrap(), s);
            // Kleinbuchstaben, Leerzeichen statt Bindestriche, O statt 0 werden toleriert.
            let sloppy = text.to_lowercase().replace('-', " ").replace('0', "o");
            assert_eq!(&decode(&sloppy).unwrap(), s);
            // Ein falsch abgetipptes Zeichen wird erkannt.
            let mut chars: Vec<char> = text.chars().collect();
            let i = 12;
            chars[i] = if chars[i] == 'A' { 'B' } else { 'A' };
            assert!(decode(&chars.into_iter().collect::<String>()).is_err());
        }
        let other = split(&random(SECRET), [9, 9, 9, 9], 5, 3).unwrap();
        assert_eq!(combine(&[shares[0].clone(), shares[1].clone(), other[2].clone()]).unwrap_err().vault_code(), "VAULT_RECOVERY_MIXED");
        assert_eq!(combine(&[shares[0].clone(), shares[0].clone(), shares[1].clone()]).unwrap_err().vault_code(), "VAULT_RECOVERY_DUPLICATE");
    }
}
