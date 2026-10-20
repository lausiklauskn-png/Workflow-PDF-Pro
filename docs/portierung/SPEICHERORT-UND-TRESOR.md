# Verbindliche Ergänzung: Speicherort und Dokumenttresor

Nutzerauftrag vom 20.10.2026: Wie bei Private Brain Pro sollen Dokumente und
App-Arbeitsdaten auf einer SD-Karte oder in einem ausdrücklich gewählten Ordner
gespeichert werden können. Das dortige Speicher-/Tresor-Grundgerüst wiederverwenden.
Dies ergänzt die vollständige 1:1-Übernahme; es erlaubt keine Kürzung der PDF-,
Übersetzungs- oder Schutzfunktionen. **Anforderung festgehalten, noch nicht eingebaut.**

### Gewählte Kombination nach Rücksprache

Klaus hat anschließend die Kombination beauftragt: **interne Datenbank plus
vollständig verschlüsselter Tresor, gewählter Ordner als hauptsächlicher
Datenspeicher**. Intern bleiben Bibliotheks-/Suchindex und nötige Arbeitskopien;
die dauerhaften Dokumente und wiederherstellbaren Arbeitsstände gehören in den
gewählten Tresor. Keine pauschale dauerhafte interne Zweitkopie sämtlicher PDFs
als fertige Auslagerung ausgeben. Ein Speichern darf erst nach erfolgreichem
Tresorschreiben als abgeschlossen gelten. Die Schnittstelle wird als separater
Adapter umgesetzt; der Quellkern bleibt unverändert. KI-Schlüssel verbleiben
wie bisher gerätelokal und werden nicht automatisch in den Tresor übertragen.

Zusätzliche Klarstellung von Klaus: **SD-Karte ist optional. Vollständiges Arbeiten
ohne SD-Karte muss möglich sein.** Ohne externe Speicherwahl bleibt der
Gerätespeicher nutzbar. Auch ein Tresorordner im Hauptspeicher muss wählbar sein.
Unter Windows einen Ordner auf dem Hauptrechner oder einem verfügbaren externen
Laufwerk anbieten; keine Android-SD-Annahme in gemeinsame Datenformate einbauen.
Ein nicht erreichbarer zuvor gewählter Tresor darf keinen stillen Datenreset oder
eine unbemerkte Umleitung in einen neuen leeren Speicher auslösen.

## Gewünschtes Verhalten

- In den Einstellungen Speicherort wählen/ändern: Gerätespeicher, SD-Karte oder
  anderer von Android angebotener Ordner. Einen eigenen Ordner „Workflow PDF Pro“
  anbieten. Nur die ausdrücklich erteilte Ordnerfreigabe verwenden und dauerhaft
  behalten; eine ausgeblendete Erklärung darf die erneute Auswahl nicht verhindern.
- Den gewählten Ordner für die dauerhafte verschlüsselte Ablage der Dokumente
  **und** Arbeitsdaten anbieten. Ein zusätzlicher PDF-Export allein erfüllt den
  Auftrag nicht. Tatsächlich extern gesicherte Inhalte und interne Kopien/
  Zwischenspeicher müssen erkennbar sein; keine vollständige Auslagerung behaupten,
  solange Dokumente zusätzlich dauerhaft intern liegen.
- Passwortgeschützter Tresor nach dem Vorbild der Referenz: native Passworteingabe,
  Sperren/Entsperren und optional auf diesem Gerät entsperrt halten. Passwort und
  Klartextschlüssel nicht an die Webseite oder in den Ordner schreiben. Einen
  vorhandenen eigenen Workflow-Tresor auf einem anderen Gerät mit Passwort öffnen
  und wiederherstellen können; fremde Private-Brain-Daten nicht übernehmen.
- Übernahme vorhandener App-Daten ausdrücklich anbieten. Bei Abbruch nichts
  verändern. Erst vollständig geschriebene und geprüfte Daten als gespeichert
  melden. Keine Quelldateien oder bestehenden Ordner still überschreiben/löschen.
- Bei gezogener SD-Karte, verlorener Freigabe, vollem Speicher, falschem Passwort
  oder beschädigten Dateien klare Meldung und erneute Freigabe anbieten; keine
  leere neue Bibliothek als erfolgreiche Wiederherstellung ausgeben.
- Ordnerwechsel, Wiederherstellung und App-Update müssen Originale, Felder,
  Originalverknüpfungen, Prüfstatus und Entfernungsvermerke erhalten. Vorhandene
  Dateien im alten Speicherort erst nach ausdrücklicher Entscheidung entfernen.
- Bestehende passwortverschlüsselte Workflow-Sicherungen weiter lesen und erzeugen.
  Der neue laufende Dokumenttresor ist ein eigener Speicherweg und ersetzt nicht
  still das vorhandene Sicherungsformat oder dessen gepinnten Schlüsseltresor.

## Tatsächlich gelesene Referenz

Repository `lausiklauskn-png/Privat-Brain-Pro`, gelesener `origin/main`:
`0937bc54a2fa58462a17ffe123757026a096925e`. Dateien direkt aus diesem Git-Stand
gelesen; dessen Checkout, Quellcode und Signierung nicht verändert.

- [Speicher-/Tresorbeschreibung](https://github.com/lausiklauskn-png/Privat-Brain-Pro/blob/0937bc54a2fa58462a17ffe123757026a096925e/docs/SPEICHERORT-UND-TRESOR.md)
- `android/app/src/main/java/de/familyprojekt/privatebrain/pro/ProVaultPlugin.java`:
  Storage Access Framework, dauerhafte Freigabe, Speicherwahl, Android-Passwortdialog.
- `Vault.java`: eigener Ordner, Passwortschlüssel und gerätegebundenes optionales
  Merken über Android Keystore, Übernahme/Wiederherstellung.
- `VaultCrypto.java`: PBV1, PBKDF2-HMAC-SHA256 mit 600.000 Runden,
  AES-256-GCM in 256-KiB-Stücken mit Bindung an Datei, Reihenfolge und Ende.
- `native/native-vault.js`: Einstellungen, Status, gebündelte Katalogsicherung
  und Wiederherstellung; Mail-/Anhangslogik ist Private-Brain-spezifisch.
- Vorhandene zu prüfende Tests: `VaultCryptoTest.java`, `NativeVaultTest.java`,
  `tools/native/test-vault.mjs`. Ihre bisherigen Ergebnisse sind **keine neu
  ausgeführten Workflow-PDF-Pro-Prüfungen**.

Die Referenz beschreibt zusätzliche verschlüsselte Originalkopien; Originale
bleiben auch intern. Der Katalog lässt bestimmte Modellvektoren aus. Es gibt
keine automatische Ordnersynchronisierung. Echte SD-Karte und zweites Gerät
sind dort als nicht gemessen bezeichnet. Diese Grenzen nicht als Erfüllung einer
vollständigen externen Workflow-Ablage übernehmen.

Bei der Quellinspektion fiel außerdem in `ProVaultPlugin.java:55–58` auf:
`vaultCode(Exception)` ruft sich für Nicht-`SecurityException` unmittelbar selbst
auf. Das ist ein durch Lesen erkannter Fehlerpfad, **kein ausgeführter Fehlertest**.
Vor einer Übernahme die Fehlerzuordnung korrigieren und gezielt prüfen; die
Referenz wird im Rahmen dieses Auftrags nicht geändert.

## Zuordnung zum unveränderten Workflow-Kern

`assets/db.js` verwendet `WorkflohPDF1`, Version 3, mit `folders`, `docs`, `files`,
`texte`, `vektoren`. `files` enthält auch aufgehobene Originalfotos und separate
`ue:*`-Übersetzungsstände. Einstellungen liegen in localStorage; freiwillig geladene
Modelle und Teilen-Zustände haben weitere Speicherwege.

Für den nativen Adapter vollständig inventarisieren und nachweisen:
Dokumentbytes, Originale, Ordner, Felder/Werte, Arbeitsstände, Übersetzungsfortschritt
und Teilergebnisse, Originalverknüpfungen, Prüfberichte und Entfernungsvermerke,
Seitentext/Suchzustände und Einstellungen. Für wiederherstellbare Caches/Modelle
den Speicherort und das Verhalten bei fehlenden Downloads ausdrücklich festhalten.
Keine Zustände wegen der engeren Private-Brain-Katalogsicherung still weglassen.

`assets/sicherung.js` sichert bisher nur Ordner, Dokumente/Felder, zugehörige PDFs
und Originalfotos; keine separaten Übersetzungsjobs, Seitentexte/Vektoren,
Einstellungen oder KI-Schlüssel. Nur diesen Export regelmäßig in einen Ordner
zu schreiben erfüllt daher keine vollständige laufende Ablage.

Vor dem Einbau sind die konkrete Anbindung an IndexedDB, konsistente gemeinsame
Schreibstände, interne Arbeitskopien und Rückübernahme mit Klaus anhand konkreter
Varianten zu besprechen. Die Speicherfunktion und Wiederverwendung des Grundgerüsts
sind beauftragt; damit ist keine beliebige Änderung des PDF-Kerns freigegeben.
API-Schlüssel nicht automatisch in eine Sicherung oder den neuen Dokumenttresor
übertragen. Ein geänderter Umgang damit benötigt eine eigene konkrete Abstimmung.

Workflow PDF Pro erhält eigene Ordner-/Tresorkennungen und neue eigene
Datenschlüssel. Keine Private-Brain-Passwörter, Keystore-Aliasse, Konten,
Mailadapter, Importgrößen oder Polnisch statt Arabisch übernehmen. Der Dokumenttresor
ist unabhängig von der vorhandenen dauerhaften APK-Signieridentität.

Android/DeX wird zuerst angebunden; Windows und iOS benötigen eigene Adapter für
Ordnerrechte und Geräteschlüsselspeicher. Ein Android-Tresor allein belegt diese
Plattformen nicht. Anforderungen und offene Nachweise: N001–N012 in der
[Funktionsmatrix](FUNKTIONSMATRIX.md). Hier wurden keine Tresor-/SD-Gerätetests ausgeführt.

## Begonnene Umsetzung im Android-Bauzweig

Getrennte Bausteine `DocumentVault`, `VaultLocations` und `ProVaultPlugin` sind
angelegt. Keine Auswahl bedeutet weiterhin interner Speicher; ein Ordnerwechsel
löscht die bisherigen Freigaben nicht. Die Tresordateien speichern relative
Dateinamen statt Android-Dokumentkennungen, damit eine Ordnerkopie auf einem
anderen Laufwerk und später auf einem anderen System geöffnet werden kann.
Gerätelokale Freigaben und optionale Keystore-Entsperrung bleiben davon getrennt.

Die Verschlüsselung und ihre fünf JVM-Gegenproben stammen aus dem oben genannten
Private-Brain-Stand; nur der Java-Paketname ist geändert, Lizenz liegt bei.
Diese fünf Prüfungen wurden jetzt für Workflow PDF Pro lokal erfolgreich
ausgeführt. Drei neue Datensatzprüfungen erhalten binäre Originale,
Übersetzungsstände und strukturierte Werte und lehnen beschädigte Umschläge ab.
Das ist noch **keine vollständige Speicheranbindung**: Java-Brücke, Einstellungen,
IndexedDB-Adapter und Wiederherstellung müssen gemeinsam eingebaut und geprüft
werden. Vorbereitete Android-SAF-/Keystore-Fälle sind getrennt zu protokollieren;
lokales Kompilieren belegt keinen Lauf auf echter SD-Karte oder unter Windows.
