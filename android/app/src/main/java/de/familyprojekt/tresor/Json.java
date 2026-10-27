package de.familyprojekt.tresor;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Kleines JSON ohne Fremdbibliothek: Objekte (LinkedHashMap), Listen, Texte, ganze Zahlen (Long),
 * Wahrheitswerte und null. Reicht für Kopf, Plätze, Marken und das Inhaltsverzeichnis und läuft
 * gleich auf Android, auf der JVM und in der Windows-Java-Engine. Kommazahlen gibt es im Format nicht.
 */
public final class Json {
    private Json() { }

    public static String schreiben(Object wert) {
        StringBuilder out = new StringBuilder();
        schreiben(out, wert);
        return out.toString();
    }

    @SuppressWarnings("unchecked")
    private static void schreiben(StringBuilder out, Object wert) {
        if (wert == null) out.append("null");
        else if (wert instanceof String) text(out, (String) wert);
        else if (wert instanceof Boolean) out.append(((Boolean) wert) ? "true" : "false");
        else if (wert instanceof Integer || wert instanceof Long) out.append(((Number) wert).longValue());
        else if (wert instanceof Map) {
            out.append('{');
            boolean erstes = true;
            for (Map.Entry<String, Object> e : ((Map<String, Object>) wert).entrySet()) {
                if (!erstes) out.append(',');
                erstes = false;
                text(out, e.getKey());
                out.append(':');
                schreiben(out, e.getValue());
            }
            out.append('}');
        } else if (wert instanceof List) {
            out.append('[');
            boolean erstes = true;
            for (Object o : (List<Object>) wert) {
                if (!erstes) out.append(',');
                erstes = false;
                schreiben(out, o);
            }
            out.append(']');
        } else throw new IllegalArgumentException("JSON_TYP");
    }

    private static void text(StringBuilder out, String s) {
        out.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': out.append("\\\""); break;
                case '\\': out.append("\\\\"); break;
                case '\n': out.append("\\n"); break;
                case '\r': out.append("\\r"); break;
                case '\t': out.append("\\t"); break;
                default:
                    if (c < 0x20) out.append(String.format(java.util.Locale.ROOT, "\\u%04x", (int) c));
                    else out.append(c);
            }
        }
        out.append('"');
    }

    public static Object lesen(String text) throws IOException {
        Leser l = new Leser(text);
        l.leer();
        Object wert = l.wert(0);
        l.leer();
        if (l.pos != text.length()) throw new IOException("TRESOR_BESCHAEDIGT");
        return wert;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> objekt(String text) throws IOException {
        Object wert = lesen(text);
        if (!(wert instanceof Map)) throw new IOException("TRESOR_BESCHAEDIGT");
        return (Map<String, Object>) wert;
    }

    public static String text(Map<String, Object> o, String schluessel) throws IOException {
        Object w = o.get(schluessel);
        if (!(w instanceof String)) throw new IOException("TRESOR_BESCHAEDIGT");
        return (String) w;
    }

    public static long zahl(Map<String, Object> o, String schluessel) throws IOException {
        Object w = o.get(schluessel);
        if (!(w instanceof Long)) throw new IOException("TRESOR_BESCHAEDIGT");
        return (Long) w;
    }

    public static String textOder(Map<String, Object> o, String schluessel, String sonst) {
        Object w = o.get(schluessel);
        return w instanceof String ? (String) w : sonst;
    }

    public static long zahlOder(Map<String, Object> o, String schluessel, long sonst) {
        Object w = o.get(schluessel);
        return w instanceof Long ? (Long) w : sonst;
    }

    private static final class Leser {
        final String s; int pos;
        Leser(String s) { this.s = s; }
        IOException kaputt() { return new IOException("TRESOR_BESCHAEDIGT"); }
        void leer() { while (pos < s.length() && " \t\r\n".indexOf(s.charAt(pos)) >= 0) pos++; }
        char zeichen() throws IOException { if (pos >= s.length()) throw kaputt(); return s.charAt(pos); }
        Object wert(int tiefe) throws IOException {
            if (tiefe > 32) throw kaputt();
            char c = zeichen();
            if (c == '{') {
                pos++;
                Map<String, Object> o = new LinkedHashMap<>();
                leer();
                if (zeichen() == '}') { pos++; return o; }
                while (true) {
                    leer();
                    if (zeichen() != '"') throw kaputt();
                    String k = text();
                    leer();
                    if (zeichen() != ':') throw kaputt();
                    pos++; leer();
                    if (o.containsKey(k)) throw kaputt();
                    o.put(k, wert(tiefe + 1));
                    leer();
                    char n = zeichen(); pos++;
                    if (n == '}') return o;
                    if (n != ',') throw kaputt();
                }
            }
            if (c == '[') {
                pos++;
                List<Object> a = new ArrayList<>();
                leer();
                if (zeichen() == ']') { pos++; return a; }
                while (true) {
                    leer();
                    a.add(wert(tiefe + 1));
                    leer();
                    char n = zeichen(); pos++;
                    if (n == ']') return a;
                    if (n != ',') throw kaputt();
                }
            }
            if (c == '"') return text();
            if (s.startsWith("true", pos)) { pos += 4; return Boolean.TRUE; }
            if (s.startsWith("false", pos)) { pos += 5; return Boolean.FALSE; }
            if (s.startsWith("null", pos)) { pos += 4; return null; }
            if (c == '-' || (c >= '0' && c <= '9')) {
                int start = pos;
                if (c == '-') pos++;
                while (pos < s.length() && Character.isDigit(s.charAt(pos))) pos++;
                if (pos == start || (pos == start + 1 && c == '-')) throw kaputt();
                if (pos < s.length() && ".eE".indexOf(s.charAt(pos)) >= 0) throw kaputt();
                try { return Long.parseLong(s.substring(start, pos)); }
                catch (NumberFormatException e) { throw kaputt(); }
            }
            throw kaputt();
        }
        String text() throws IOException {
            pos++;
            StringBuilder out = new StringBuilder();
            while (true) {
                char c = zeichen(); pos++;
                if (c == '"') return out.toString();
                if (c < 0x20) throw kaputt();
                if (c != '\\') { out.append(c); continue; }
                char e = zeichen(); pos++;
                switch (e) {
                    case '"': out.append('"'); break;
                    case '\\': out.append('\\'); break;
                    case '/': out.append('/'); break;
                    case 'b': out.append('\b'); break;
                    case 'f': out.append('\f'); break;
                    case 'n': out.append('\n'); break;
                    case 'r': out.append('\r'); break;
                    case 't': out.append('\t'); break;
                    case 'u':
                        if (pos + 4 > s.length()) throw kaputt();
                        try { out.append((char) Integer.parseInt(s.substring(pos, pos + 4), 16)); }
                        catch (NumberFormatException x) { throw kaputt(); }
                        pos += 4; break;
                    default: throw kaputt();
                }
            }
        }
    }
}
