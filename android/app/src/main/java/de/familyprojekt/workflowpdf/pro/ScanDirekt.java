package de.familyprojekt.workflowpdf.pro;

/**
 * Scanner-Direktstart aus einer anderen App (Pro-Umbau 5, Klaus 2026-10-28; Gegenstück zu ?scan=1&von=… der PWA).
 * Eine andere Pro-App (BookLedgerPro) startet Workflow PDF Pro mit
 *   new Intent("de.familyprojekt.workflowpdf.pro.SCANNEN").setPackage("de.familyprojekt.workflowpdf.pro").putExtra("von", "BookLedgerPro")
 * und der Scanner geht sofort auf („Durchsuchbar" für diesen Scan). Übergeben wird nur der Name der Absender-App — keine
 * Datei, keine Adresse. Rein und ohne Android, damit die JVM-Probe die Regeln prüfen kann.
 */
final class ScanDirekt {
    static final String AKTION = "de.familyprojekt.workflowpdf.pro.SCANNEN";
    static final String EXTRA_VON = "von";
    static final int VON_MAX = 40;
    private ScanDirekt() {}

    static boolean istScan(String aktion) { return AKTION.equals(aktion); }

    /** Absendername nur aus Buchstaben, Ziffern, Leerzeichen, Punkt, Binde- und Unterstrich, höchstens 40 Zeichen. */
    static String von(String roh) {
        if (roh == null) return "";
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < roh.length() && b.length() < VON_MAX; i++) {
            char c = roh.charAt(i);
            if (Character.isLetterOrDigit(c) || c == ' ' || c == '.' || c == '-' || c == '_') b.append(c);
        }
        return b.toString().trim();
    }
}
