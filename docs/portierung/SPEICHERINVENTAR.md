# Speicherzuordnung für die noch offene Tresoranbindung

21.10.2026, statisch am unveränderten Quellcommit
`7227c543d4a536cf8f3354a56fbba7574645703e` gelesen. Dies ist eine
Implementierungsgrundlage, keine bereits ausgeführte Migration oder Freigabe.
Die gewählte Kombination bleibt interne Arbeitsdatenbank plus verschlüsselter
Ordner als hauptsächliche dauerhafte Ablage. Die konkrete Wiederanlaufkopplung
wurde am 21.10.2026 als verschlüsseltes Wiederanlaufjournal ausdrücklich gewählt;
noch nicht an die laufende App angebunden. Protokoll-/DB-Bausteine liegen unter
`native/vault-journal.js` und `native/vault-db.js`; aktuelle Prüfgrenzen siehe
`BAUSTAND-ANDROID.md`.

| Bestand | Quellstelle | Erhaltung / Grenze der künftigen Anbindung |
|---|---|---|
| `WorkflohPDF1` v3, `folders` | `assets/db.js:17–26` | vollständige Ordnerobjekte einschließlich `bereich`, `quelle`, `ziele`; Kennungen und Verknüpfungen erhalten |
| `docs` | `assets/app.js:909`, `:1309`, `:2604–2637` | Metadaten, Felder/Werte, Vorschläge, Vorschaubild, Seitenmatrizen, Prüfstatus, `kiEntfernt`, Übersetzungs-/Teil-/Originalverknüpfungen vollständig; kein engerer JSON-Feldfilter |
| `files`, normale Dokumentkennung | `assets/db.js:67–68` | binäre PDF-Bytes; interner Index darf später nur bestätigte Tresorreferenzen enthalten, keine pauschale dauerhafte PDF-Zweitkopie |
| `files`, `<id>~original` | `assets/app.js:920`, `:934` | Originalfoto samt Namen und Bytes bis zur Prüfung erhalten; Ersetzen und Löschen nehmen es gemäß bestehendem Vertrag mit |
| `files`, `ue:<id>:<von>-<nach>[:rueck]` | `assets/app.js:2051`, `:2585`, `:2631` | strukturiertes `job`-Objekt, keine PDF-Datei; Seiten-/Teilfortschritt separat sichern. Fehler beim Lesen nicht als sicher fehlenden Job behandeln |
| `texte` | `assets/db.js:49–50`, `assets/app.js:605` | interner Wortsuchindex; beim Dateiersatz/-löschen invalidieren; wiederherstellbar/reproduzierbar, aber keine falschen Suchtreffer aus alten Bytes |
| `vektoren` | `assets/db.js:48–50` | Kopf und alle `<id>#…`-Blöcke zusammen invalidieren; fertige Blöcke für Wiederaufnahme erhalten; große Daten stückweise verarbeiten |
| `wfpdf_einst_v1` | `assets/app.js:32–38` | `anbieter`, `modell`, `uebModell`, `linien`, `sortierung`, `bedeutung`, `bedMsStueck`, `ueVon`, `ueNach`, `ueRueck`, `ueBilder`, `ueMsSeite` explizit zuordnen; keine pauschale Objektübernahme |
| `schluessel` innerhalb derselben Einstellung | `assets/app.js:33`, `:2847` | gerätelokale API-Schlüssel; niemals automatisch exportieren. Keine echten Schlüssel für die Inventur gelesen |
| `kiOk` innerhalb derselben Einstellung | `assets/app.js:2430` | anbieterbezogene externe Einwilligungen; bei Geräteübernahme nicht ungefragt als neue Zustimmung behandeln |
| `wfpdf_scan_v1` | `assets/scanner.js:19–21` | Scannerpräferenzen einschließlich Filter, Format, Qualität, Durchsuchbarkeit und Sprache explizit übernehmen; keine Dokument-/Modellannahmen daraus ableiten |
| `wfpdf_sprache_v1` | `assets/sprache.js:24`, `:299` | `lang` und `tipps`, DE/EN/RU/AR einschließlich RTL erhalten |
| `wfpdf_sicherung_zuletzt` | `assets/app.js:2710`, `:2776` | Zeitstempel einer tatsächlich erstellten alten Sicherung; Tresorschreiben darf ihn nicht als neue alte Sicherung umdeuten |
| `wfpdf_sicherung_spaeter` | `assets/app.js:2710–2739` | nur sessionStorage; kein dauerhafter Wiederherstellungszustand |
| `workfloh-pdf-v103` | `sw.js:5`, `:17–29` | Shell-/Laufzeitcache; bereits mitgeführte OCR-, Scanic-, Schrift-/Workerdateien aus dem lokalen Bundle wieder verfügbar machen; keine Dokumente daraus inventarisieren |
| `workfloh-pdf-modell-v1`, `transformers-cache` | `sw.js:10–16`, `vendor/sbkim/03_embedding.js:87` | freiwillige Modell-/Programmdownloads; intern gerätebezogen behalten, keine Schlüssel. Nach Gerätewechsel muss fehlendes Modell sichtbar sein; vorhandene Offlinefähigkeit nicht still verlieren |
| `workfloh-pdf-geteilt` | `sw.js:15`, `:53–65`, `assets/app.js:3109–3127` | noch nicht abgeholte Eingangsdokumente, kein austauschbarer Modellcache! Nicht beim Tresorwechsel löschen oder als schon importiert quittieren |
| SBKIM-IndexedDB / localStorage | `sbkim/01_storage.js`, `23_rendezvous*.js`, `assets/sbkim-init.js:46` | eigener Speicherbereich, Geräteidentität, Netzcode, ausstehende Netzvorgänge und Geräteeinstellungen. Nicht durch pauschales Kopieren sämtlicher IndexedDB/localStorage-Daten in einen Dokumenttresor übertragen; getrennte Portierungs-/Geräteprüfung bleibt nötig |
| Android-Freigaben und gemerkte Entsperrung | `VaultLocations`, `DocumentVault` | gerätebezogen; übertragbarer Tresor benutzt relative Dateinamen und Passwort. Freigabe-/Keystorezustand ist kein plattformübergreifender Tresorinhalt |

## Besonders zu prüfen

- Der bestehende `WFP.DB`-Vertrag ist asynchron; `putFile` invalidiert Text und
  Vektoren, `del('files', id)` zusätzlich das Originalfoto. Ein Adapter muss diese
  Seiteneffekte erhalten, nicht nur `get` und `put` ersetzen.
- Der Quellkern erfasst `DB` beim Laden von `app.js`. Ein nachträglich vollständig
  ausgetauschtes `WFP.DB`-Objekt würde diese Referenz nicht automatisch ersetzen.
  Die Einbindung muss vor der Erfassung bereitstehen oder dieselben Methoden
  kontrolliert anbinden. Keine ungeprüfte Textänderung im Quellkern.
- `jobLesen` fängt Lesefehler ab und gibt `null` zurück. Fehlende Freigabe ist
  daher vor einem Lauf sichtbar zu sperren; niemals über diesen Fehlerpfad
  bestehende Übersetzungsstände mit einem leeren neuen Job überschreiben.
- Das alte Sicherungsformat sichert keine separaten Übersetzungsjobs,
  Einstellungen, Text-/Vektorindices oder Netzspeicher. Es bleibt kompatibel und
  darf nicht als vollständiger Tresorersatz bezeichnet werden.
- Das Einverständnis zur Speicherarchitektur erlaubt keine automatische
  Übertragung von API-Schlüsseln, SBKIM-Schlüsseln oder Netzbeitrittscodes.
  Bei neuen/unklaren Schlüsseln im Bestand ausdrücklich zuordnen statt sie
  ungeprüft per Wildcard einzuschließen.
