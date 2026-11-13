package de.familyprojekt.workflowpdf.pro;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/** Reine Regel für „Auf Updates prüfen“ (Leitfaden § 6): welche öffentliche Veröffentlichung ist neuer als die installierte App?
 *  Nur Android-Veröffentlichungen „vX.Y.Z“ (nicht „windows-v…“, keine Entwürfe/Vorabfassungen) mit einer hochgeladenen APK zählen. */
final class UpdateRegel {
    private UpdateRegel() {}
    static final String REPO = "lausiklauskn-png/Workflow-PDF-Pro";
    private static final Pattern TAG = Pattern.compile("^v(\\d{1,4})\\.(\\d{1,4})\\.(\\d{1,4})$");
    private static final Pattern NAME = Pattern.compile("^(\\d{1,4})\\.(\\d{1,4})\\.(\\d{1,4})(?:-[A-Za-z0-9.]+)?$");
    /** Name der APK in einer Veröffentlichung: nur einfache Zeichen, keine Pfadteile. */
    private static final Pattern APK = Pattern.compile("^[A-Za-z0-9._-]{1,120}\\.apk$");
    private static final Pattern DIGEST = Pattern.compile("^sha256:([0-9a-f]{64})$");
    static final long APK_GRENZE = 400L * 1024 * 1024;

    static int[] version(String text, boolean tag) {
        Matcher m = (tag ? TAG : NAME).matcher(text == null ? "" : text);
        if (!m.matches()) return null;
        return new int[] { Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)) };
    }
    static boolean neuer(int[] a, int[] b) {
        for (int i = 0; i < 3; i++) if (a[i] != b[i]) return a[i] > b[i];
        return false;
    }
    /** Liefert {"status": "current"|"available", "version": "X.Y.Z", "installiert": "X.Y.Z", "tag": "vX.Y.Z"?}. */
    static JSONObject auswerten(String installiert, JSONArray releases) throws Exception {
        int[] ich = version(installiert, false);
        if (ich == null) throw new IllegalArgumentException("UPDATE_VERSION_UNBEKANNT");
        int[] best = ich; String bestTag = null; JSONObject bestApk = null;
        for (int i = 0; i < releases.length(); i++) {
            JSONObject r = releases.optJSONObject(i);
            if (r == null || r.optBoolean("draft", true) || r.optBoolean("prerelease", true)) continue;
            String tag = r.optString("tag_name", ""); int[] v = version(tag, true);
            if (v == null || !neuer(v, best)) continue;
            JSONArray assets = r.optJSONArray("assets"); JSONObject apk = null;
            for (int j = 0; assets != null && j < assets.length(); j++) {
                JSONObject a = assets.optJSONObject(j);
                if (a != null && "uploaded".equals(a.optString("state")) && a.optLong("size", 0) > 0 && a.optString("name").toLowerCase(java.util.Locale.ROOT).endsWith(".apk")) { apk = a; break; }
            }
            if (apk == null) continue;
            best = v; bestTag = tag; bestApk = apk;
        }
        String ichText = ich[0] + "." + ich[1] + "." + ich[2];
        JSONObject out = new JSONObject().put("installiert", ichText);
        if (bestTag == null) return out.put("status", "current").put("version", ichText);
        out.put("status", "available").put("version", bestTag.substring(1)).put("tag", bestTag);
        // Für „Direkt laden“: Name, Größe und (wenn GitHub sie nennt) SHA-256 der APK. Die Adresse baut die App selbst (download()).
        String name = bestApk.optString("name", ""); long groesse = bestApk.optLong("size", 0);
        Matcher d = DIGEST.matcher(bestApk.optString("digest", ""));
        if (APK.matcher(name).matches() && groesse > 0 && groesse <= APK_GRENZE) {
            out.put("apk", name).put("groesse", groesse);
            if (d.matches()) out.put("sha256", d.group(1));
        }
        return out;
    }
    /** Feste Download-Adresse der APK; Tag und Name werden geprüft, nie eine Adresse aus dem Netz übernommen. */
    static String download(String tag, String apk) {
        if (version(tag, true) == null || apk == null || !APK.matcher(apk).matches()) throw new IllegalArgumentException("UPDATE_TAG");
        return "https://github.com/" + REPO + "/releases/download/" + tag + "/" + apk;
    }
    /** Feste Seite der Veröffentlichung; nie eine Adresse aus dem Netz. */
    static String seite(String tag) {
        if (version(tag, true) == null) throw new IllegalArgumentException("UPDATE_TAG");
        return "https://github.com/" + REPO + "/releases/tag/" + tag;
    }
}
