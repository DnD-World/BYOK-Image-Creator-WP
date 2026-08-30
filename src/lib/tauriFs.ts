/**
 * Tauri superpowers — native folder access without permission re-prompts.
 *
 * In the browser build these functions are never reached (isTauri() is false);
 * in the desktop build they replace the File System Access API, which means:
 *   · folder linking survives restarts with zero re-confirmation
 *   · works even where the browser API is unavailable
 */
import type { ManifestRow } from "../types";
import { CATEGORY_FOLDER } from "./output";

export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const LS_TAURI_FOLDER = "image-forge-tauri-folder";

export function saveTauriFolder(path: string): void {
  try {
    localStorage.setItem(LS_TAURI_FOLDER, path);
  } catch { /* non-fatal */ }
}
export function loadTauriFolder(): string | null {
  try {
    return localStorage.getItem(LS_TAURI_FOLDER);
  } catch {
    return null;
  }
}
export function clearTauriFolder(): void {
  try {
    localStorage.removeItem(LS_TAURI_FOLDER);
  } catch { /* non-fatal */ }
}

export const tauriFolderName = (fullPath: string): string =>
  fullPath.split(/[\\/]/).filter(Boolean).pop() ?? fullPath;

/** Native "pick a folder" dialog. Returns null when the user cancels. */
export async function tauriPickFolder(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ directory: true, multiple: false });
  return typeof picked === "string" ? picked : null;
}

/** Writes one manifest image under its category subfolder, creating it if needed. */
export async function tauriWriteImage(root: string, row: ManifestRow, blob: Blob): Promise<string> {
  const { writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
  const dir = `${root}/${CATEGORY_FOLDER[row.category]}`;
  await mkdir(dir, { recursive: true });
  const data = new Uint8Array(await blob.arrayBuffer());
  await writeFile(`${dir}/${row.filename}`, data);
  return `${tauriFolderName(root)}/${CATEGORY_FOLDER[row.category]}/${row.filename}`;
}

export async function tauriWriteText(root: string, name: string, text: string): Promise<void> {
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  await writeFile(`${root}/${name}`, new TextEncoder().encode(text));
}
