# Merge-Regeln (gilt für alle Apps, Claude Code und Codex)

Stand 24.10.2026. Abgeleitet aus Fehlern, die in Kimhub (`forschung/sitzungen.json`) belegt sind.
Der Freibrief erlaubt Selbst-Merge. Er erlaubt keinen sinnlosen oder ungeprüften Merge.

## Vor jedem Merge

1. **Nutzen:** Der PR bringt Klaus oder dem Nutzer etwas: eine Funktion, eine Fehlerbehebung, einen
   Download mit Nachweis oder eine verbindliche Regel. Reine Zwischenstände, Statuszeilen und
   „Probe um Probe“ ohne Wirkung in der App werden gesammelt und mit dem nächsten inhaltlichen PR
   ausgeliefert, nicht einzeln gemergt.
2. **Nicht leer:** `git fetch origin <zweig>` und `git diff --stat origin/main origin/<zweig>` lesen.
   Leer heißt: nicht mergen. Push-Fehler nie mit `-q` oder `2>/dev/null` verstecken.
3. **Nichts Fremdes löschen:** Zeigt der Diff Löschungen, die nicht zur Arbeit gehören, liegt der Zweig
   hinter main. Erst main hereinholen, dann neu prüfen.
4. **Alle Prüfungen, nicht nur „betroffene“:** volle Prüfkette lokal und CI grün auf dem letzten Commit.
   Nie rot mergen.
5. **Keine Konfliktmarker** (`<<<<<<<`, `=======`, `>>>>>>>`) in irgendeiner Datei.
6. **Keine Doppelarbeit:** vorher offene PRs und Zweige der anderen Sitzungen und von Codex ansehen.
7. **Ein grüner Lauf beweist nur, was eine Probe fragt.** Blinde oder tote Wächter (sie laufen mit und
   messen nichts) sehen aus wie bestandene Prüfungen. Bei neuen Prüfungen eine Gegenprobe einbauen.

## Belegte Fälle

| Datum | Was geschah | Lehre |
|---|---|---|
| 14.09. | Sieben **leere PRs** gemergt: Push abgelehnt, Fehlermeldung unterdrückt | Regel 2 |
| 28.09. | Drei PRs mit 617 Zeilen Proben und Doku, **0 Zeilen in einer App**; Klaus: „im Kreis“ | Regel 1 |
| 11.09. | Ein Wächter war rot (862/863) und wurde **rot gemergt** | Regel 4 |
| 21.09. | main rot seit PR #214, den vollen Lauf fuhr niemand; 1119 Gegenproben lagen still | Regel 4 |
| 22.09. | **Konfliktmarker** in CLAUDE.md gemergt; 2900 Prüfungen grün, keine fragte danach | Regel 5, 7 |
| 12.10. | Rezeptbuch #425/#231: KI-Bild kaputt, Probe lief nicht („nur betroffene“) | Regel 4 |
| 05.09., 09.09., 22.09., 15.10., 16.10. | Zweig lag hinter main; ein Merge hätte 711 bis 92.224 Zeilen fremder Arbeit gelöscht. Gefangen am Diff | Regel 3 |
| 25.09. | Parallele Sitzung hatte dasselbe schon gemergt | Regel 6 |
| 08.09. | Alte Entwurfs-PRs waren überholt oder schädlich (Doku zurückgedreht, alte Krypto) | Regel 1, 3 |

Im Datensatz sind insgesamt 356 Befunde als blinder Wächter markiert (Stand 24.10.).
