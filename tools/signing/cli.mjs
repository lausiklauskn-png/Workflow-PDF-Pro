import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNLOCK_NAME, createIdentity, saveNewIdentity, verifyPinnedIdentity, sealIdentity, withIdentity } from './identity.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = path.join(root, 'signing');
const [command, ...args] = process.argv.slice(2);
const key = process.env[UNLOCK_NAME];
try {
  if (command === 'init') {
    for (const name of ['android-release.enc.json', 'android-certificate.json']) {
      try { await lstat(path.join(directory, name)); throw new Error('Signieridentität vorhanden; Initialisierung abgebrochen.'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const envelope = await createIdentity(key);
    await saveNewIdentity(directory, envelope);
    await verifyPinnedIdentity(directory, key);
    console.log('Eigene Signieridentität erstellt und Wiederherstellung geprüft. Zertifikat SHA-256: ' + envelope.certificateSha256);
  } else if (command === 'check') {
    await verifyPinnedIdentity(directory, key, identity => { console.log('Identität wiederhergestellt; Zertifikat SHA-256: ' + identity.fingerprint); });
  } else if (command === 'import') {
    // Import ONLY an existing Workflow PDF Pro key, never Private Brain's key.
    const [file, expectedFingerprint] = args;
    if (!file || !/^[a-f0-9:]{64,95}$/i.test(expectedFingerprint || '')) throw new Error('Import braucht Keystore-Pfad und unabhängig bestätigten Zertifikats-Fingerabdruck.');
    const envelope = await sealIdentity({ keystore: await readFile(file), password: process.env.WF_PDF_EXISTING_STORE_PASSWORD, alias: process.env.WF_PDF_EXISTING_KEY_ALIAS, key, expectedFingerprint });
    await withIdentity(envelope, key, () => true); await saveNewIdentity(directory, envelope);
    console.log('Bestehende Workflow-PDF-Pro-Identität verschlüsselt übernommen; kein Schlüsselwechsel.');
  } else if (command === 'sign-apk') {
    const [input, output] = args;
    const { signApk } = await import('./apk.mjs');
    const receipt = await signApk({ input, output, directory, key,
      signer: process.env.WF_PDF_APKSIGNER, aapt: process.env.WF_PDF_AAPT,
      tag: process.env.WF_PDF_RELEASE_TAG, commit: process.env.WF_PDF_RELEASE_COMMIT });
    console.log('APK-Signatur, Zertifikat, App-Kennung und Version geprüft. SHA-256: ' + receipt.apkSha256);
  } else {
    throw new Error('Aufruf: node tools/signing/cli.mjs init | check | import <p12> <Zertifikat-SHA256> | sign-apk <unsigned.apk> <neue.apk>');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
