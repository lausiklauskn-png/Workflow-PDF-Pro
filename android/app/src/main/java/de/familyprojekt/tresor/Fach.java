package de.familyprojekt.tresor;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Die festen Fächer des gemeinsamen Tresorordners und wer darin schreiben darf.
 * Eigenes Fach: nur die besitzende App schreibt. Übergabefach: jede Pro-App darf ablegen,
 * gelesen wird es von der Empfänger-App. Gelesen werden dürfen alle Fächer von allen Apps.
 * Gelöscht wird in keinem Fach etwas; „übernommen“ ist eine eigene Marke-Datei.
 */
public final class Fach {
    public static final String PRIVATE_BRAIN_APP = "private-brain";
    public static final String WORKFLOW_PDF_APP = "workflow-pdf-pro";
    public static final String BOOKLEDGER_APP = "bookledgerpro";
    public static final List<String> APPS = Collections.unmodifiableList(Arrays.asList(PRIVATE_BRAIN_APP, WORKFLOW_PDF_APP, BOOKLEDGER_APP));

    public static final Fach PRIVATE_BRAIN = new Fach("private-brain", "Private Brain", PRIVATE_BRAIN_APP, null);
    public static final Fach WORKFLOW_PDF = new Fach("workflow-pdf-pro", "Workflow PDF Pro", WORKFLOW_PDF_APP, null);
    public static final Fach BOOKLEDGER = new Fach("bookledgerpro", "BookLedgerPro", BOOKLEDGER_APP, null);
    public static final Fach EINGANG_BOOKLEDGER = new Fach("eingang-bookledgerpro", "Eingang-BookLedgerPro", null, BOOKLEDGER_APP);
    public static final Fach EINGANG_WORKFLOW_PDF = new Fach("eingang-workflowpdf", "Eingang-WorkflowPDF", null, WORKFLOW_PDF_APP);
    public static final List<Fach> ALLE = Collections.unmodifiableList(Arrays.asList(PRIVATE_BRAIN, WORKFLOW_PDF, BOOKLEDGER, EINGANG_BOOKLEDGER, EINGANG_WORKFLOW_PDF));

    /** Kurzname im Format (Dateinamen, gebundene Daten). */
    public final String slug;
    /** Ordnername im gewählten Tresorordner. */
    public final String ordner;
    /** Besitzende App (eigenes Fach) oder null (Übergabefach). */
    public final String besitzer;
    /** Empfänger-App eines Übergabefachs, sonst null. */
    public final String empfaenger;

    private Fach(String slug, String ordner, String besitzer, String empfaenger) {
        this.slug = slug; this.ordner = ordner; this.besitzer = besitzer; this.empfaenger = empfaenger;
    }

    public boolean istUebergabe() { return besitzer == null; }

    public boolean darfSchreiben(String app) {
        if (!APPS.contains(app)) return false;
        return istUebergabe() || besitzer.equals(app);
    }

    public static Fach nachSlug(String slug) throws java.io.IOException {
        for (Fach f : ALLE) if (f.slug.equals(slug)) return f;
        throw new java.io.IOException("TRESOR_FACH_UNBEKANNT");
    }

    static void appPruefen(String app) throws java.io.IOException {
        if (!APPS.contains(app)) throw new java.io.IOException("TRESOR_APP_UNBEKANNT");
    }
}
