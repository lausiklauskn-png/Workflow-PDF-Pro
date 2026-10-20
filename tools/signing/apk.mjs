import { readFile, writeFile, access, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { APP_ID, verifyPinnedIdentity, checked } from './identity.mjs';

export async function signApk({ input, output, signer, aapt, tag, commit, directory, key }) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag || '') || !/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Regulärer Release-Tag und vollständiger Quellcommit sind erforderlich.');
  if (!input || !output || !signer || !aapt || path.resolve(input) === path.resolve(output)) throw new Error('Eingabe, neue Ausgabe, apksigner und aapt sind erforderlich.');
  await access(input);
  const handle = await open(output, 'wx', 0o644); await handle.close();
  let complete = false;
  const ownedSidecars = [];
  try {
    const receipt = await verifyPinnedIdentity(directory, key, async identity => {
      checked(signer, ['sign', '--ks', identity.file, '--ks-key-alias', identity.alias,
        '--ks-pass', 'env:WF_PDF_STORE_PASSWORD', '--key-pass', 'env:WF_PDF_STORE_PASSWORD',
        '--v4-signing-enabled', 'false', '--out', output, input], { WF_PDF_STORE_PASSWORD: identity.password });
      const verified = checked(signer, ['verify', '--verbose', '--print-certs', output], {}).toString('utf8');
      const fingerprints = [...verified.matchAll(/^Signer #\d+ certificate SHA-256 digest:\s*([a-f0-9]+)\s*$/gmi)].map(m => m[1].toLowerCase());
      if (fingerprints.length !== 1 || fingerprints[0] !== identity.fingerprint) throw new Error('APK-Zertifikat stimmt nicht mit der dauerhaften Identität überein.');
      const badging = checked(aapt, ['dump', 'badging', output], {}).toString('utf8');
      if (!badging.startsWith("package: name='" + APP_ID + "' ")) throw new Error('APK gehört nicht zu Workflow PDF Pro.');
      const versionName = badging.match(/^package: .*?versionName='([^']+)'/m)?.[1];
      const versionCode = Number(badging.match(/^package: .*?versionCode='(\d+)'/m)?.[1]);
      if (versionName !== tag.slice(1) || !Number.isSafeInteger(versionCode) || versionCode < 1) throw new Error('APK-Version passt nicht zum regulären Release.');
      if (/^application-debuggable$/m.test(badging)) throw new Error('Debug-APK darf nicht regulär veröffentlicht werden.');
      return { applicationId: APP_ID, versionName, versionCode, commit, certificateSha256: identity.fingerprint,
        apkSha256: createHash('sha256').update(await readFile(output)).digest('hex'), filename: path.basename(output) };
    });
    for (const [suffix, value] of [['.sha256', receipt.apkSha256 + '  ' + path.basename(output) + '\n'], ['.json', JSON.stringify(receipt, null, 2) + '\n']]) {
      const sidecar = output + suffix, file = await open(sidecar, 'wx', 0o644); ownedSidecars.push(sidecar);
      try { await file.writeFile(value); } finally { await file.close(); }
    }
    complete = true;
    return receipt;
  } finally {
    if (!complete) { await rm(output, { force: true }); for (const file of ownedSidecars) await rm(file, { force: true }); }
  }
}
