use std::fs;
use wfp_core::{fsutil, transfers::Transfers};

#[test]
fn long_unicode_names_keep_the_extension_and_fit_real_files() {
    let root = std::env::temp_dir().join(format!("wfp-names-{}", uuid::Uuid::new_v4()));
    let mut transfers = Transfers::new(&root);
    for stem in ["a".repeat(220), "Ж".repeat(170), "😀".repeat(150), "e\u{301}".repeat(170)] {
        let name = format!("{stem}.pdf");
        let safe = fsutil::filename(Some(&name));
        assert!(safe.ends_with(".pdf"), "Dateiendung verloren");
        assert!(safe.encode_utf16().count() <= 180, "Windows-UTF-16-Grenze");
        assert!(safe.len() <= 240, "Portable UTF-8-Grenze");
        let ticket = transfers.begin(Some(&name), Some("application/pdf")).unwrap();
        let bytes = b"%PDF-1.4 Unicode";
        use base64::Engine;
        transfers.append(Some(&ticket), Some(&serde_json::json!(0)), &base64::engine::general_purpose::STANDARD.encode(bytes)).unwrap();
        transfers.finish(Some(&ticket), Some(&serde_json::json!(bytes.len()))).unwrap();
        let stored = transfers.finished(Some(&ticket)).unwrap();
        assert_eq!(fs::read(&stored.file).unwrap(), bytes);
        assert_eq!(stored.name, safe);
        transfers.abort(Some(&ticket));
    }
    assert_eq!(fsutil::filename(Some("Cafe\u{301}.pdf")), "Café.pdf");
    fs::remove_dir_all(root).unwrap();
}
