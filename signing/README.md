# Eigene dauerhafte Android-Signieridentität

Der gemeinsame Ablauf für Claude Code und Codex steht in
[Signierung und GitHub](../docs/SIGNIERUNG-UND-GITHUB.md).

Hier sind ausschließlich vorgesehen:

- `android-release.enc.json`: AES-256-GCM-verschlüsselter eigener Keystore samt
  Passwort und Alias; authentifiziert an Format, App-Kennung und Zertifikat gebunden.
- `android-certificate.json`: öffentlicher SHA-256-Fingerabdruck für Updatekontinuität.

**Noch nicht initialisiert.** Kein produktiver Schlüssel liegt vor. Prüfschlüssel
werden nur in temporären Verzeichnissen erzeugt und anschließend entfernt.
Die getrennte Freigabe `WF_PDF_SIGNING_UNLOCK` gehört in das GitHub-Environment
`android-production` und in eine unabhängige sichere Sicherung, niemals ins Repo.
Bei vorhandener Identität `check` verwenden; nicht neu initialisieren.
