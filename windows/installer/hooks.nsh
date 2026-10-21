; Workflow PDF Pro: im Menü "Öffnen mit" für PDF und Bilder anbieten.
; Die Standard-App des Nutzers wird NICHT verändert (nur OpenWithProgids).
; Installation pro Benutzer, daher alles unter HKCU.

!define WFP_PROGID "WorkflowPDFPro.Dokument"
!define WFP_EXE "workflow-pdf-pro.exe"

!macro WFP_OPENWITH EXT
  WriteRegStr HKCU "Software\Classes\${EXT}\OpenWithProgids" "${WFP_PROGID}" ""
  WriteRegStr HKCU "Software\Classes\Applications\${WFP_EXE}\SupportedTypes" "${EXT}" ""
!macroend

!macro WFP_OPENWITH_REMOVE EXT
  DeleteRegValue HKCU "Software\Classes\${EXT}\OpenWithProgids" "${WFP_PROGID}"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Classes\${WFP_PROGID}" "" "Dokument für Workflow PDF Pro"
  WriteRegStr HKCU "Software\Classes\${WFP_PROGID}\DefaultIcon" "" '"$INSTDIR\${WFP_EXE}",0'
  WriteRegStr HKCU "Software\Classes\${WFP_PROGID}\shell\open\command" "" '"$INSTDIR\${WFP_EXE}" "%1"'
  WriteRegStr HKCU "Software\Classes\Applications\${WFP_EXE}" "FriendlyAppName" "Workflow PDF Pro"
  WriteRegStr HKCU "Software\Classes\Applications\${WFP_EXE}\shell\open\command" "" '"$INSTDIR\${WFP_EXE}" "%1"'
  !insertmacro WFP_OPENWITH ".pdf"
  !insertmacro WFP_OPENWITH ".png"
  !insertmacro WFP_OPENWITH ".jpg"
  !insertmacro WFP_OPENWITH ".jpeg"
  !insertmacro WFP_OPENWITH ".webp"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  !insertmacro WFP_OPENWITH_REMOVE ".pdf"
  !insertmacro WFP_OPENWITH_REMOVE ".png"
  !insertmacro WFP_OPENWITH_REMOVE ".jpg"
  !insertmacro WFP_OPENWITH_REMOVE ".jpeg"
  !insertmacro WFP_OPENWITH_REMOVE ".webp"
  DeleteRegKey HKCU "Software\Classes\${WFP_PROGID}"
  DeleteRegKey HKCU "Software\Classes\Applications\${WFP_EXE}"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
