// ── View: "Obsidian Bloom" shared render primitives (Canvas2D runtime port) ─────
// The build-time art-gen kit (scripts/art-gen/kit.mjs) authors SVG sprite sheets
// offline; this module is the SAME shatterFacet/chamfer/contour algorithm ported
// to live Canvas2D for the things that can't be pre-rasterized as a sprite sheet —
// the terrain bake, HUD panel fills, and the corruption crack network. View-only
// (wall-clock + DOM allowed here; never imported by src/sim/**).

/** Deterministic PRNG (mulberry32) — the ONE seeded generator every jittered
 *  primitive here uses, so a given seed always produces the same facets/cracks
 *  (stable across frames — texture doesn't crawl). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Cheap string→uint32 hash, for seeding by a tile/entity key instead of an int. */
export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function rgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function toHex(n: number): string { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'); }
/** Lighten (amt>0) or darken (amt<0) toward white/black. amt in [-1,1]. */
export function shadeHex(hex: string, amt: number): string {
  const [r, g, b] = rgb(hex);
  if (amt >= 0) return `#${toHex(r + (255 - r) * amt)}${toHex(g + (255 - g) * amt)}${toHex(b + (255 - b) * amt)}`;
  return `#${toHex(r * (1 + amt))}${toHex(g * (1 + amt))}${toHex(b * (1 + amt))}`;
}
/** Linear blend a→b by t in [0,1]. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a), [br, bg, bb] = rgb(b);
  return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`;
}

/** shatterFacetRect — THE shared primitive (terrain bake + HUD panel fills call
 *  this): tiles a rect area with a seeded jittered triangle-fan facet field at
 *  ~facetScale px per facet. Deterministic per seed — call once into an offscreen
 *  canvas and blit; never call this per-frame in the main render loop. */
export function shatterFacetRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  opts: { seed: number; facetScale?: number; baseColor: string; valueJitter?: number; jitter?: number },
): void {
  const { seed, facetScale = 48, baseColor, valueJitter = 0.14, jitter = 0.35 } = opts;
  const rnd = mulberry32(seed);
  for (let fy = y - facetScale; fy < y + h + facetScale; fy += facetScale) {
    for (let fx = x - facetScale; fx < x + w + facetScale; fx += facetScale) {
      const cx = fx + (rnd() - 0.5) * facetScale * jitter;
      const cy = fy + (rnd() - 0.5) * facetScale * jitter;
      const facets = 5 + Math.floor(rnd() * 3);
      const r = facetScale * (0.7 + rnd() * 0.35);
      const pts: [number, number][] = [];
      for (let i = 0; i < facets; i++) {
        const a = (i / facets) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
        const rr = r * (0.72 + rnd() * 0.4);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      for (let i = 0; i < facets; i++) {
        const a = pts[i]!, b = pts[(i + 1) % facets]!;
        ctx.fillStyle = shadeHex(baseColor, (rnd() - 0.5) * 2 * valueJitter);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill();
      }
    }
  }
}

/** shatterFacet — the circular/point form (HUD hex frames, corruption core glow). */
export function shatterFacet(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number,
  opts: { seed: number; facets?: number; jitter?: number; baseColor: string; valueJitter?: number },
): void {
  const { seed, facets = 9, jitter = 0.22, baseColor, valueJitter = 0.14 } = opts;
  const rnd = mulberry32(seed);
  const ring: [number, number][] = [];
  for (let i = 0; i < facets; i++) {
    const a = (i / facets) * Math.PI * 2 + (rnd() - 0.5) * (Math.PI / facets) * 0.6;
    const rr = r * (1 - jitter / 2 + rnd() * jitter);
    ring.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  for (let i = 0; i < facets; i++) {
    const a = ring[i]!, b = ring[(i + 1) % facets]!;
    ctx.fillStyle = shadeHex(baseColor, (rnd() - 0.5) * 2 * valueJitter);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill();
  }
}

/** Trace an 8-point chamfered-rect path (45° cut corners, no rounding — the
 *  Concord/HUD chrome tell). Caller fills/strokes after. */
export function chamferedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cut: number): void {
  const c = Math.min(cut, w / 2.2, h / 2.2);
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

/** Hex-facet frame (chamfer taken further — an elongated hexagon), used for the
 *  radar/minimap frame instead of a plain rect border. */
export function hexFacetPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const cut = Math.min(w, h) * 0.16;
  chamferedRectPath(ctx, x, y, w, h, cut);
}

/** A jittered crack/contour line from (x1,y1) to (x2,y2) — the ONE line-drawing
 *  primitive shared by cliff contour hints (recolored neutral cyan-white) and the
 *  corruption crack network (recolored magenta). Deterministic per seed. */
export function jitteredLine(
  ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number,
  opts: { seed: number; amplitude?: number; segments?: number; color: string; alpha?: number; lineWidth?: number },
): void {
  const { seed, amplitude = 3, segments = 6, color, alpha = 1, lineWidth = 1 } = opts;
  const rnd = mulberry32(seed);
  const dx = x2 - x1, dy = y2 - y1;
  const nx = -dy, ny = dx;
  const len = Math.hypot(nx, ny) || 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const bx = x1 + dx * t, by = y1 + dy * t;
    const j = (rnd() - 0.5) * amplitude;
    ctx.lineTo(bx + (nx / len) * j, by + (ny / len) * j);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** A seeded crack network radiating from (cx,cy) — used for the corruption/
 *  Avarice alarm. `intensity` (0-1) drives branch count/thickness/reach; colour
 *  interpolates core→edge; `pulse` (0-1, from a sine) modulates alpha. Geometry
 *  is generated once per (seed) call — cache the seed→points off this function
 *  and only regenerate when a tile's Avarice bucket actually changes; redraw the
 *  cached points every frame (cheap) to animate the pulse. */
export interface CrackBranch { pts: [number, number][]; }
export function buildCrackNetwork(seed: number, cx: number, cy: number, reachPx: number, intensity: number): CrackBranch[] {
  const rnd = mulberry32(seed);
  const branches = Math.max(2, Math.round(3 + intensity * 5));
  const out: CrackBranch[] = [];
  for (let b = 0; b < branches; b++) {
    const a0 = (b / branches) * Math.PI * 2 + rnd() * 0.6;
    let x = cx, y = cy, ang = a0;
    const pts: [number, number][] = [[x, y]];
    const steps = 3 + Math.round(rnd() * 3);
    for (let s = 0; s < steps; s++) {
      ang += (rnd() - 0.5) * 1.1;
      const len = (reachPx / steps) * (0.6 + rnd() * 0.8);
      x += Math.cos(ang) * len; y += Math.sin(ang) * len;
      pts.push([x, y]);
    }
    out.push({ pts });
  }
  return out;
}
export function drawCrackNetwork(
  ctx: CanvasRenderingContext2D, branches: readonly CrackBranch[],
  opts: { colorCore: string; colorEdge: string; intensity: number; pulse: number; baseWidth?: number },
): void {
  const { colorCore, colorEdge, intensity, pulse, baseWidth = 1.4 } = opts;
  const alpha = Math.min(0.85, 0.25 + intensity * 0.55) * (0.75 + pulse * 0.25);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  for (const br of branches) {
    for (let i = 0; i < br.pts.length - 1; i++) {
      const t = i / (br.pts.length - 1);
      ctx.strokeStyle = mixHex(colorCore, colorEdge, t);
      ctx.lineWidth = baseWidth * (1.6 - t) * (0.6 + intensity * 0.7);
      const [x1, y1] = br.pts[i]!, [x2, y2] = br.pts[i + 1]!;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }
  ctx.restore();
}
