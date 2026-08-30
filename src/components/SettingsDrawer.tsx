/** Folder-link state shared between App, TopMenu and SettingsView. */
export interface FolderState {
  linked: boolean;
  name: string;
  /** folder handle persisted but permission needs re-confirming */
  pendingName: string | null;
  error: string;
  /** Tauri desktop build only — the plain path (no permission dance needed) */
  path?: string;
}
