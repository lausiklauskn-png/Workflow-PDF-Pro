import { APP_ID } from './identity.mjs';
export const stableTag = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function compareTags(a, b) {
  if (!stableTag.test(a || '') || !stableTag.test(b || '')) throw new Error('Nur reguläre Versions-Tags vergleichen.');
  const x = a.slice(1).split('.').map(BigInt), y = b.slice(1).split('.').map(BigInt);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}
export function validateReceipt(receipt, tag, commit) {
  if (!stableTag.test(tag || '') || !/^[a-f0-9]{40}$/.test(commit || '') || !receipt ||
      receipt.commit !== commit || receipt.versionName !== tag.slice(1) ||
      receipt.filename !== 'Workflow-PDF-Pro-' + tag.slice(1) + '.apk' || receipt.applicationId !== APP_ID ||
      !Number.isSafeInteger(receipt.versionCode) || receipt.versionCode < 1 ||
      !/^[a-f0-9]{64}$/.test(receipt.certificateSha256 || '') || !/^[a-f0-9]{64}$/.test(receipt.apkSha256 || '')) throw new Error('Release-Nachweis gehört nicht zum regulären geprüften Stand.');
}
export function validateUpdate(next, previous) {
  if (!previous || previous.applicationId !== next.applicationId || previous.certificateSha256 !== next.certificateSha256 ||
      !Number.isSafeInteger(previous.versionCode) || previous.versionCode < 1 ||
      !Number.isSafeInteger(next.versionCode) || next.versionCode <= previous.versionCode ||
      compareTags('v' + next.versionName, 'v' + previous.versionName) <= 0) throw new Error('Paketkennung/Signatur geändert oder Versions-/Buildnummer nicht erhöht.');
}
