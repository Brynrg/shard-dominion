#!/usr/bin/env node
// Generate the full art drop via the Gemini image API (Nano Banana), saving every
// image under the exact filename the import pipeline expects. Resumable: already-
// existing files are skipped, so rerun freely after failures or re-rolls.
//
// Usage:
//   GEMINI_API_KEY=... node scripts/gen-art-gemini.mjs [--batch N] [--only substr]
//                        [--out dir] [--delay ms] [--force] [--dry-run]
//
//   --batch N    only batch N (1..7); default all, in batch order
//   --only s     only files whose name contains s
//   --out dir    output folder (default: <repo>/art-drop)
//   --delay ms   pause between API calls (default 4000; raise on free-tier 429s)
//   --force      regenerate even if the file exists (use with --only to re-roll one)
//   --dry-run    list what would be generated, no API calls
//
// Key: https://aistudio.google.com/apikey (free). Repaint/variant entries attach the
// already-generated base PNG as image input so the chassis stays identical.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// gemini-2.5-flash-image is retired for new API users (403); 3.1-flash-image is current.
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i === -1 ? def : args[i + 1];
};
const has = (name) => args.includes(name);

const outDir = path.resolve(opt('--out', path.join(ROOT, 'art-drop')));
const batchFilter = opt('--batch', null);
const only = opt('--only', null);
const delayMs = Number(opt('--delay', '4000'));
const force = has('--force');
const dryRun = has('--dry-run');

const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!key && !dryRun) {
  console.error('Set GEMINI_API_KEY (get one free at https://aistudio.google.com/apikey)');
  process.exit(1);
}

let entries = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'art-prompts.json'), 'utf8'));
entries.sort((a, b) => a.batch - b.batch);
if (batchFilter) entries = entries.filter((e) => String(e.batch) === batchFilter);
if (only) entries = entries.filter((e) => e.file.includes(only));
if (!entries.length) {
  console.error('No entries match the filters.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(entry) {
  const parts = [];
  if (entry.basedOn) {
    const basePath = path.join(outDir, entry.basedOn);
    if (!fs.existsSync(basePath)) throw new Error(`base image missing: ${entry.basedOn} — generate it first`);
    parts.push({ inline_data: { mime_type: 'image/png', data: fs.readFileSync(basePath).toString('base64') } });
  }
  parts.push({ text: entry.prompt });

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: entry.aspect },
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      const txt = await res.text();
      const wait = Math.min(60000, 5000 * 2 ** attempt);
      console.warn(`  HTTP ${res.status}, retry ${attempt}/5 in ${wait / 1000}s ${txt.slice(0, 120)}`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    const outParts = json.candidates?.[0]?.content?.parts ?? [];
    const img = outParts.find((p) => p.inlineData?.data || p.inline_data?.data);
    if (!img) {
      const text = outParts.map((p) => p.text).filter(Boolean).join(' ').slice(0, 200);
      throw new Error(`no image in response (${json.candidates?.[0]?.finishReason ?? 'no candidate'}) ${text}`);
    }
    return Buffer.from((img.inlineData ?? img.inline_data).data, 'base64');
  }
  throw new Error('exhausted retries');
}

const plan = entries.filter((e) => force || !fs.existsSync(path.join(outDir, e.file)));
console.log(`${plan.length}/${entries.length} to generate → ${outDir} (model ${MODEL})`);
if (dryRun) {
  for (const e of plan) console.log(`  [b${e.batch}] ${e.file}${e.basedOn ? `  (from ${e.basedOn})` : ''} ${e.aspect}`);
  process.exit(0);
}

let ok = 0;
const failed = [];
for (const e of plan) {
  const dest = path.join(outDir, e.file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  process.stdout.write(`[b${e.batch}] ${e.file} ... `);
  try {
    const buf = await generate(e);
    fs.writeFileSync(dest, buf);
    ok++;
    console.log(`ok (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    failed.push(e.file);
    console.log(`FAILED: ${err.message}`);
  }
  if (plan.indexOf(e) < plan.length - 1) await sleep(delayMs);
}

console.log(`\ndone: ${ok} generated, ${failed.length} failed, ${entries.length - plan.length} already existed`);
if (failed.length) {
  console.log('failed (rerun the same command to retry just these):');
  for (const f of failed) console.log('  ' + f);
  process.exit(1);
}
