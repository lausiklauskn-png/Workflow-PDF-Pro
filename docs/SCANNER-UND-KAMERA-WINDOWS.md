# Scanner und Kamera unter Windows (Pro-Umbau 5, Klaus 2026-10-28)

Klaus: „Es sind aber Scanner angeschlossen … diese Scanner können ausgewählt werden … es kann auch sein, dass welche mit Kamera scannen.“
Gemeinsamer Baustein aller Pro-Apps, **hier gepflegt** (Klaus' Wahl), byte-gleich nach BookLedgerPro (später Private Brain Pro):

| Datei | Was |
|---|---|
| `native/pro-scanner.js` / `.css` | Auswahlfenster „Scanner oder Kamera“, hängt einen Knopf ins Scan-Fenster des Kerns (Kern unverändert), gibt die Bilder an `WFP.Scanner.hinzu` |
| `windows/scanner/scanner.rs` | Plugin `ProScanner` (`geraete`, `scannen`) für jede Tauri-Hülle; prüft alle Werte der Seite |
| `windows/scanner/wia.ps1` | Windows-WIA (USB, WLAN/Netz, treiberlos): Geräte, Vorlage Glas/Einzug, 150–600 dpi, Farbe/Grau/Schwarzweiß, Einzug bis 100 Blätter; Auftrag nur als Base64-JSON |
| `windows/scanner/test-wia.mjs`, `tools/native/test-pro-scanner.mjs` | Proben (echtes Windows ohne Scanner; Chromium mit Prüfkamera) |

Pins: `native/pro-scanner-herkunft.json` (`node tools/native/scanner-pins.mjs --schreiben` nach jeder Änderung).

**Bedienung:** Scannen öffnen → „Scanner oder Kamera …“ → Gerät wählen (die letzte Wahl bleibt) → „Scannen“ (Scanner) oder Livebild und
„Seite aufnehmen“, dann „Fertig“ (Kamera). Die Seiten landen im gewohnten Scan-Fenster: Blatt finden, entzerren, PDF.
Digitalkamera per USB: erscheint sie als Webcam, gilt „Kamera“; meldet sie sich über WIA, holt „Fotos holen“ die neuesten 30 Aufnahmen.

**Grenzen:** Kein echter Scanner gemessen (der GitHub-Rechner hat keinen; dort nur Syntax, Antwortform und „Gerät fehlt“). Scanner, die nur
TWAIN können, sieht WIA nicht. Unter Android und in der PWA tut der Baustein nichts (dort Kamera wie bisher).
