// Test-only entry to the unmodified Windows core. Synthetic public fixture key.
use std::{env, fs::File, io::{Read, Write}};
use wfp_core::{crypto, recovery};
fn main() {
    let args: Vec<String> = env::args().collect();
    let key: Vec<u8> = (0..32).collect();
    let name = "workflow-pdf-pro-vault:compat:files:Мюллер";
    match args[1].as_str() {
        "write" => {
            let mut input = File::open(&args[2]).unwrap();
            let mut writer = crypto::Writer::new(File::options().write(true).create_new(true).open(&args[3]).unwrap(), &key, name).unwrap();
            let mut block = vec![0u8; crypto::CHUNK];
            loop { let n=input.read(&mut block).unwrap(); if n==0 {break}; writer.write(&block[..n]).unwrap(); }
            let (_, _, mut out) = writer.finish().unwrap(); out.flush().unwrap(); out.sync_all().unwrap();
        }
        "read" => println!("{}", crypto::Reader::new(File::open(&args[2]).unwrap(), &key, name).unwrap().digest_hex().unwrap()),
        "derive" => println!("{}", crypto::hex(&crypto::pbkdf2(&crypto::password_bytes("Gemäßigtes Passwort €"), &(0..16).collect::<Vec<u8>>(), 600_000).unwrap())),
        "split" => { for s in recovery::split(&key, [5,6,7,8], 5, 3).unwrap() {println!("{}", recovery::encode(&s));} }
        "combine" => println!("{}", crypto::hex(&recovery::combine(&args[2..].iter().map(|s| recovery::decode(s).unwrap()).collect::<Vec<_>>()).unwrap())),
        _ => panic!("Unknown operation"),
    }
}
