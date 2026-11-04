/* „Wo liegt was?“ (Klaus 2026-11-03, gemeinsamer Tresor-Plan Punkt 7) und die Meldungen zur Ordnerwahl.
   App-eigene Datei; die gemeinsamen Bedien-Bausteine (pro-bedienung.*) bleiben unverändert und werden nur benutzt.
   Gleicher Inhalt wie in den anderen Pro-Apps, darunter das, was nur Workflow PDF Pro betrifft.
   Deutsch und Englisch voll; Russisch und Arabisch fallen auf Deutsch zurück (Plan erlaubt das). */
(() => {
  'use strict';
  if(!window.Capacitor?.isNativePlatform?.())return;
  const DE={
    titel:'Wo liegt was?',
    punkte:[
      'Der gemeinsame Tresor aller Pro-Apps ist ein Hauptordner (Vorschlag „Family-Projekt“), erkennbar an der Datei „tresorordner.json“. Zum Einrichten wählst du in jeder App nur den Speicher (SD-Karte oder Gerätespeicher) – die App findet den Hauptordner selbst oder legt ihn an.',
      'Nie den Unterordner „Tresorordner“ wählen und nie einen App-Ordner darin.',
      'Darin legt jede App ihren eigenen Ordner an: Workflow PDF Pro · Private Brain · BookLedgerPro · Familienakte.',
      'Die Ordner „Eingang-…“ sind Briefkästen: Andere Apps legen dort etwas für diese App ab.',
      'Die Dateien heißen nur nach Nummern und sind verschlüsselt. Den echten Namen zeigt die App. Ohne App lassen sie sich nicht öffnen.',
      'Offene Dateien (PDF, .json, .txt) gehören nicht in den Tresor-Ordner. Ersatzschlüssel ausdrucken oder getrennt aufbewahren.',
      'Ein Passwort gilt für alle Pro-Apps.'
    ],
    dieseApp:'Diese App: Ordner „Workflow PDF Pro“ · Eingang: „Eingang-WorkflowPDF“',
    weg:'Verbinden: Einstellungen (Zahnrad) › „Tresor & Ablage“ › Abschnitt „Tresor (alle Pro-Apps)“ › „In den Tresorordner einziehen …“ (später „Anderen Tresorordner wählen …“). Bei der Ablage („Ordner wählen / vorhandenen Tresor öffnen …“) darfst du den Hauptablageordner oder den Ordner „Workflow PDF Pro“ darin wählen – beides öffnet dieselbe Ablage.',
    original:'Mit echtem Namen speichern: in der Bibliothek beim Dokument 📤 (Teilen) – oder für einen ganzen Ordner „📤 Ordner ausgeben“ › „Original, unverändert“ › „Als ZIP-Datei“. Als Ziel z. B. „Downloads“ wählen, nicht den Tresor. Die Liste mit den echten Namen ist die Bibliothek selbst.',
    knopf:'Wo liegt was?',schliessen:'Schließen',
    // Meldungen zur Ordnerwahl (Codes aus ProVaultPlugin / OrdnerWahl.java)
    VAULT_ORDNER_VERWALTUNG:'Das ist der Ordner „Tresorordner“ – dort liegt nur die Verwaltung. Wähle den Ordner darüber, in dem „tresorordner.json“ liegt. Nichts wurde angelegt.',
    VAULT_ORDNER_FREMDES_FACH:'Das ist der Ordner einer anderen App oder ein Eingang. Wähle den Ordner, in dem „tresorordner.json“ liegt, oder den Ordner „Workflow PDF Pro“. Nichts wurde angelegt.',
    VAULT_ORDNER_FACH_OHNE_KOPF:'In diesem Ordner „Workflow PDF Pro“ liegen Dateien, aber keine Ablage von Workflow PDF Pro. Wähle den Ordner, in dem „tresorordner.json“ liegt. Nichts wurde angelegt oder verändert.',
    TRESOR_ORDNER_APP_ORDNER:'Das ist ein App-Ordner im Tresor. Wähle den Ordner darüber, in dem „tresorordner.json“ liegt. Nichts wurde verändert.',
    TRESOR_ORDNER_VERWALTUNG:'Das ist der Ordner „Tresorordner“ (nur Verwaltung). Wähle den Ordner darüber, in dem „tresorordner.json“ liegt. Nichts wurde verändert.',
    TRESOR_NICHT_VORHANDEN:'In diesem Ordner liegt keine „tresorordner.json“. Wähle den Ordner, in dem „tresorordner.json“ liegt. Es wurde kein neuer Tresor angelegt.',
    TRESOR_UMGEZOGEN:'Dieser Tresor ist umgezogen. Bitte den neuen Ort wählen. Nichts wurde verändert.',
    TRESOR_ORDNER_UNTERORDNER:'Das ist ein Ordner innerhalb des Tresors (ein Fach, ein Eingang oder die Verwaltung). Bitte nur den Speicher wählen, z. B. die SD-Karte, oder den Hauptordner. Nichts wurde angelegt.',
    TRESOR_ORDNER_MEHRERE:'In diesem Speicher liegen mehrere Tresore. Bitte den gewünschten Hauptordner direkt wählen. Nichts wurde angelegt.',
    TRESOR_NAME_BELEGT:'Einen Ordner mit diesem Namen gibt es dort schon, und er ist nicht leer. Bitte einen anderen Namen wählen. Nichts wurde angelegt.',
    TRESOR_ABLAGE_PASSWORT_ANDERS:'Der Tresor ist mit diesem Passwort offen, die Ablage von Workflow PDF Pro darin hat aber ein anderes (älteres) Passwort. Nichts wurde verändert. Bitte „Ordner wählen / vorhandenen Tresor öffnen“ mit dem alten Passwort nutzen.',
    ebeneHoeher:'Gewählt war ein Ordner im Tresor. Verbunden ist jetzt der Ordner darüber, in dem „tresorordner.json“ liegt.',
    imTresor:'Nicht gespeichert: Das Ziel lag im Tresor. Dort liegen nur verschlüsselte Dateien. Bitte z. B. „Downloads“ wählen.'
  };
  const EN={
    titel:'Where is what?',
    punkte:[
      'The shared vault of all Pro apps is the folder that contains the file “tresorordner.json” (for Klaus: SD card › Privat Brain Pro Hauptablageordner). You choose this folder once in each app.',
      'Never choose the subfolder “Tresorordner” and never an app folder inside it.',
      'Inside it, each app creates its own folder: Workflow PDF Pro · Private Brain · BookLedgerPro · Familienakte.',
      'The “Eingang-…” folders are mailboxes: other apps put something there for this app.',
      'The files are only numbered and encrypted. The app shows the real name. Without the app they cannot be opened.',
      'Open files (PDF, .json, .txt) do not belong in the vault folder. Print the recovery keys or keep them separately.',
      'One password applies to all Pro apps.'
    ],
    dieseApp:'This app: folder “Workflow PDF Pro” · inbox: “Eingang-WorkflowPDF”',
    weg:'Connect: Settings (gear) › “Vault & storage” › section “Vault (all Pro apps)” › “Move into the shared vault folder …” (later “Choose another shared vault folder …”). For the storage (“Choose folder / open existing vault …”) you may choose the main folder or the “Workflow PDF Pro” folder inside it – both open the same storage.',
    original:'Save with the real name: in the library, 📤 (Share) on the document – or for a whole folder “📤 Ordner ausgeben” › “Original, unverändert” › ZIP. Choose e.g. “Downloads” as the destination, not the vault. The list with the real names is the library itself.',
    knopf:'Where is what?',schliessen:'Close',
    VAULT_ORDNER_VERWALTUNG:'This is the “Tresorordner” folder – it only holds administration files. Choose the folder above it that contains “tresorordner.json”. Nothing was created.',
    VAULT_ORDNER_FREMDES_FACH:'This is another app’s folder or an inbox. Choose the folder that contains “tresorordner.json”, or the “Workflow PDF Pro” folder. Nothing was created.',
    VAULT_ORDNER_FACH_OHNE_KOPF:'This “Workflow PDF Pro” folder contains files but no Workflow PDF Pro storage. Choose the folder that contains “tresorordner.json”. Nothing was created or changed.',
    TRESOR_ORDNER_APP_ORDNER:'This is an app folder inside the vault. Choose the folder above it that contains “tresorordner.json”. Nothing was changed.',
    TRESOR_ORDNER_VERWALTUNG:'This is the “Tresorordner” folder (administration only). Choose the folder above it that contains “tresorordner.json”. Nothing was changed.',
    TRESOR_NICHT_VORHANDEN:'This folder has no “tresorordner.json”. Choose the folder that contains “tresorordner.json”. No new vault was created.',
    TRESOR_UMGEZOGEN:'This vault has moved. Please choose the new location. Nothing was changed.',
    TRESOR_ORDNER_UNTERORDNER:'This is a folder inside the vault (a compartment, an inbox or the administration). Please choose only the storage, e.g. the SD card, or the main folder. Nothing was created.',
    TRESOR_ORDNER_MEHRERE:'There are several vaults in this storage. Please choose the main folder you want directly. Nothing was created.',
    TRESOR_NAME_BELEGT:'A folder with this name already exists there and is not empty. Please choose another name. Nothing was created.',
    TRESOR_ABLAGE_PASSWORT_ANDERS:'The vault opens with this password, but Workflow PDF Pro’s storage inside has a different (older) password. Nothing was changed. Please use “Choose folder / open existing vault” with the old password.',
    ebeneHoeher:'A folder inside the vault was chosen. The folder above it, which contains “tresorordner.json”, is now connected.',
    imTresor:'Not saved: the destination was inside the vault. Only encrypted files belong there. Please choose e.g. “Downloads”.'
  };
  const W=()=>(document.documentElement.lang||'de').startsWith('en')?EN:DE;
  const text=key=>W()[key]??DE[key];
  /** Klartext für einen Fehlercode der Ordnerwahl, sonst null. */
  function meldung(code){const c=String(code?.code||code?.message||code||'');return Object.prototype.hasOwnProperty.call(DE,c)&&/^(VAULT|TRESOR)_/.test(c)?text(c):null;}
  function zeigen(){
    document.getElementById('nativeWoLiegtWas')?.close();
    const d=document.createElement('dialog');d.id='nativeWoLiegtWas';d.className='native-vault-dialog';d.dataset.keinUe='';
    const h=document.createElement('h2');h.textContent=text('titel');
    const ul=document.createElement('ul');for(const p of text('punkte')){const li=document.createElement('li');li.textContent=p;ul.append(li);}
    const app=document.createElement('p'),weg=document.createElement('p'),orig=document.createElement('p');
    app.dataset.woApp='';app.textContent=text('dieseApp');weg.dataset.woWeg='';weg.textContent=text('weg');orig.dataset.woOriginal='';orig.textContent=text('original');
    const box=document.createElement('div');box.className='pro-knoepfe';
    const zu=window.ProBedienung?ProBedienung.knopf(text('schliessen'),{beiTipp:()=>d.close()}):Object.assign(document.createElement('button'),{type:'button',className:'knopf',textContent:text('schliessen'),onclick:()=>d.close()});
    box.append(zu);d.append(h,ul,app,weg,orig,box);document.body.append(d);
    d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();return d;
  }
  /** Flacher Knopf „Wo liegt was?“ in einen Behälter (Tresor & Ablage, Pro-Apps). */
  function knopf(behaelter){
    if(!behaelter||behaelter.querySelector('[data-wo-liegt-was]'))return null;
    const b=window.ProBedienung?ProBedienung.knopf(text('knopf'),{beiTipp:()=>void zeigen()}):Object.assign(document.createElement('button'),{type:'button',className:'knopf',textContent:text('knopf'),onclick:()=>void zeigen()});
    b.dataset.woLiegtWas='';behaelter.append(b);return b;
  }
  window.WFPWoLiegtWas=Object.freeze({zeigen,knopf,meldung,text});
})();
