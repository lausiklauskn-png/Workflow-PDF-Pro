package de.familyprojekt.workflowpdf.pro;

import static org.junit.Assert.*;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public class UpdateRegelTest {
    private static JSONObject rel(String tag, boolean draft, boolean pre, String asset) throws Exception {
        JSONArray a = new JSONArray(); if (asset != null) a.put(new JSONObject().put("name", asset).put("state", "uploaded").put("size", 10));
        return new JSONObject().put("tag_name", tag).put("draft", draft).put("prerelease", pre).put("assets", a);
    }
    @Test public void neuereAndroidVeroeffentlichungMitApk() throws Exception {
        JSONArray r = new JSONArray().put(rel("windows-v1.0.9", false, false, "x.exe")).put(rel("v1.0.7", false, false, "Workflow-PDF-Pro-1.0.7.apk")).put(rel("v1.0.5", false, false, "a.apk"));
        JSONObject o = UpdateRegel.auswerten("1.0.6", r);
        assertEquals("available", o.getString("status")); assertEquals("1.0.7", o.getString("version")); assertEquals("1.0.6", o.getString("installiert"));
    }
    @Test public void aktuellOhneNeuere() throws Exception {
        JSONObject o = UpdateRegel.auswerten("1.0.6-debug", new JSONArray().put(rel("v1.0.6", false, false, "a.apk")).put(rel("windows-v2.0.0", false, false, "a.apk")));
        assertEquals("current", o.getString("status")); assertEquals("1.0.6", o.getString("version"));
    }
    @Test public void entwurfVorabfassungUndOhneApkZaehlenNicht() throws Exception {
        JSONArray r = new JSONArray().put(rel("v2.0.0", true, false, "a.apk")).put(rel("v2.0.1", false, true, "a.apk")).put(rel("v2.0.2", false, false, "a.aab")).put(rel("v2.0.3", false, false, null));
        assertEquals("current", UpdateRegel.auswerten("1.0.6", r).getString("status"));
    }
    @Test public void zehnIstGroesserAlsNeun() throws Exception {
        assertEquals("1.0.10", UpdateRegel.auswerten("1.0.9", new JSONArray().put(rel("v1.0.10", false, false, "a.apk"))).getString("version"));
    }
    @Test public void seiteNurFuerGueltigeTags() {
        assertEquals("https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/v1.0.7", UpdateRegel.seite("v1.0.7"));
        try { UpdateRegel.seite("v1.0.7/../x"); fail(); } catch (IllegalArgumentException ok) { }
    }
}
