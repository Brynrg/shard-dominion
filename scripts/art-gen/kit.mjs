// Code-drawn sprite kit — "Obsidian Bloom" visual identity: painted-but-faceted
// top-down RTS art, authored as SVG and rasterized (render.mjs) to transparent-
// alpha PNGs. No magenta bg, no baked ground shadow, no base pad: we simply don't
// draw them. Faction recolor = swap the palette token. Shape LANGUAGE (chamfer /
// spike / facet) is encoded once here as generator params on the shared primitives
// (block/turret/tracks/wheels/soldier/vent) — shapes.mjs call sites stay the same
// silhouette layout per building/unit; the language + palette are injected here.

// ---- deterministic PRNG (mulberry32) --------------------------------------
// The ONE seeded generator every jittered/faceted primitive uses (terrain bake,
// unit/building facets, HUD panels, corruption cracks all import this same fn
// — stable per (region/entity) seed so output doesn't crawl frame to frame).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Cheap string→uint32 hash (for seeding by assetId/entity-id, not just an int). */
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

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
/** Linear blend a→b by t in [0,1]. */
export function mixHex(a, b, t) {
  const [ar, ag, ab] = hexToRgb(a), [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

// ---- "Obsidian Bloom" faction palettes -------------------------------------
// lang: which shape-language generator path block()/turret()/etc take.
// main/shadow/hi/accent keep the pre-existing token names other helpers read.
export const PALETTES = {
  concord:   { lang: 'concord',   main: '#c7d6e8', shadow: '#2a2f38', hi: '#eef4fb', accent: '#4fd6ff' },
  emberhand: { lang: 'emberhand', main: '#ff6a2b', shadow: '#211a17', hi: '#ffcf9e', accent: '#ffb23e' },
  shardborn: { lang: 'shardborn', main: '#3ddc97', shadow: '#1c2b26', hi: '#c8fff0', accent: '#7fffe0' },
  neutral:   { lang: 'neutral',   main: '#8a8f98', shadow: '#33363c', hi: '#c6ccd4', accent: '#ffcf4a' },
  // Back-compat team aliases (default 1v1 = Concord vs Emberhand).
  player: null, enemy: null,
};
PALETTES.player = PALETTES.concord;
PALETTES.enemy = PALETTES.emberhand;
export function pal(team) { return PALETTES[team] ?? PALETTES.neutral; }

// ---- svg building blocks --------------------------------------------------
let _uid = 0;
const uid = (p) => `${p}${_uid++}`;

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

// ---- shape-language primitives ---------------------------------------------

/** 45°-chamfered rect corner points (Concord: no rounding, ever). cut = corner size. */
export function chamferPoints(x, y, w, h, cut) {
  const c = Math.min(cut, w / 2.2, h / 2.2);
  return [
    [x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c],
    [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c],
  ];
}
export function chamferRectPath(x, y, w, h, cut) {
  const pts = chamferPoints(x, y, w, h, cut);
  return `M ${pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' L ')} Z`;
}

/** Jagged spike-edge silhouette (Emberhand: raw, torn, industrial). Perturbs a
 *  rect boundary outward at `spikes` points around the perimeter, seeded so a
 *  given (x,y,w,h,seed) always jags the same way. */
export function jaggedRectPath(x, y, w, h, seed, amp = 6, spikes = 5) {
  const rnd = mulberry32(seed >>> 0);
  const top = [], bottom = [], left = [], right = [];
  const edge = (x0, y0, x1, y1, n) => {
    const pts = [[x0, y0]];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const bx = x0 + (x1 - x0) * t, by = y0 + (y1 - y0) * t;
      const nx = -(y1 - y0), ny = (x1 - x0);
      const len = Math.hypot(nx, ny) || 1;
      const j = (rnd() - 0.3) * amp; // biased outward
      pts.push([bx + (nx / len) * j, by + (ny / len) * j]);
    }
    pts.push([x1, y1]);
    return pts;
  };
  top.push(...edge(x, y, x + w, y, spikes));
  right.push(...edge(x + w, y, x + w, y + h, spikes));
  bottom.push(...edge(x + w, y + h, x, y + h, spikes));
  left.push(...edge(x, y + h, x, y, spikes));
  const all = [...top, ...right, ...bottom, ...left];
  return `M ${all.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' L ')} Z`;
}

/** shatterFacet(cx, cy, r, opts) — THE shared primitive: seeded PRNG driving a
 *  jittered radial-fan triangulation, each triangle filled baseColor ± valueJitter%
 *  lightness. Used by terrain bake, unit/building silhouettes (Shardborn), HUD
 *  panels, and the (recolored) corruption crack network all call the same algorithm
 *  — this SVG string form for build-time art-gen; a Canvas2D port lives in
 *  src/view/facet.ts for runtime (terrain bake / HUD / cracks can't be pre-rasterized
 *  offline the way sprite art can). */
export function shatterFacet(cx, cy, r, { seed = 1, facets = 10, jitter = 0.22, baseColor, valueJitter = 0.14 } = {}) {
  const rnd = mulberry32(seed >>> 0);
  const ring = [];
  for (let i = 0; i < facets; i++) {
    const a = (i / facets) * Math.PI * 2 + (rnd() - 0.5) * (Math.PI / facets) * 0.6;
    const rr = r * (1 - jitter / 2 + rnd() * jitter);
    ring.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  let s = '';
  for (let i = 0; i < facets; i++) {
    const a = ring[i], b = ring[(i + 1) % facets];
    const v = (rnd() - 0.5) * 2 * valueJitter;
    const fill = shade(baseColor, v);
    s += `<polygon points="${cx},${cy} ${a[0].toFixed(1)},${a[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}" fill="${fill}"/>`;
  }
  return `<g>${s}</g>`;
}

/** Shardborn hull: shatterFacet fill clipped to a soft convex-hull-ish blob (large
 *  bezier corners → "no straight edges") instead of a flat gradient rect. */
export function facetHullBlock(x, y, w, h, p, seed, r = 0.5) {
  const cx = x + w / 2, cy = y + h / 2;
  const rad = Math.max(w, h) * 0.62;
  const cut = Math.min(w, h) * r;
  const clipId = uid('clip');
  // Soft bezier-hull clip path (rounded well past a normal border-radius).
  const clip = `<clipPath id="${clipId}"><path d="
    M ${x + cut},${y}
    Q ${x},${y} ${x},${y + cut}
    L ${x},${y + h - cut} Q ${x},${y + h} ${x + cut},${y + h}
    L ${x + w - cut},${y + h} Q ${x + w},${y + h} ${x + w},${y + h - cut}
    L ${x + w},${y + cut} Q ${x + w},${y} ${x + w - cut},${y}
    Z"/></clipPath>`;
  const facetSeed = (seed ^ 0x9e3779b9) >>> 0;
  const body = `<g clip-path="url(#${clipId})">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${shade(p.shadow, -0.1)}"/>
    ${shatterFacet(cx, cy, rad, { seed: facetSeed, facets: 12, jitter: 0.3, baseColor: p.main, valueJitter: 0.16 })}
  </g>`;
  return { def: clip, body, outline: `<path d="M ${x + cut},${y} Q ${x},${y} ${x},${y + cut} L ${x},${y + h - cut} Q ${x},${y + h} ${x + cut},${y + h} L ${x + w - cut},${y + h} Q ${x + w},${y + h} ${x + w},${y + h - cut} L ${x + w},${y + cut} Q ${x + w},${y} ${x + w - cut},${y} Z" fill="none" stroke="${shade(p.shadow, -0.45)}" stroke-width="3"/>` };
}

/** Extruded block, dispatched by faction language. Same call signature as the
 *  legacy helper (x,y,w,h,depth,p,gid,r) so every shapes.mjs call site is unchanged
 *  — only the language transform + palette differ. `r` doubles as "chamfer cut" for
 *  Concord and "clip roundness" for Shardborn. */
export function block(x, y, w, h, depth, p, gid, r = 14) {
  const rim = shade(p.shadow, -0.4);
  if (p.lang === 'shardborn') {
    const seed = hashStr(`${x}|${y}|${w}|${h}`);
    const hull = facetHullBlock(x, y, w, h + depth * 0.5, p, seed, 0.42);
    return `${defs(hull.def)}${hull.body}${hull.outline}`;
  }
  if (p.lang === 'emberhand') {
    const seed = hashStr(`${x}|${y}|${w}|${h}|eh`);
    const dPath = jaggedRectPath(x, y + depth, w, h, seed ^ 7, 5, 6);
    const path = jaggedRectPath(x, y, w, h, seed, 5, 6);
    return `
      <path d="${dPath}" fill="${shade(p.shadow, -0.12)}"/>
      <path d="${path}" fill="url(#${gid})" stroke="${rim}" stroke-width="3"/>`;
  }
  if (p.lang === 'concord') {
    const cut = Math.max(10, r);
    const dPath = chamferRectPath(x, y + depth, w, h, cut);
    const path = chamferRectPath(x, y, w, h, cut);
    // mirror-symmetry tell: a thin centreline seam, always vertical through the
    // block's own axis (never rotates with facing — a Concord identity marker).
    const midX = x + w / 2;
    return `
      <path d="${dPath}" fill="${shade(p.shadow, -0.12)}"/>
      <path d="${path}" fill="url(#${gid})" stroke="${rim}" stroke-width="3"/>
      <line x1="${midX}" y1="${y + 6}" x2="${midX}" y2="${y + h - 6}" stroke="${shade(p.shadow, -0.3)}" stroke-width="1.5" opacity="0.5"/>`;
  }
  // neutral: original rounded-rect extrusion (wrecks/derricks/relay stay plain).
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

/** A slatted vent block — on Emberhand, oversized + seed-offset + jagged tips
 *  (the "one seeded oversized vent/shoulder offset per unit TYPE" tell: each call
 *  site's own x/y/w/h seeds its own consistent offset). */
export function vent(x, y, w, h, p) {
  const d = shade(p.shadow, -0.25), l = shade(p.main, 0.12);
  if (p.lang === 'emberhand') {
    const seed = hashStr(`vent|${x}|${y}|${w}|${h}`);
    const rnd = mulberry32(seed);
    const ox = (rnd() - 0.5) * w * 0.22, oy = (rnd() - 0.5) * h * 0.18;
    const ow = w * 1.22, oh = h * 1.22;
    const ex = x - (ow - w) / 2 + ox, ey = y - (oh - h) / 2 + oy;
    let s = `<path d="${jaggedRectPath(ex, ey, ow, oh, seed ^ 3, 4, 4)}" fill="${d}"/>`;
    const n = Math.max(2, Math.round(oh / 8));
    for (let i = 0; i < n; i++) s += `<rect x="${ex + 3}" y="${ey + 3 + i * (oh - 4) / n}" width="${ow - 6}" height="2.6" fill="${l}"/>`;
    return s;
  }
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

/** Chamfer every corner of an arbitrary polygon (Concord vehicle hulls). Each
 *  vertex is cut back `cut` px along both adjacent edges and replaced by 2 points
 *  — a generalisation of chamferPoints() for non-rect silhouettes. */
function chamferPolygon(points, cut) {
  const n = points.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n], cur = points[i], next = points[(i + 1) % n];
    const toPrev = [prev[0] - cur[0], prev[1] - cur[1]];
    const toNext = [next[0] - cur[0], next[1] - cur[1]];
    const lp = Math.hypot(toPrev[0], toPrev[1]) || 1, ln = Math.hypot(toNext[0], toNext[1]) || 1;
    const c = Math.min(cut, lp * 0.4, ln * 0.4);
    out.push([cur[0] + (toPrev[0] / lp) * c, cur[1] + (toPrev[1] / lp) * c]);
    out.push([cur[0] + (toNext[0] / ln) * c, cur[1] + (toNext[1] / ln) * c]);
  }
  return out;
}
/** Jag every edge of an arbitrary polygon outward (Emberhand vehicle hulls). */
function jagPolygon(points, seed, amp = 5, perEdge = 2) {
  const rnd = mulberry32(seed >>> 0);
  const n = points.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n];
    out.push(a);
    for (let k = 1; k <= perEdge; k++) {
      const t = k / (perEdge + 1);
      const bx = a[0] + (b[0] - a[0]) * t, by = a[1] + (b[1] - a[1]) * t;
      const nx = -(b[1] - a[1]), ny = (b[0] - a[0]);
      const len = Math.hypot(nx, ny) || 1;
      const j = (rnd() - 0.25) * amp;
      out.push([bx + (nx / len) * j, by + (ny / len) * j]);
    }
  }
  return out;
}
function polyPath(points) {
  return `M ${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ')} Z`;
}
/** langShape(points, p, gid, seed) — the SAME faction-language dispatch as block(),
 *  generalised to an arbitrary hull polygon (vehicle/aircraft bodies authored as a
 *  literal point list instead of a rect). Concord chamfers every corner, Emberhand
 *  jags every edge, Shardborn fills the hull with shatterFacet, neutral is a plain
 *  gradient fill — one function every hull silhouette in shapes.mjs routes through. */
export function langShape(points, p, gid, seed = 1) {
  if (p.lang === 'shardborn') {
    const xs = points.map(pt => pt[0]), ys = points.map(pt => pt[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const rad = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.58;
    const clipId = uid('clip');
    const def = `<clipPath id="${clipId}"><path d="${polyPath(points)}"/></clipPath>`;
    const body = `<g clip-path="url(#${clipId})"><rect x="${cx - rad}" y="${cy - rad}" width="${rad * 2}" height="${rad * 2}" fill="${shade(p.shadow, -0.1)}"/>${shatterFacet(cx, cy, rad, { seed, facets: 10, jitter: 0.26, baseColor: p.main, valueJitter: 0.15 })}</g>`;
    return `${defs(def)}${body}<path d="${polyPath(points)}" fill="none" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5"/>`;
  }
  if (p.lang === 'concord') {
    return `<path d="${polyPath(chamferPolygon(points, 14))}" fill="url(#${gid})" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5"/>`;
  }
  if (p.lang === 'emberhand') {
    return `<path d="${polyPath(jagPolygon(points, seed, 5, 2))}" fill="url(#${gid})" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5"/>`;
  }
  return `<polygon points="${points.map(([x, y]) => `${x},${y}`).join(' ')}" fill="url(#${gid})" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5"/>`;
}

/** A pair of tracked treads flanking a hull, with rung detail. */
export function tracks(lx, rx, y, w, h, p) {
  const tread = shade(p.shadow, -0.38), rung = shade(p.shadow, -0.55);
  const rungs = Math.max(4, Math.round(h / 22));
  let s = `<rect x="${lx}" y="${y}" width="${w}" height="${h}" rx="${p.lang === 'concord' ? 2 : 10}" fill="${tread}"/>
           <rect x="${rx}" y="${y}" width="${w}" height="${h}" rx="${p.lang === 'concord' ? 2 : 10}" fill="${tread}"/>
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

/** A rotatable turret ring + hatch — language-flavoured rim. */
export function turret(cx, cy, r, p) {
  if (p.lang === 'shardborn') {
    const seed = hashStr(`turret|${cx}|${cy}|${r}`);
    return `${shatterFacet(cx, cy, r, { seed, facets: 9, jitter: 0.24, baseColor: p.main, valueJitter: 0.15 })}
            <circle cx="${cx}" cy="${cy}" r="${r * 0.4}" fill="${shade(p.shadow, -0.12)}"/>`;
  }
  if (p.lang === 'concord') {
    const pts = chamferPoints(cx - r, cy - r, r * 2, r * 2, r * 0.42);
    const path = `M ${pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' L ')} Z`;
    return `<path d="${path}" fill="${shade(p.main, 0.08)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5"/>
            <path d="${path}" fill="${shade(p.hi, 0)}" opacity="0.14" transform="scale(0.7) translate(${cx * 0.43},${cy * 0.43})"/>
            <circle cx="${cx}" cy="${cy}" r="${r * 0.4}" fill="${shade(p.shadow, -0.12)}"/>`;
  }
  if (p.lang === 'emberhand') {
    const seed = hashStr(`turret|eh|${cx}|${cy}|${r}`);
    return `<path d="${jaggedRectPath(cx - r, cy - r, r * 2, r * 2, seed, 4, 8)}" fill="${shade(p.main, 0.06)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5"/>
            <circle cx="${cx}" cy="${cy}" r="${r * 0.4}" fill="${shade(p.shadow, -0.12)}"/>`;
  }
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
  const bodyShape = p.lang === 'concord'
    ? `<path d="${chamferRectPath(cx - bodyR, cy - bodyR * 0.95 + 8, bodyR * 2, bodyR * 1.9, bodyR * 0.35)}" fill="${cloth}" stroke="${shade(p.shadow, -0.4)}" stroke-width="4"/>`
    : p.lang === 'emberhand'
      ? `<path d="${jaggedRectPath(cx - bodyR, cy - bodyR * 0.95 + 8, bodyR * 2, bodyR * 1.9, hashStr(`sold|${cx}|${cy}`), 4, 5)}" fill="${cloth}" stroke="${shade(p.shadow, -0.4)}" stroke-width="4"/>`
      : `<ellipse cx="${cx}" cy="${cy + 8}" rx="${bodyR}" ry="${bodyR * 0.95}" fill="${cloth}" stroke="${shade(p.shadow, -0.4)}" stroke-width="4"/>`;
  return `${w}
    <ellipse cx="${cx}" cy="${cy + bodyR * 0.55}" rx="${bodyR * 0.9}" ry="${bodyR * 0.55}" fill="${pack}"/>
    ${bodyShape}
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
