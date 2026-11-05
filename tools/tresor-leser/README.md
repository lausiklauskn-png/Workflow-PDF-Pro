# Tresor-Leser (Entwurf, Klaus 2026-11-04)

Eine HTML-Datei (`tresor-leser.html`), die neben dem Tresor auf SD-Karte oder USB-Stick liegen kann und den gemeinsamen
Pro-Tresor (Format `familyprojekt-tresorordner/1`, Schloss PBV1) in jedem Browser öffnet: ohne Installation, ohne Internet,
**nur lesend**. Tresor-Ordner wählen → Passwort → Dokumente je Fach ansehen oder einzeln herunterladen.

- Rechnung Schritt für Schritt wie `TresorOrdner.java`/`VaultCrypto.java`: PBKDF2-HMAC-SHA256 (Runden aus dem Platz), AES-256-GCM
  mit denselben gebundenen Daten, Prüfwert (HMAC) gegen den Kopf, Fach-Schlüssel, neuester Stand des Inhaltsverzeichnisses je
  Schreiber, Datei Block für Block (256 KiB), SHA-256 gegen den Eintrag.
- Kein Netz: Content-Security-Policy `default-src 'none'`; Entschlüsseltes nur als `blob:` im Arbeitsspeicher. „Sperren“ und
  Schließen verwerfen die Schlüssel.
- Ein Browser kann in einen gewählten Ordner nicht schreiben – der Tresor bleibt unverändert (gemessen über Prüfsummen).

**Nicht:** Ersatzschlüssel (nur Passwort) · Dateien im App-Format (`verschluesselung: app`, z. B. Mails von Private Brain Pro) – nur
als Zeile · Ordnerwahl fehlt in manchen Handy-Browsern.

Probe: `WFP_CHROMIUM=… node --test tools/tresor-leser/test-tresor-leser.mjs` (braucht javac/java; baut mit `Testtresor.java` einen echten
Testtresor aus dem Paket) – 12 grün. Gegenprobe von Hand 3/3 gefangen (Block-Bindung, `hidden`, Prüfwert; der Prüfwert-Fall war
zuerst blind und hat jetzt eine eigene Probe). Nicht geprüft: echte SD-Karte, Tablet, Klaus' Tresor. Noch nicht in einer App
verdrahtet (kein Ablegen neben den Tresor) – erst nach Klaus' Ja zur Vorschau.
