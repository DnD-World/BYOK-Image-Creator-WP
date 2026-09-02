import type { Category, ManifestRow } from "../types";

/** What the categories were called before they described the artefact. */
const LEGACY_PREFIXES: string[] = ["shop_", "item_", "event_", "npc_"];

export interface RuleCheck {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
}

export function validateFilename(
  name: string,
  category: Category,
  allNames: { id: number; filename: string }[],
  rowId: number
): RuleCheck[] {
  return [
    { id: "lowercase", label: "lowercase only", pass: name.length > 0 && name === name.toLowerCase() },
    { id: "nospace", label: "no spaces", pass: !/\s/.test(name) },
    {
      id: "nospecial",
      label: "no special characters",
      pass: /^[a-z0-9_]+\.png$/.test(name),
      detail: "only a–z, 0–9, underscores and a .png extension",
    },
    { id: "underscores", label: "words joined with underscores", pass: !/--|-{2,}/.test(name) && !/__/.test(name) },
    {
      id: "prefix",
      label: `category prefix “${category}_”`,
      // Legacy prefixes count as valid for "image".
      //
      // The categories used to be shop / item / event / npc and are now asset
      // types. Migrating a row's category is free; renaming its file is not —
      // those PNGs already exist on disk under the old name. Rejecting them
      // would mark every row of an existing manifest broken over a change the
      // user never asked for. New rows get the new prefix; old ones are left
      // alone and still pass.
      pass: name.startsWith(category + "_") || (category === "image" && LEGACY_PREFIXES.some((lp) => name.startsWith(lp))),
    },
    { id: "ext", label: "ends with .png", pass: /\.png$/.test(name) },
    {
      id: "unique",
      label: "unique across the manifest",
      pass: name !== "" && !allNames.some((r) => r.id !== rowId && r.filename === name),
    },
  ];
}

export function autoFixFilename(raw: string, category: Category): string {
  let base = raw.toLowerCase().replace(/\.png$/, "").trim();
  base = base.replace(/[\s\-]+/g, "_");
  base = base.replace(/[^a-z0-9_]/g, "");
  base = base.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (!base) base = "untitled";
  const prefix = category + "_";
  if (!base.startsWith(prefix)) {
    base = base.replace(/^(shop|item|event|npc)_/, "");
    base = prefix + base;
  }
  return base + ".png";
}

export function styleDriftCount(rows: ManifestRow[], locked: string): number {
  return rows.filter((r) => r.style !== locked).length;
}

export function violationCount(rows: ManifestRow[]): number {
  const names = rows.map((x) => ({ id: x.id, filename: x.filename }));
  return rows.filter((r) => validateFilename(r.filename, r.category, names, r.id).some((c) => !c.pass)).length;
}
