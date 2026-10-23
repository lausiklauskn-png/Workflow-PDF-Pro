# Abschluss: Produktstand, Gleichstandsregel, gekürzte Startdateien, Codex-Arbeit in Kimhub nachgetragen

**Sitzung:** Claude Code, `session_01HPcxRUAQ4njoMSMPSUhGae`, 22./23.10.2026.
**Auftrag:** `BRIEF_NACHFOLGE_2026-10-22_NACH-VERSION-UND-VIDEO.md` (iOS), dann Klaus' Wünsche im Chat.

## Zeitnachweis (gemessen, UTC)

| Block | Beginn | Ende | Beleg |
|---|---|---|---|
| 1: Produktstand und Regeln | 2026-10-22T20:38Z | 2026-10-22T21:43Z | Reflog Workflow-PDF-Pro (Checkout) bis Aktualisierung PR #19 |
| Nachsehen PR #19 | 01:44Z, 05:47Z | je unter 2 min | Planungs-Erinnerungen, nicht gezählt |
| 2: Codex-Nachtrag und Abschluss | 2026-10-23T09:16Z | Commit dieses Briefs | Reflog Kimhub (Klon) |

Zwischen den Blöcken keine Arbeit. Spannen sind Obergrenzen; Wartezeit auf Helfer und CI ist enthalten.

## Was Klaus entschieden hat

1. Sichttest-Befunde bearbeitet **Codex** (PR #20, 1.0.4).
2. **iOS nur vorbereiten**, höchstens privat installieren; kein bezahltes Apple-Konto.
3. **Gleichstandsregel:** Wird eine Fassung fertig, ziehen alle anderen derselben App mit. Für alle Apps, ohne Erinnerung.
4. Kleine Korrekturen **sammeln** und gemeinsam ausliefern.
5. Startdateien kürzen, aber **bewährte Dauerregeln behalten**.
6. Sitzung abschließen, **Codex' Arbeit lückenlos in Kimhub** nachtragen, Zusammenarbeit dokumentieren.

## Ergebnis

1. **Workflow-PDF-Pro PR #19** (Entwurf, CI grün, mergebar):
   - `docs/PRODUKTSTAND.md`: alle Fassungen, Gleichstandsregel, iOS-Entscheidung, Sammelliste.
   - `docs/IPHONE-WEBVERSION.md`: Webversion auf iPhone/iPad zum Home-Bildschirm (kostenlos).
   - `AGENTS.md` neu: Dauerregeln und getroffene Entscheidungen; `CLAUDE.md` nur Verweis;
     `docs/FOLGESITZUNG.md` auf Zugriff und Bauumgebung gekürzt. Startdateien von ~16.000 auf ~6.900 Zeichen.
   - Dieser Brief und `BRIEF_NACHFOLGE_2026-10-23_GLEICHSTAND.md`.
2. **Kimhub** (Zweig `claude/codex-nachtrag-2026-10-23`): 15 Codex-Einträge (19.–23.10., vier Repos),
   2 Einträge dieser Sitzung, Notiz `forschung/messungen/zwei-ki-parallel-2026-10-19-bis-23.md`,
   Forschungsseite neu gebaut. `node tests/alle.mjs`: 3748 grün, 0 rot, 0 nicht lauffähig.

## Befunde

- Videobefund „← Библиотека außerhalb“ in der Web-App **nicht nachstellbar**. Dafür gefunden: auf dem Handy
  steht „←“ in allen Sprachen an vierter Stelle (drei Knöpfe ohne `order`). Gesammelt für 1.0.4.
- Vor dem iOS-Start nachgesehen: Codex baute iOS schon. Kein Doppelbau.
- Erstes Kürzen von `AGENTS.md` war zu stark; Klaus wies darauf hin, Dauerregeln zurückgeholt.
- Codex-Zuordnung: Codex committet auch als „lausiklauskn-png“; zugeordnet nach Zweig `codex/…` und Inhalt.
  PR #6 in Workflow-PDF-Pro stammt von Claude, nicht von Codex.

## Offen

- **Frage an Klaus:** Privat-Brain-Pro PR #3–#32 (19.10. 21:04Z bis 20.10. 15:13Z, Vorschauen .4–.16) –
  von Codex? Git zeigt es nicht. Bis zur Antwort ohne Eintrag.
- Claude-Blöcke in Privat-Brain-Pro ohne Kimhub-Eintrag: 21.10. 09:47Z–16:55Z und 23.10. ab 07:26Z
  (lief beim Nachtragen noch). Nachtragen durch die jeweilige Sitzung.
- PR #19 (Workflow-PDF-Pro) und der Kimhub-PR mergen.
- Zurück-Pfeil-Reihenfolge in Codex' 1.0.4 mitnehmen.

## Downloads (unverändert, keine neue Version in dieser Sitzung)

- Android 1.0.3: <https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/v1.0.3>
- Windows 1.0.3: <https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/windows-v1.0.3>
- Web: <https://lausiklauskn-png.github.io/Workflow-PDF/>
