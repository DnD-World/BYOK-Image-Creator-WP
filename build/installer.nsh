; Image Forge — custom NSIS uninstall step.
; electron-builder injects this into the generated uninstaller via nsis.include.
;
; Behaviour: uninstalling always removes the app itself, shortcuts and registry
; entries (electron-builder handles those). This macro adds ONE question:
; whether to also delete the user's data in %APPDATA%\Image Forge
; (manifest, recipes, engine keys, marketplace progress).
; The default answer is NO — data survives a normal uninstall, which matches
; deleteAppDataOnUninstall: false in the builder config.

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Remove your Image Forge data as well?$\r$\n$\r$\nThis deletes the manifest, recipes, engine keys and marketplace$\r$\nprogress stored in %APPDATA%.$\r$\n$\r$\nImages you generated on disk are NOT touched.$\r$\n$\r$\nAnswer No to keep everything for a future reinstall." IDNO keepForgeData
    RMDir /r "$APPDATA\Image Forge"
  keepForgeData:
!macroend
