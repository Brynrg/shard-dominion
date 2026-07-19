#!/usr/bin/env node
// Generate painted RTS sprites via xAI Grok Imagine (Warcraft-III quality bar).
// Resumable: existing files are skipped unless --force.
//
//   XAI_API_KEY=... node scripts/gen-art-grok.mjs [--batch N] [--only substr]
//                     [--out dir] [--delay ms] [--force] [--dry-run]
//                     [--model grok-imagine-image-quality]
//
// Enemy/faction recolors use the image-edit endpoint when basedOn is set
// (keeps chassis identical). Base sheets are text→image generations.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MODEL = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image-quality';
const GEN_URL = 'https://api.x.ai/v1/images/generations';
const EDIT_URL = 'https://api.x.ai/v1/images/edits';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i === -1 ? def : args[i + 1];
};
const has = (name) => args.includes(name);

const outDir = path.resolve(opt('--out', path.join(ROOT, 'art-drop-grok-wc3')));
const batchFilter = opt('--batch', null);
const only = opt('--only', null);
const delayMs = Number(opt('--delay', '1500'));
const force = has('--force');
const dryRun = has('--dry-run');
const model = opt('--model', MODEL);

const key = process.env.XAI_API_KEY;
if (!key && !dryRun) {
  console.error('Set XAI_API_KEY (https://console.x.ai/) — Hermes xAI OAuth is expired for Imagine.');
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

async function downloadUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function generateBase(entry) {
  const body = {
    model,
    prompt: entry.prompt,
    n: 1,
    aspect_ratio: entry.aspect || '1:1',
    response_format: 'b64_json',
  };
  const res = await fetch(GEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const json = await res.json();
  const item = json.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item?.url) return downloadUrl(item.url);
  throw new Error('no image in response');
}

async function editFromBase(entry) {
  const basePath = path.join(outDir, entry.basedOn);
  if (!fs.existsSync(basePath)) throw new Error(`base image missing: ${entry.basedOn}`);
  // OpenAI-compatible multipart edit — fall back to text-only generation if edit fails.
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', entry.prompt);
  form.append('n', '1');
  form.append('response_format', 'b64_json');
  const blob = new Blob([fs.readFileSync(basePath)], { type: 'image/png' });
  form.append('image', blob, path.basename(basePath));

  const res = await fetch(EDIT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const txt = await res.text();
    console.warn(`  edit HTTP ${res.status}, falling back to text gen: ${txt.slice(0, 160)}`);
    return generateBase(entry);
  }
  const json = await res.json();
  const item = json.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item?.url) return downloadUrl(item.url);
  throw new Error('no image in edit response');
}

async function generate(entry) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      if (entry.basedOn) return await editFromBase(entry);
      return await generateBase(entry);
    } catch (err) {
      const msg = String(err.message || err);
      if (attempt === 5 || /unauthenticated|401|403/.test(msg)) throw err;
      const wait = Math.min(60000, 2000 * 2 ** attempt);
      console.warn(`  retry ${attempt}/5 in ${wait / 1000}s — ${msg.slice(0, 160)}`);
      await sleep(wait);
    }
  }
  throw new Error('exhausted retries');
}

const plan = entries.filter((e) => force || !fs.existsSync(path.join(outDir, e.file)));
console.log(`${plan.length}/${entries.length} to generate → ${outDir} (model ${model})`);
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
  console.log('failed (rerun to retry):');
  for (const f of failed) console.log('  ' + f);
  process.exit(1);
}
