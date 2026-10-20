# Eigene dauerhafte Android-Signieridentität

Der gemeinsame Ablauf für Claude Code und Codex steht in
[Signierung und GitHub](../docs/SIGNIERUNG-UND-GITHUB.md).

Hier sind ausschließlich vorgesehen:

- `android-release.enc.json`: AES-256-GCM-verschlüsselter eigener Keystore samt
  Passwort und Alias; authentifiziert an Format, App-Kennung und Zertifikat gebunden.
- `android-certificate.json`: öffentlicher SHA-256-Fingerabdruck für Updatekontinuität.

**Initialisiert am 2026-10-20** (Lauf 39472967095, PR #3). Paket
`de.familyprojekt.workflowpdf.pro`, Zertifikat SHA-256
`0da805c9ad11ded86227fa4398e9237766f9f2d12bec66d65cb20309cbea3837`.
Ab jetzt nur noch `check`, nie wieder `initialize`. Prüfschlüssel der Tests
werden weiterhin nur in temporären Verzeichnissen erzeugt.
Die getrennte Freigabe `WF_PDF_SIGNING_UNLOCK` gehört in das GitHub-Environment
`android-production` und in eine unabhängige sichere Sicherung, niemals ins Repo.
Bei vorhandener Identität `check` verwenden; nicht neu initialisieren.
