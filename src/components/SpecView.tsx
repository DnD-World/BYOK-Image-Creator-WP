import { useState } from "react";
import type { Category } from "../types";
import { CATEGORIES, STYLES } from "../types";
import { autoFixFilename, validateFilename } from "../lib/validate";
import { Btn, CodeBlock, CopyBtn, ICheck, IFolder, IX, useRevealObserver } from "./ui";

const SIMPLE_SCHEMA = `filename,prompt,category,style,aspect_ratio,status,error,generated_at
shop_blacksmith.png,"Claymation-style medieval blacksmith shop front, warm lantern light, wooden sign with hammer icon, cozy fantasy marketplace",shop,claymation,16:9,pending,,
shop_potions.png,"Claymation-style fantasy potion shop, glowing bottles, crooked chimney, purple and green light",shop,claymation,16:9,pending,,
item_longsword.png,"Claymation-style fantasy longsword on parchment background, simple item icon, medieval D&D style",item,claymation,1:1,pending,,
event_goat_escape.png,"Claymation-style medieval street event, escaped goat running through market, children chasing it, comedic",event,claymation,16:9,pending,,`;

const FULL_SCHEMA = `id,filename,prompt,category,item_id,shop_id,event_id,style,aspect_ratio,width,height,seed,status,error,generated_at,imported_attachment_id
1,shop_blacksmith.png,"Claymation-style medieval blacksmith shop front",shop,,12,,claymation,16:9,1024,576,41,pending,,,
2,item_longsword.png,"Claymation-style fantasy longsword item icon",item,543,,,claymation,1:1,768,768,3,pending,,,`;

const BRIEF_GENERATOR = `Build a standalone image generation script that reads a CSV/XLSX manifest. For each row, it sends the prompt to an OpenAI-compatible image endpoint, saves the resulting image using the filename column, updates the status column, logs errors, and skips already completed files. The script must use environment variables for API keys and must not depend on WordPress.`;

const BRIEF_IMPORT = `After generation, there will be a separate WordPress import step that uploads the images to the Media Library so Imagify can optimize them and stores the attachment IDs in the database.`;

const NOT_ALLOWED = [
  "query WordPress",
  "query SQL",
  "query 5e.tools",
  "rewrite item text",
  "update shops",
  "create pages",
  "optimize images",
  "upload to WordPress",
  "handle payments",
  "touch player data",
];

const FOLDERS = `/generated-images/
  shop_blacksmith.png
  shop_potions.png
  item_longsword.png
  event_goat_escape.png
  npc_guard.png

/images/            ← organized copies, unique filenames
  shops/
  items/
  events/
  npcs/`;

export default function SpecView({
  styleLock,
  setStyleLock,
}: {
  styleLock: string;
  setStyleLock: (s: string) => void;
}) {
  const ref = useRevealObserver<HTMLDivElement>();
  const [playName, setPlayName] = useState("Shop Blacksmith!.png");
  const [playCat, setPlayCat] = useState<Category>("shop");
  const checks = validateFilename(playName, playCat, [], -1).filter((c) => c.id !== "unique");

  return (
    <div ref={ref} className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="reveal mb-10">
        <p className="font-mono text-[11px] tracking-[0.28em] text-ember uppercase">the law of the forge</p>
        <h2 className="mt-2 font-display text-3xl text-cream">Rules, schemas &amp; the coder brief</h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-parch">
          Everything on this page is the contract between you, the coder, and the pipeline. Keep one visual language,
          keep filenames boring, keep the generator dumb.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* schemas */}
        <section className="reveal space-y-4">
          <h3 className="font-display text-lg text-cream">01 · Manifest schemas</h3>
          <div>
            <p className="mb-2 text-[13px] text-parch">
              <span className="font-mono text-ember">simple</span> — easiest for scripts, fine to start:
            </p>
            <CodeBlock code={SIMPLE_SCHEMA} />
          </div>
          <div>
            <p className="mb-2 text-[13px] text-parch">
              <span className="font-mono text-ember">full</span> — extra ids to reconnect images to WordPress / SQL later:
            </p>
            <CodeBlock code={FULL_SCHEMA} />
          </div>
          <p className="rounded-xl border border-line bg-panel/50 px-4 py-3 text-[12.5px] leading-relaxed text-dust">
            Use <span className="font-mono text-parch">CSV or XLSX</span> — never legacy <span className="font-mono text-blood">.xls</span>.
            Statuses: <span className="font-mono text-parch">pending → generating → done → imported</span>, with{" "}
            <span className="font-mono text-blood">failed</span> and <span className="font-mono text-parch">skipped</span> as side doors.
          </p>
        </section>

        {/* filename playground */}
        <section className="reveal space-y-4">
          <h3 className="font-display text-lg text-cream">02 · Filename anvil</h3>
          <p className="text-[13px] leading-relaxed text-parch">
            Lowercase. No spaces. No special characters. Underscores. Category prefix. Unique. Try breaking one:
          </p>
          <div className="plaque rounded-xl p-4">
            <div className="flex gap-2">
              <input
                value={playName}
                onChange={(e) => setPlayName(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-line bg-[#191310] px-3 py-2 font-mono text-[13px] text-cream"
              />
              <select
                value={playCat}
                onChange={(e) => setPlayCat(e.target.value as Category)}
                className="rounded-lg border border-line bg-[#191310] px-2 py-2 font-mono text-[12px] text-cream"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <ul className="mt-3.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {checks.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-[12px]">
                  {c.pass ? <ICheck size={12} className="shrink-0 text-moss" /> : <IX size={12} className="shrink-0 text-blood" />}
                  <span className={c.pass ? "text-parch" : "text-blood"}>{c.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3.5 flex items-center gap-2.5 border-t border-line pt-3.5">
              <Btn variant="primary" onClick={() => setPlayName(autoFixFilename(playName, playCat))}>
                strike it straight
              </Btn>
              <span className="min-w-0 truncate font-mono text-[12px] text-moss">{autoFixFilename(playName, playCat)}</span>
            </div>
          </div>
          <div>
            <p className="mb-2 font-mono text-[10px] tracking-[0.22em] text-dust uppercase">folder layout</p>
            <CodeBlock code={FOLDERS} />
          </div>
        </section>

        {/* style discipline */}
        <section className="reveal space-y-4">
          <h3 className="font-display text-lg text-cream">03 · One visual language</h3>
          <p className="text-[13px] leading-relaxed text-parch">
            Every prompt carries the same style block. Lock one before generation — the forge warns the moment a row
            drifts.
          </p>
          <div className="space-y-2.5">
            {STYLES.map((s) => {
              const active = styleLock === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStyleLock(s.id)}
                  className={`btn-press w-full rounded-xl border px-4 py-3 text-left transition ${
                    active ? "border-ember/60 bg-ember/8 shadow-[0_0_0_1px_rgba(242,163,60,0.25)]" : "border-line bg-panel/50 hover:border-line2"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex shrink-0 overflow-hidden rounded-md border border-line">
                      {s.swatch.map((c) => (
                        <span key={c} className="h-5 w-5" style={{ background: c }} />
                      ))}
                    </span>
                    <span className="flex-1">
                      <span className="font-display text-[14px] tracking-wide text-cream">{s.name}</span>
                      {active && <span className="ml-2 font-mono text-[10px] text-ember">· LOCKED FOR ALL ROWS</span>}
                    </span>
                    <span onClick={(e) => e.stopPropagation()}>
                      <CopyBtn text={s.block} label="copy block" />
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed break-words text-dust">{s.block}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* brief + not-allowed */}
        <section className="reveal space-y-4">
          <h3 className="font-display text-lg text-cream">04 · Hand these to the coder</h3>
          {[
            ["the generator brief", BRIEF_GENERATOR, "border-ember/40"],
            ["the importer brief", BRIEF_IMPORT, "border-lagoon/40"],
          ].map(([label, text, border]) => (
            <blockquote key={label} className={`rounded-xl border ${border} bg-panel/50 p-4`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.22em] text-dust uppercase">{label}</span>
                <CopyBtn text={text} />
              </div>
              <p className="text-[13px] leading-relaxed text-parch">“{text}”</p>
            </blockquote>
          ))}

          <div className="rounded-xl border border-blood/30 bg-blood/6 p-4">
            <p className="mb-3 font-mono text-[10px] tracking-[0.22em] text-blood uppercase">
              what the generator must NOT do · v1
            </p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {NOT_ALLOWED.map((n) => (
                <li key={n} className="flex items-center gap-2 text-[12.5px] text-parch">
                  <IX size={11} className="shrink-0 text-blood" />
                  {n}
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-blood/20 pt-3 text-[12.5px] text-dust">
              It does one thing: <span className="text-cream">generate images from prompts.</span>
            </p>
          </div>

          <div className="plaque flex items-center gap-3 rounded-xl p-4">
            <IFolder size={20} className="shrink-0 text-ember" />
            <p className="text-[12.5px] leading-relaxed text-parch">
              Output of a run: <span className="font-mono text-cream">/generated-images/*.png</span> plus the updated
              CSV. That's the entire surface area.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
