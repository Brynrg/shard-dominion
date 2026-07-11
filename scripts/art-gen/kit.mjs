// Code-drawn sprite kit — painted late-90s Westwood-style top-down RTS art, authored
// as SVG and rasterized (render.mjs) to transparent-alpha PNGs. No magenta bg, no
// baked ground shadow, no base pad: we simply don't draw them. Faction recolor = swap
// the palette token. This replaces the diffusion-model art path (Gemini/Grok) which
// kept baking shadows/pads and refusing clean recolors.

// ---- colour helpers -------------------------------------------------------
export function hexToRgb(h) {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** Lighten (amt>0) or darken (amt<0) toward white/black. amt in [-1,1]. */
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}

// ---- faction palettes (from docs/ART_ASSETS_SPEC + art-prompts.json) ------
export const PALETTES = {
  player:  { main: '#3d7fd6', shadow: '#28568f', hi: '#a7d6ff', accent: '#00e5ff' },
  enemy:   { main: '#d1503a', shadow: '#8f3020', hi: '#ffb08f', accent: '#ff4a3d' },
  neutral: { main: '#9a9a9a', shadow: '#6a6a6a', hi: '#d8d8d8', accent: '#ff5a3c' },
  // faction skins (XP-3): concord=player-ish, emberhand=enemy-ish, shardborn=violet
  emberhand: { main: '#c0563f', shadow: '#7d2f1f', hi: '#ffbf8f', accent: '#ff7a2d' },
  shardborn: { main: '#7d6a9a', shadow: '#4f3f6e', hi: '#c9b7ea', accent: '#b48bff' },
};
export function pal(team) { return PALETTES[team] ?? PALETTES.player; }

// ---- svg building blocks --------------------------------------------------
let _uid = 0;
const uid = (p) => `${p}${_uid++}`;

/** Standard defs: per-call gradient + a soft glow filter for accent lights. */
export function defs(inner) {
  return `<defs>${inner}</defs>`;
}

/** A painted "lit-from-upper-left" fill gradient for a roof/top face. */
export function topGrad(p) {
  const id = uid('g');
  return {
    id,
    def: `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(p.hi, 0.05)}"/>
      <stop offset="0.42" stop-color="${p.main}"/>
      <stop offset="1" stop-color="${shade(p.shadow, 0.08)}"/>
    </linearGradient>`,
  };
}

/** Extruded block: dark side shows below/right, lit top on top. Reads as height
 *  under an over-the-shoulder top-down camera. Returns svg string; caller supplies
 *  a pre-registered top-gradient id `gid`. */
export function block(x, y, w, h, depth, p, gid, r = 14) {
  const rim = shade(p.shadow, -0.4);
  return `
    <rect x="${x}" y="${y + depth}" width="${w}" height="${h}" rx="${r}" fill="${shade(p.shadow, -0.12)}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${gid})" stroke="${rim}" stroke-width="3"/>`;
}

/** Roof panel seam lines (thin, slightly darker than main). */
export function seams(x, y, w, h, p, cols = 2, rows = 2) {
  const c = shade(p.shadow, 0.02);
  let s = `<g stroke="${c}" stroke-width="2" opacity="0.55">`;
  for (let i = 1; i < cols; i++) { const px = x + (w * i) / cols; s += `<line x1="${px}" y1="${y + 6}" x2="${px}" y2="${y + h - 6}"/>`; }
  for (let j = 1; j < rows; j++) { const py = y + (h * j) / rows; s += `<line x1="${x + 6}" y1="${py}" x2="${x + w - 6}" y2="${py}"/>`; }
  return s + '</g>';
}

/** A slatted vent block. */
export function vent(x, y, w, h, p) {
  const d = shade(p.shadow, -0.25), l = shade(p.main, 0.12);
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${d}"/>`;
  const n = Math.max(2, Math.round(h / 7));
  for (let i = 0; i < n; i++) s += `<rect x="${x + 3}" y="${y + 3 + i * (h - 4) / n}" width="${w - 6}" height="2.4" fill="${l}"/>`;
  return s;
}

/** A glowing accent light (uses the shared 'glow' filter). */
export function light(cx, cy, r, colour) {
  return `<circle cx="${cx}" cy="${cy}" r="${r * 2.1}" fill="${colour}" opacity="0.35" filter="url(#glow)"/>
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="${shade(colour, 0.55)}"/>
          <circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="#ffffff" opacity="0.9"/>`;
}

/** The shared glow filter def (include once per sprite). */
export const GLOW_DEF = `<filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
  <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>`;

// ---- vehicle / unit building blocks (top-down, facing UP) -----------------

/** A pair of tracked treads flanking a hull, with rung detail. */
export function tracks(lx, rx, y, w, h, p) {
  const tread = shade(p.shadow, -0.38), rung = shade(p.shadow, -0.55);
  const rungs = Math.max(4, Math.round(h / 22));
  let s = `<rect x="${lx}" y="${y}" width="${w}" height="${h}" rx="10" fill="${tread}"/>
           <rect x="${rx}" y="${y}" width="${w}" height="${h}" rx="10" fill="${tread}"/>
           <g stroke="${rung}" stroke-width="3">`;
  for (let i = 0; i < rungs; i++) {
    const yy = y + 8 + (i * (h - 12)) / (rungs - 1);
    s += `<line x1="${lx}" y1="${yy}" x2="${lx + w}" y2="${yy}"/><line x1="${rx}" y1="${yy}" x2="${rx + w}" y2="${yy}"/>`;
  }
  return s + '</g>';
}

/** Round wheels down each side (for wheeled vehicles). */
export function wheels(lx, rx, y0, y1, r, n, p) {
  const t = shade(p.shadow, -0.4), hub = shade(p.main, 0.1);
  let s = '';
  for (let i = 0; i < n; i++) {
    const yy = y0 + (i * (y1 - y0)) / (n - 1);
    for (const cx of [lx, rx]) s += `<circle cx="${cx}" cy="${yy}" r="${r}" fill="${t}"/><circle cx="${cx}" cy="${yy}" r="${r * 0.45}" fill="${hub}"/>`;
  }
  return s;
}

/** A rotatable turret ring + hatch. */
export function turret(cx, cy, r, p) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${shade(p.main, 0.08)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5"/>
          <circle cx="${cx - r * 0.2}" cy="${cy - r * 0.2}" r="${r * 0.5}" fill="${shade(p.hi, 0)}" opacity="0.22"/>
          <circle cx="${cx}" cy="${cy}" r="${r * 0.4}" fill="${shade(p.shadow, -0.12)}"/>`;
}

/** A forward gun barrel pointing up from (cx, baseY), length len. */
export function barrel(cx, baseY, len, w, p, muzzle) {
  const tipY = baseY - len;
  let s = `<rect x="${cx - w / 2}" y="${tipY}" width="${w}" height="${len}" rx="${w / 2}" fill="${shade(p.main, 0.14)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5"/>`;
  if (muzzle) s += `<rect x="${cx - w * 0.75}" y="${tipY}" width="${w * 1.5}" height="12" rx="4" fill="${shade(muzzle, 0.1)}"/>`;
  return s;
}

/** Top-down infantry figure: helmet + shoulders + a held weapon. Sized to FILL
 *  the 512 frame (so it scales down to a readable on-screen unit, not a dot). */
export function soldier(cx, cy, p, { hero = false, weapon = 'rifle' } = {}) {
  const scale = hero ? 1.35 : 1;
  const bodyR = 66 * scale, headR = 36 * scale;
  const cloth = shade(p.main, -0.05), pack = shade(p.shadow, -0.05);
  const topY = cy - bodyR; // shoulder line
  let w = '';
  if (weapon === 'rifle') w = `<rect x="${cx - 9}" y="${topY - 96 * scale}" width="18" height="${118 * scale}" rx="6" fill="${shade(p.shadow, -0.5)}"/><rect x="${cx - 13}" y="${topY - 96 * scale}" width="26" height="16" rx="5" fill="${shade(p.shadow, -0.35)}"/>`;
  if (weapon === 'rocket') w = `<rect x="${cx - 15}" y="${topY - 104 * scale}" width="30" height="${132 * scale}" rx="9" fill="${shade(p.shadow, -0.45)}"/><rect x="${cx - 19}" y="${topY - 104 * scale}" width="38" height="20" rx="7" fill="${shade(p.accent, 0.1)}"/><rect x="${cx - 6}" y="${topY - 40 * scale}" width="12" height="40" fill="${shade(p.shadow, -0.2)}"/>`;
  if (weapon === 'cannon') w = barrel(cx, topY + 10, 150 * scale, 30 * scale, p, p.accent);
  return `${w}
    <ellipse cx="${cx}" cy="${cy + bodyR * 0.55}" rx="${bodyR * 0.9}" ry="${bodyR * 0.55}" fill="${pack}"/>
    <ellipse cx="${cx}" cy="${cy + 8}" rx="${bodyR}" ry="${bodyR * 0.95}" fill="${cloth}" stroke="${shade(p.shadow, -0.4)}" stroke-width="4"/>
    <ellipse cx="${cx - bodyR * 0.3}" cy="${cy - bodyR * 0.15}" rx="${bodyR * 0.45}" ry="${bodyR * 0.4}" fill="${shade(p.hi, 0)}" opacity="0.16"/>
    <circle cx="${cx}" cy="${cy - 6}" r="${headR}" fill="${shade(p.main, 0.12)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3"/>
    <circle cx="${cx - headR * 0.28}" cy="${cy - headR * 0.35}" r="${headR * 0.42}" fill="${shade(p.hi, 0)}" opacity="0.32"/>
    ${hero ? light(cx, cy - 6, 8, p.accent) : ''}`;
}

/** A glowing translucent rotor disc (for aircraft). */
export function rotorDisc(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" opacity="0.10"/>
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.22"/>
          <circle cx="${cx}" cy="${cy}" r="4" fill="#2a2a2a"/>`;
}

/** Wrap sprite body in a sized root svg (transparent bg). */
export function svg(w, h, defsInner, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${defs(GLOW_DEF + defsInner)}${body}</svg>`;
}
