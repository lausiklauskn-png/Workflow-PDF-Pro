//! Nachbau von `VaultLocations.java`: gerätelokale Liste der Tresorordner,
//! unabhängig vom übertragbaren verschlüsselten Format. Ohne gewählten Ordner
//! bleibt die interne Datenbank die Ablage. Ein Wechsel der Hauptablage löscht
//! nie die Zugänge, die ältere Verweise brauchen.

use crate::error::{Error, Result};
use crate::prefs::Prefs;
use crate::vault::DocumentVault;
use crate::DeviceProtect;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;

const NAMESPACE: &str = "workflow-vault-locations-v1";

pub struct VaultLocations {
    dir: PathBuf,
    cache: PathBuf,
    device: Arc<dyn DeviceProtect>,
    prefs: Prefs,
    locations: BTreeMap<String, DocumentVault>,
}

fn valid(id: &str) -> bool {
    id.len() == 64 && id.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}

fn storage(id: &str) -> String {
    format!("{NAMESPACE}-{id}")
}

impl VaultLocations {
    pub fn new(dir: &Path, cache: &Path, device: Arc<dyn DeviceProtect>) -> Result<Self> {
        let prefs = Prefs::open(dir, NAMESPACE)?;
        let mut locations = BTreeMap::new();
        for id in prefs.strings("locations").into_iter().collect::<HashSet<_>>() {
            if valid(&id) {
                locations.insert(id.clone(), DocumentVault::new(dir, &storage(&id), cache, device.clone())?);
            }
        }
        Ok(Self { dir: dir.to_owned(), cache: cache.to_owned(), device, prefs, locations })
    }

    pub fn primary(&self) -> Option<String> {
        self.prefs.string("primary")
    }

    pub fn migration(&self) -> Option<String> {
        self.prefs.string("migration")
    }

    pub fn prepare_migration(&mut self, id: &str) -> Result<()> {
        self.ensure_idle()?;
        if !self.get(Some(id))?.state()["unlocked"].as_bool().unwrap_or(false) {
            return Err(Error::code("VAULT_LOCKED"));
        }
        if let Some(previous) = self.migration() {
            if previous != id {
                return Err(Error::code("VAULT_BUSY"));
            }
        }
        let id = id.to_owned();
        self.prefs.commit(|m| {
            m.insert("migration".into(), json!(id));
        }).map_err(|_| Error::code("VAULT_UNAVAILABLE"))
    }

    pub fn cancel_migration(&mut self) -> Result<()> {
        self.ensure_idle()?;
        self.prefs.commit(|m| {
            m.remove("migration");
        }).map_err(|_| Error::code("VAULT_UNAVAILABLE"))
    }

    pub fn complete_migration(&mut self, id: &str) -> Result<()> {
        self.ensure_idle()?;
        if self.migration().as_deref() != Some(id) || !self.get(Some(id))?.state()["unlocked"].as_bool().unwrap_or(false) {
            return Err(Error::code("VAULT_RECOVERY_REQUIRED"));
        }
        let id = id.to_owned();
        self.prefs.commit(|m| {
            m.insert("primary".into(), json!(id));
            m.remove("migration");
        }).map_err(|_| Error::code("VAULT_UNAVAILABLE"))
    }

    pub fn candidate(&self) -> Result<DocumentVault> {
        DocumentVault::new(&self.dir, &format!("{NAMESPACE}-candidate-{}", uuid::Uuid::new_v4()), &self.cache, self.device.clone())
    }

    pub fn get(&mut self, requested: Option<&str>) -> Result<&mut DocumentVault> {
        let id = match requested {
            Some(id) => id.to_owned(),
            None => self.primary().ok_or_else(|| Error::code("VAULT_NOT_CONFIGURED"))?,
        };
        self.locations.get_mut(&id).ok_or_else(|| Error::code("VAULT_LOCATION_UNAVAILABLE"))
    }

    pub fn ensure_idle(&self) -> Result<()> {
        if self.locations.values().any(|v| v.transferring()) {
            return Err(Error::code("VAULT_BUSY"));
        }
        Ok(())
    }

    pub fn adopt(&mut self, mut candidate: DocumentVault) -> Result<String> {
        self.ensure_idle()?;
        if !candidate.configured() {
            return Err(Error::code("VAULT_NOT_CONFIGURED"));
        }
        let id = candidate.location_id();
        candidate.rehome(&storage(&id))?;
        let mut next: Vec<String> = self.locations.keys().cloned().collect();
        if !next.contains(&id) {
            next.push(id.clone());
        }
        next.sort();
        self.prefs.commit(|m| {
            m.insert("locations".into(), json!(next));
        }).map_err(|_| Error::code("VAULT_UNAVAILABLE"))?;
        if let Some(mut previous) = self.locations.insert(id.clone(), candidate) {
            previous.close_working();
        }
        Ok(id)
    }

    pub fn state(&mut self, requested: Option<&str>) -> Result<Value> {
        let id = match requested.map(str::to_owned).or_else(|| self.primary()) {
            Some(id) => id,
            None => return Ok(json!({"configured": false, "internal": true})),
        };
        let primary = self.primary();
        let mut state = self.get(Some(&id))?.state();
        state["location"] = json!(id);
        state["primary"] = json!(primary.as_deref() == Some(id.as_str()));
        Ok(state)
    }

    pub fn list(&mut self) -> Result<Vec<Value>> {
        let ids: Vec<String> = self.locations.keys().cloned().collect();
        ids.iter().map(|id| self.state(Some(id))).collect()
    }

    pub fn select(&mut self, id: Option<&str>) -> Result<()> {
        self.ensure_idle()?;
        if let Some(id) = id {
            if !self.get(Some(id))?.state()["unlocked"].as_bool().unwrap_or(false) {
                return Err(Error::code("VAULT_LOCKED"));
            }
        }
        let id = id.map(str::to_owned);
        self.prefs.commit(|m| match id {
            Some(id) => {
                m.insert("primary".into(), json!(id));
            }
            None => {
                m.remove("primary");
            }
        }).map_err(|_| Error::code("VAULT_UNAVAILABLE"))
    }

    pub fn lock(&mut self) -> Result<()> {
        let mut failure = None;
        for vault in self.locations.values_mut() {
            if let Err(error) = vault.lock() {
                failure = Some(error);
            }
        }
        failure.map_or(Ok(()), Err)
    }

    pub fn close(&mut self) {
        for vault in self.locations.values_mut() {
            vault.close_working();
        }
    }
}
