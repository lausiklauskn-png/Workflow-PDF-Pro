import fs from 'node:fs';
// Nur der Ablageort der echten, über APT geprüften Testschrift wird angepasst.
// Kein Ersatz der Schrift oder der Testaussagen.
const expected='/usr/share/fonts/truetype/freefont/FreeSans.ttf';
const actual='/workspace/setup/font-package/usr/share/fonts/truetype/freefont/FreeSans.ttf';
const read=fs.readFileSync.bind(fs),exists=fs.existsSync.bind(fs);
fs.readFileSync=(file,...args)=>read(file===expected?actual:file,...args);
fs.existsSync=file=>exists(file===expected?actual:file);
