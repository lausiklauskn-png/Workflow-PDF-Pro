# Gemeinsamer Pro-Tresor: native Anbindung

`WorkflowVault.tresorVerbinden` verbindet einen vorhandenen gemeinsamen Tresor,
ohne die eigene Workflow-Bibliothek einzurichten oder umzuziehen. Android verwendet
die vorhandene dauerhafte Ordnerfreigabe. Windows verwendet einen nativen
Ordnerdialog und das unveränderte Java-Paket `de.familyprojekt.tresor` in einer
eigenen gebündelten Laufzeit. Ein zusätzlich installiertes Java ist nicht nötig.
Der bestehende Android-Einzug bleibt ein getrennter, ausdrücklich gewählter Schritt.
Ein Einzug der eigenen Windows-Ablage ist hier nicht eingeführt.

Ordnerkennung und Ort gehören zusammen. Jeder Dateizugriff prüft die Kennung und
einen vorhandenen Umzugsvermerk erneut. Ein entfernter oder ausgetauschter Ordner
erzeugt keinen Ersatzbestand. Eine beschädigte Windows-Verbindungseinstellung
bleibt sichtbar und wird bei ausdrücklichem Neuverbinden als beschädigte Kopie
erhalten. Änderungen der Verbindung werden atomar gespeichert.

Passwörter werden in einem eigenen nativen Dialog eingegeben. Unter Windows
transportieren private Prozess-Pipes die Daten zur gebündelten Java-Engine;
die Haupt-Webseite, Befehlszeile und Netzwerkports erhalten keine Kennwörter.
„Auf diesem Gerät entsperrt halten“ verwendet Android Keystore beziehungsweise
Windows DPAPI, gebunden an App und Tresorkennung. Manuelles Sperren verhindert
automatisches Entsperren bis zu einer ausdrücklichen Öffnung oder einem App-Neustart.
„Vergessen“ entfernt den gemerkten Schlüssel dauerhaft; Schreibfehler werden gemeldet.

Der gemeinsame Adapter `ProVerbund.java` verwendet auf beiden Plattformen dieselben
kanonischen Übergaben. `tresorUebergabe` verlangt immer `vaultId` und eine Aktion:

| Aktion | Verhalten |
| --- | --- |
| `eingang` | Offene Übergaben für Workflow PDF Pro, ohne Originalbytes |
| `lesen` | Vertrag und Original nach Prüfung von Größe und SHA-256, noch keine Marke |
| `quittieren` | Erwartete Prüfsumme erneut prüfen und eigene Empfängermarke setzen |
| `senden` | Gewählte Datei bis 20 MiB, stabile Kennung, Quelle/Ziel und optionaler Bezug |
| `stand` | Ausschließlich die tatsächliche Marke der adressierten Ziel-App auswerten |

Wiederholtes Senden derselben Fassung ergibt denselben Eintrag. Eine andere Datei
oder andere Metadaten unter derselben Kennung werden abgelehnt. Originale im
Übergabefach werden nicht gelöscht. Fachverzeichnisse sind über `tresorFach` lesbar;
das macht fremde app-eigene Originalformate nicht automatisch lesbar.

Diese Ausbaustufe stellt die native Verbindung bereit. Die gemeinsame Bedienung
zum Verbinden, Annehmen und Senden über den normalen Workflow-Import wird darauf
aufgebaut. Die Windows-Brückenproben verwenden einen kanonischen Familienakte-
Akteur und ausdrücklich aufgerufene native Methoden. Sie sind kein Nachweis für
zwei installierte Endbenutzer-Apps. Der normale dauerhafte Betriebssystem-Eingang
ist getrennt in [PRO-EINGANG.md](PRO-EINGANG.md) beschrieben. Releases und Geschenk-
Downloads folgen erst nach der vollständigen übergreifenden Umsetzung.
