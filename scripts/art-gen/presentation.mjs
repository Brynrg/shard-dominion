// Presentation art (batch 6): painted 16:9 backdrops (title / act cards / credits)
// + stylized character portrait busts. SVG → PNG. Rendered opaque (backdrops) or
// on a dark vignette (portraits). Filenames have NO '__' so import-art routes them
// to manifest.presentation.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

const GLOW = `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
  <filter id="glowS" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>`;

// ---- 16:9 backdrops (1280x720) ----
const W = 1280, H = 720;

function crystalSeams(seed, y0, count, spread) {
  const r = rnd(seed); let s = '';
  for (let i = 0; i < count; i++) {
    const x = r() * W, len = 120 + r() * 260, ang = -Math.PI / 2 + (r() - 0.5) * 1.1;
    let px = x, py = y0 + r() * (H - y0), path = `M${px} ${py}`;
    const segs = 3 + (r() * 3 | 0);
    for (let k = 0; k < segs; k++) { px += Math.cos(ang) * (len / segs) + (r() - 0.5) * 40; py += Math.sin(ang) * (len / segs); path += ` L${px.toFixed(0)} ${py.toFixed(0)}`; }
    s += `<path d="${path}" stroke="#a06aff" stroke-width="${1.5 + r() * 2}" fill="none" opacity="${0.28 + r() * 0.3}"/><path d="${path}" stroke="#d9c4ff" stroke-width="1" fill="none" opacity="${0.3 + r() * 0.3}" filter="url(#glowS)"/>`;
  }
  return s;
}

function titleBackdrop() {
  const r = rnd(7);
  let refineries = '';
  for (let i = 0; i < 9; i++) { const x = 120 + i * 130 + r() * 40, w = 26 + r() * 40, h = 30 + r() * 46; refineries += `<rect x="${x}" y="${462 - h}" width="${w}" height="${h}" fill="#14121a"/><rect x="${x + w * 0.3}" y="${462 - h - 20}" width="6" height="20" fill="#14121a"/><circle cx="${x + w / 2}" cy="${462 - h + 8}" r="1.6" fill="#ffcf6b"/>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${GLOW}
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1430"/><stop offset="0.45" stop-color="#3a2748"/><stop offset="0.7" stop-color="#8a4a3a"/><stop offset="0.86" stop-color="#c9743a"/><stop offset="1" stop-color="#e0954a"/></linearGradient>
    <linearGradient id="dune" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4a38"/><stop offset="1" stop-color="#241826"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    <ellipse cx="760" cy="470" rx="240" ry="120" fill="#ffb85a" opacity="0.5" filter="url(#soft)"/>
    <!-- violet storm on the horizon (right) -->
    <ellipse cx="1050" cy="360" rx="220" ry="150" fill="#6a3aa0" opacity="0.45" filter="url(#soft)"/>
    <path d="M1040 250 L1020 330 L1055 330 L1025 430" stroke="#e6d4ff" stroke-width="3" fill="none" filter="url(#glowS)"/>
    <path d="M1090 270 L1075 340 L1100 340 L1080 410" stroke="#c9a8ff" stroke-width="2" fill="none" opacity="0.8" filter="url(#glowS)"/>
    ${refineries}
    <rect y="460" width="${W}" height="${H - 460}" fill="url(#dune)"/>
    <path d="M0 470 Q 320 445 640 468 T 1280 462 L1280 520 L0 520 Z" fill="#3a2a30"/>
    <path d="M0 560 Q 400 520 780 552 T 1280 548 L1280 720 L0 720 Z" fill="#241826"/>
    ${crystalSeams(31, 486, 13, 1)}
    <rect width="${W}" height="${H}" fill="#000" opacity="0.08"/></svg>`;
}

function actCard1() {
  const r = rnd(11);
  let ships = '';
  for (const [x, y, sc] of [[360, 150, 1.3], [620, 90, 1.7], [860, 180, 1.1], [980, 120, 0.9]]) {
    ships += `<g transform="translate(${x} ${y}) scale(${sc})"><ellipse cx="35" cy="150" rx="72" ry="46" fill="#d8c6a8" opacity="0.3" filter="url(#soft)"/><polygon points="-6,0 76,0 92,30 -22,30" fill="#3c4650"/><polygon points="6,-14 64,-14 76,0 -6,0" fill="#48545f"/><polygon points="-22,30 92,30 74,52 -4,52" fill="#2a333c"/><rect x="-2" y="52" width="8" height="30" fill="#222c34"/><rect x="64" y="52" width="8" height="30" fill="#222c34"/><circle cx="6" cy="15" r="3" fill="#00e5ff" filter="url(#glowS)"/><circle cx="64" cy="15" r="3" fill="#00e5ff" filter="url(#glowS)"/></g>`;
  }
  let troops = '';
  for (let i = 0; i < 22; i++) { const x = 120 + r() * 1040, y = 560 + r() * 90; troops += `<ellipse cx="${x}" cy="${y}" rx="4" ry="5" fill="#1c1a1e"/><ellipse cx="${x}" cy="${y + 8}" rx="8" ry="3" fill="#000" opacity="0.3"/>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${GLOW}
    <linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98a5a"/><stop offset="0.5" stop-color="#d8b483"/><stop offset="1" stop-color="#e7cfa6"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sky1)"/>
    <ellipse cx="400" cy="180" rx="500" ry="220" fill="#fff" opacity="0.14" filter="url(#soft)"/>
    ${ships}
    <path d="M0 600 Q 320 560 660 596 T 1280 588 L1280 720 L0 720 Z" fill="#c2a578"/>
    <path d="M0 650 Q 380 620 760 646 T 1280 640 L1280 720 L0 720 Z" fill="#a98a5f"/>
    ${crystalSeams(12, 600, 10, 1)}
    ${troops}
    <rect width="${W}" height="${H}" fill="#5a3a1a" opacity="0.06"/></svg>`;
}

function actCard2() {
  let raiders = '';
  const r = rnd(21);
  for (let i = 0; i < 11; i++) { const x = 150 + i * 95 + r() * 30, y = 300 + r() * 16, h = 60 + r() * 30; raiders += `<g fill="#0a0810"><ellipse cx="${x}" cy="${y - h}" rx="9" ry="11"/><polygon points="${x - 12},${y - h + 14} ${x + 12},${y - h + 14} ${x + 16},${y} ${x - 16},${y}"/><rect x="${x + 6}" y="${y - h - 6}" width="3" height="40" transform="rotate(20 ${x + 6} ${y - h})"/></g>`; }
  let embers = '';
  for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H; embers += `<circle cx="${x}" cy="${y}" r="${0.6 + r() * 1.4}" fill="#ff8a3a" opacity="${0.3 + r() * 0.5}"/>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${GLOW}
    <radialGradient id="vein" cx="0.5" cy="1" r="0.9"><stop offset="0" stop-color="#e6d4ff"/><stop offset="0.3" stop-color="#9a5aff"/><stop offset="0.7" stop-color="#3a1f5a"/><stop offset="1" stop-color="#0a0812"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="#0a0812"/>
    <ellipse cx="640" cy="720" rx="520" ry="360" fill="url(#vein)"/>
    <ellipse cx="640" cy="560" rx="320" ry="120" fill="#b48bff" opacity="0.5" filter="url(#soft)"/>
    <!-- something coiling beneath the light -->
    <path d="M420 600 Q 560 520 700 590 Q 840 660 900 560" stroke="#1a0f28" stroke-width="34" fill="none" opacity="0.8"/>
    <path d="M300 320 Q 640 280 980 320 L1280 340 L1280 0 L0 0 L0 340 Z" fill="#0d0a16"/>
    ${raiders}
    ${embers}</svg>`;
}

function creditsBackdrop() {
  const r = rnd(41);
  let motes = '';
  for (let i = 0; i < 60; i++) { const x = 500 + r() * 280, y = r() * H; motes += `<circle cx="${x}" cy="${y}" r="${0.6 + r() * 1.6}" fill="#d4b8ff" opacity="${0.2 + r() * 0.6}"/>`; }
  let figs = '';
  for (const x of [540, 570, 600, 720, 760]) { figs += `<ellipse cx="${x}" cy="472" rx="3" ry="4" fill="#000"/><polygon points="${x - 4},486 ${x + 4},486 ${x + 6},500 ${x - 6},500" fill="#000"/>`; }
  figs += `<g fill="#000"><rect x="660" y="480" width="34" height="16" rx="4"/><rect x="666" y="474" width="8" height="8"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${GLOW}
    <linearGradient id="aur" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e6d4ff"/><stop offset="0.4" stop-color="#8a4aff"/><stop offset="1" stop-color="#1a0f30" stop-opacity="0"/></linearGradient>
    <radialGradient id="fiss" cx="0.5" cy="1" r="0.8"><stop offset="0" stop-color="#f0e0ff"/><stop offset="0.4" stop-color="#9a5aff"/><stop offset="1" stop-color="#0a0814" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="#0a0814"/>
    <polygon points="560,720 720,720 700,60 580,60" fill="url(#aur)" opacity="0.7" filter="url(#soft)"/>
    <ellipse cx="640" cy="500" rx="220" ry="120" fill="url(#fiss)"/>
    <path d="M0 500 Q 320 480 560 496 L560 720 L0 720 Z" fill="#0d0a18"/>
    <path d="M720 496 Q 980 482 1280 500 L1280 720 L720 720 Z" fill="#0d0a18"/>
    <rect x="560" y="470" width="160" height="250" fill="url(#fiss)" opacity="0.5"/>
    ${motes}
    ${figs}
    <rect width="${W}" height="${H}" fill="#000" opacity="0.15"/></svg>`;
}

// ---- portraits (512x512), dark vignette + key-lit bust ----
const P = 512;
function frame(inner, bg = '#15151a') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}"><defs>${GLOW}
    <radialGradient id="vg" cx="0.42" cy="0.36" r="0.8"><stop offset="0" stop-color="#2c2c34"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs>
    <rect width="${P}" height="${P}" fill="url(#vg)"/>${inner}
    <rect width="${P}" height="${P}" fill="#000" opacity="0"/></svg>`;
}
// generic key-lit bust: shoulders + neck + head; skin lit from upper-left
function bust(skin, skinShadow, cloth, clothShadow, { hair, hairColor } = {}) {
  return `
    <path d="M96 512 Q 110 372 200 348 L312 348 Q 402 372 416 512 Z" fill="${cloth}"/>
    <path d="M96 512 Q 110 372 200 348 L256 348 L256 512 Z" fill="${clothShadow}" opacity="0.55"/>
    <rect x="228" y="300" width="56" height="70" rx="18" fill="${skinShadow}"/>
    <rect x="228" y="300" width="30" height="70" rx="14" fill="${skin}"/>
    <ellipse cx="256" cy="232" rx="76" ry="88" fill="${skin}"/>
    <path d="M256 144 A76 88 0 0 0 256 320 Q 214 300 210 232 Q 214 164 256 144 Z" fill="${skinShadow}" opacity="0.5"/>
    ${hair ? hair : ''}`;
}
function eyes(y, color = '#1a1414', glow) {
  const e = (cx) => glow ? `<circle cx="${cx}" cy="${y}" r="7" fill="${glow}" filter="url(#glowS)"/><circle cx="${cx}" cy="${y}" r="4" fill="#fff" opacity="0.8"/>` : `<ellipse cx="${cx}" cy="${y}" rx="8" ry="5" fill="${color}"/>`;
  return e(230) + e(286);
}

function portraitWarden() {
  return frame(`
    <path d="M70 512 Q 92 356 200 336 L312 336 Q 420 356 442 512 Z" fill="#3a4652"/>
    <path d="M70 512 Q 92 356 200 336 L256 336 L256 512 Z" fill="#222c34" opacity="0.6"/>
    <!-- shoulder plates + cyan seams -->
    <path d="M70 512 Q 78 392 150 372 L150 512 Z" fill="#4a5a68"/><path d="M442 512 Q 434 392 362 372 L362 512 Z" fill="#2f3a44"/>
    <line x1="150" y1="380" x2="150" y2="500" stroke="#00e5ff" stroke-width="3" filter="url(#glowS)"/>
    <line x1="362" y1="380" x2="362" y2="500" stroke="#00b7cf" stroke-width="3" opacity="0.7"/>
    <!-- helmet -->
    <ellipse cx="256" cy="228" rx="92" ry="104" fill="#3f4c58"/>
    <path d="M256 124 A92 104 0 0 0 256 332 Q 200 300 196 228 Q 200 156 256 124 Z" fill="#2a343e" opacity="0.6"/>
    <ellipse cx="230" cy="180" rx="34" ry="40" fill="#5a6b78" opacity="0.4"/>
    <!-- cyan visor slit -->
    <rect x="196" y="224" width="120" height="20" rx="10" fill="#062028"/>
    <rect x="200" y="228" width="112" height="10" rx="5" fill="#00e5ff" filter="url(#glowS)"/>
    <rect x="248" y="130" width="16" height="90" rx="6" fill="#2a343e"/>`, '#101418');
}
function portraitCorr() {
  const hair = `<path d="M182 200 Q 200 150 256 148 Q 312 150 330 200 Q 300 172 256 172 Q 212 172 182 200 Z" fill="#8a8a86"/><path d="M182 200 Q 190 210 190 250 L200 250 Q 196 214 200 196 Z" fill="#9a9a96"/>`;
  return frame(bust('#b98d6e', '#7a5a44', '#3a4048', '#242a30', { hair }) + eyes(224, '#2a2018') + `
    <path d="M222 250 Q 256 262 290 250" stroke="#5a4030" stroke-width="3" fill="none"/>
    <path d="M212 196 L236 200 M300 196 L276 200" stroke="#e6e6e2" stroke-width="3"/>
    <path d="M232 176 L246 182" stroke="#7a5a44" stroke-width="2"/>
    <rect x="196" y="336" width="120" height="20" fill="#2f353d"/>
    <rect x="214" y="342" width="18" height="5" fill="#00e5ff"/><rect x="238" y="342" width="18" height="5" fill="#00e5ff"/>`, '#101216');
}
function portraitVane() {
  const hair = `<path d="M180 210 Q 196 140 256 138 Q 316 140 332 210 Q 340 180 322 150 Q 290 116 256 116 Q 222 116 190 150 Q 172 180 180 210 Z" fill="#2a2420"/><path d="M330 210 Q 348 250 336 300 L316 288 Q 330 250 322 214 Z" fill="#221d1a"/>`;
  return frame(bust('#c08a62', '#824e34', '#6a6058', '#3a332e', { hair }) + eyes(226, '#241812') + `
    <!-- ash ritual streaks on one cheek -->
    <g stroke="#d8d2c8" stroke-width="4" opacity="0.75" stroke-linecap="round"><line x1="300" y1="238" x2="292" y2="276"/><line x1="314" y1="242" x2="308" y2="278"/></g>
    <!-- crimson sash -->
    <polygon points="150,420 300,512 250,512 130,470" fill="#c8203a"/>
    <path d="M222 258 Q 256 268 290 256" stroke="#6a4030" stroke-width="3" fill="none"/>
    <!-- ember rim light on right -->
    <path d="M332 200 Q 348 240 330 300" stroke="#ff7a2d" stroke-width="6" fill="none" opacity="0.5" filter="url(#glowS)"/>`, '#12100e');
}
function portraitHalex() {
  const hair = `<path d="M186 196 Q 206 150 256 150 Q 306 150 326 196 Q 320 168 256 168 Q 210 168 186 196 Z" fill="#8f9296"/>`;
  return frame(bust('#c6a488', '#8a6a52', '#2c2e34', '#1a1c20', { hair }) + `
    <!-- rimless glasses catching light -->
    <g fill="none" stroke="#cfe8ff" stroke-width="2.5" opacity="0.9"><rect x="210" y="214" width="36" height="24" rx="6"/><rect x="266" y="214" width="36" height="24" rx="6"/><line x1="246" y1="224" x2="266" y2="224"/></g>
    <line x1="214" y1="218" x2="240" y2="232" stroke="#fff" stroke-width="3" opacity="0.7"/>
    <ellipse cx="228" cy="226" rx="5" ry="3" fill="#1a1414"/><ellipse cx="284" cy="226" rx="5" ry="3" fill="#1a1414"/>
    <path d="M232 268 Q 256 274 282 266" stroke="#7a5844" stroke-width="2.5" fill="none"/>
    <!-- high collar + cyan pin -->
    <path d="M196 348 L256 384 L316 348 L316 400 L196 400 Z" fill="#22242a"/>
    <circle cx="286" cy="372" r="4" fill="#00e5ff" filter="url(#glowS)"/>`, '#0e0f12');
}
function portraitYssel() {
  const hair = `<path d="M180 214 Q 196 138 256 136 Q 316 138 332 214 Q 342 180 322 148 Q 288 112 256 112 Q 224 112 190 148 Q 170 180 180 214 Z" fill="#241a12"/>`;
  return frame(bust('#c99a6e', '#8a6440', '#6a4a2a', '#3a2818', { hair }) + eyes(226, '#1a120c') + `
    <!-- layered rich fabric with gold thread -->
    <g stroke="#e6c24a" stroke-width="2" opacity="0.8"><path d="M150 440 Q 256 470 362 440" fill="none"/><path d="M160 480 Q 256 505 352 480" fill="none"/></g>
    <!-- jewelled ear cuff + rings glint -->
    <circle cx="336" cy="250" r="5" fill="#ffe58a" filter="url(#glowS)"/>
    <g stroke="#241812" stroke-width="1"><ellipse cx="230" cy="226" rx="8" ry="5" fill="none"/></g>
    <!-- kohl-lined eyes already; warm smile -->
    <path d="M226 262 Q 256 276 288 262" stroke="#6a3a28" stroke-width="3" fill="none"/>
    <path d="M300 244 L322 240 M300 232 L320 226" stroke="#241812" stroke-width="2" opacity="0.6"/>`, '#12100c');
}
function portraitChorus() {
  const hair = `<path d="M184 200 Q 202 146 256 144 Q 310 146 328 200 Q 300 172 256 172 Q 212 172 184 200 Z" fill="#3a3440"/>`;
  return frame(bust('#a89aa0', '#6a5f6e', '#2a2630', '#1a1620', { hair }) + `
    <!-- serene wrong face: luminous violet eyes, no pupils -->
    ${eyes(226, '#b48bff')}
    <path d="M234 264 Q 256 270 280 264" stroke="#5a4a5a" stroke-width="2.5" fill="none"/>
    <!-- violet crystal growth fusing through one temple/cheek -->
    <g fill="#b48bff" opacity="0.9">
      <polygon points="300,180 316,206 300,214 288,196"/><polygon points="312,214 330,236 314,246 302,224"/>
      <polygon points="298,240 314,262 300,272 288,252"/></g>
    <g fill="#e6d4ff"><polygon points="304,188 312,204 302,208"/><polygon points="316,222 326,236 314,240"/></g>
    <ellipse cx="308" cy="222" rx="40" ry="60" fill="#b48bff" opacity="0.18" filter="url(#glow)"/>
    <!-- glowing veins beneath skin -->
    <g stroke="#b48bff" stroke-width="1.5" opacity="0.55" fill="none" filter="url(#glowS)"><path d="M256 200 Q 276 220 272 252"/><path d="M240 210 Q 232 240 244 264"/></g>`, '#0e0c14');
}

const PIECES = [
  { file: 'title_backdrop', draw: titleBackdrop },
  { file: 'act1_card', draw: actCard1 },
  { file: 'act2_card', draw: actCard2 },
  { file: 'credits_backdrop', draw: creditsBackdrop },
  { file: 'portrait_warden', draw: portraitWarden },
  { file: 'portrait_corr', draw: portraitCorr },
  { file: 'portrait_vane', draw: portraitVane },
  { file: 'portrait_halex', draw: portraitHalex },
  { file: 'portrait_yssel', draw: portraitYssel },
  { file: 'portrait_chorus', draw: portraitChorus },
];

const outDir = process.argv[2] || 'art-out';
const filter = process.argv[3] || '';
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
let n = 0;
for (const p of PIECES) {
  if (filter && !p.file.includes(filter)) continue;
  const markup = p.draw();
  const isWide = p.file.includes('backdrop') || p.file.includes('card');
  await page.setViewportSize({ width: isWide ? W : P, height: isWide ? H : P });
  await page.setContent(`<!doctype html><body style="margin:0">${markup}</body>`, { waitUntil: 'networkidle' });
  const el = await page.$('svg');
  await el.screenshot({ path: join(outDir, `${p.file}.png`) });
  console.log(`presentation ${p.file}.png`);
  n++;
}
await browser.close();
console.log(`✓ ${n} presentation pieces → ${outDir}`);
