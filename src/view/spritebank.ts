// ── View: pre-baked sprite bank (S7-2 "real sprites") ───────────────────────────
// Renders each unit/building ONCE into an offscreen canvas at 2× supersampling with
// a FIXED (top-left) light source, then blits. Units bake DIRS directional frames so
// a turning tank shows a properly-lit sprite for its heading — the classic Westwood
// look — instead of a vector shape whose shading spins with it. IP-clean: every pixel
// is generated procedurally here; no external art assets. View-only (DOM allowed).
import type { WeaponsFile } from '../loaders/schemas.js';

export interface TeamStyle { hull: string; hullDark: string; accent: string; stripe: string; }

const SS = 2;      // supersample factor (bake at 2×, blit down → crisp edges)
const DIRS = 16;   // baked facings per mobile unit
const U = 44;      // unit sprite cell (logical px)
const BLDG = 64;   // building sprite cell (logical px)

// ── tiny colour helpers (local; keep this module self-contained) ────────────────
function rgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function toHex(n: number): string { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'); }
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a), [br, bg, bb] = rgb(b);
  return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`;
}

function makeCanvas(px: number): { cv: HTMLCanvasElement; c: CanvasRenderingContext2D } {
  const cv = document.createElement('canvas');
  cv.width = px * SS; cv.height = px * SS;
  const c = cv.getContext('2d') as CanvasRenderingContext2D;
  c.scale(SS, SS);
  return { cv, c };
}

// Overlay a FIXED top-left→bottom-right light on whatever silhouette is already
// painted (source-atop tints only drawn pixels). This is what makes facing frames
// share one sun instead of rotating their own highlight.
function bakeLight(c: CanvasRenderingContext2D, size: number): void {
  c.save();
  c.setTransform(SS, 0, 0, SS, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  const g = c.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, 'rgba(255,255,255,0.34)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.0)');
  g.addColorStop(0.62, 'rgba(0,0,0,0.0)');
  g.addColorStop(1, 'rgba(0,0,0,0.4)');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  // crisp top-left rim highlight
  c.globalCompositeOperation = 'source-atop';
  const r = c.createLinearGradient(0, 0, size * 0.22, size * 0.22);
  r.addColorStop(0, 'rgba(255,255,255,0.22)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = r; c.fillRect(0, 0, size, size);
  c.restore();
}

// ── unit albedo painters (FLAT colours; the light bake adds all the dimension) ──
// Local frame: origin at cell centre, +x = forward (unit heading before rotation).
function paintUnit(c: CanvasRenderingContext2D, kind: string, style: TeamStyle, weaponType: string | undefined): void {
  const cx = U / 2, cy = U / 2, S = U * 0.8;
  c.save();
  c.translate(cx, cy);
  const outline = 'rgba(0,0,0,0.65)';
  const steel = '#5b5f66', steelDark = '#33363b';

  if (kind === 'infantry' || kind === 'rocket_trooper') {
    const r = S * 0.2;
    // backpack behind the torso
    c.fillStyle = mix(style.hullDark, '#000', 0.2);
    rr(c, -r * 1.15, -r * 0.6, r * 0.6, r * 1.2, r * 0.3); c.fill();
    // torso + legs
    c.fillStyle = style.hullDark;
    rr(c, -r * 0.9, -r * 0.8, r * 1.8, r * 1.6, r * 0.55); c.fill();
    c.fillStyle = mix(style.hull, '#000', 0.1);                     // shoulders
    rr(c, -r * 0.55, -r * 0.85, r * 1.1, r * 0.5, r * 0.25); c.fill();
    // helmet
    c.fillStyle = mix(style.hull, '#2f2f2f', 0.2);
    c.beginPath(); c.arc(r * 0.15, 0, r * 0.6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = outline; c.lineWidth = 1; c.stroke();
    if (weaponType === 'ROCKET') {
      c.fillStyle = '#2b2620'; rr(c, -r * 0.2, -r * 1.15, r * 2.0, r * 0.5, 1); c.fill(); // launcher
      c.fillStyle = '#ffce54'; c.fillRect(r * 1.6, -r * 1.15, r * 0.28, r * 0.5);         // warhead
      c.fillStyle = steelDark; c.fillRect(r * 0.2, -r * 1.3, r * 0.5, r * 0.2);           // sight
    } else {
      c.fillStyle = '#15120d'; c.fillRect(0, -r * 0.16, r * 1.9, r * 0.3);                // rifle
      c.fillStyle = steel; c.fillRect(r * 0.5, -r * 0.1, r * 0.4, r * 0.2);               // receiver
    }
  } else if (kind === 'vehicle') {
    const l = S * 0.38, w = S * 0.2;
    treads(c, l * 0.98, w * 1.15, S * 0.15);
    // side skirts over treads
    c.fillStyle = steelDark;
    c.fillRect(-l * 0.8, -w * 1.15, l * 1.5, S * 0.05);
    c.fillRect(-l * 0.8, w * 1.1, l * 1.5, S * 0.05);
    // glacis + hull
    c.fillStyle = style.hull;
    c.beginPath();
    c.moveTo(l, 0); c.lineTo(l * 0.6, -w); c.lineTo(-l * 0.9, -w);
    c.lineTo(-l, 0); c.lineTo(-l * 0.9, w); c.lineTo(l * 0.6, w);
    c.closePath(); c.fill();
    c.strokeStyle = outline; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = mix(style.hull, '#000', 0.22);                    // rear engine deck + louvres
    c.fillRect(-l * 0.9, -w * 0.7, l * 0.35, w * 1.4);
    c.fillStyle = steelDark;
    for (let y = -w * 0.6; y < w * 0.6; y += 3) c.fillRect(-l * 0.85, y, l * 0.25, 1.4);
    // turret + hatch + barrel
    c.fillStyle = style.hullDark; c.beginPath(); c.arc(-l * 0.05, 0, w * 0.92, 0, Math.PI * 2); c.fill();
    c.strokeStyle = outline; c.stroke();
    c.fillStyle = mix(style.hullDark, '#000', 0.25); c.beginPath(); c.arc(-l * 0.25, -w * 0.15, w * 0.32, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#15120d'; c.fillRect(-l * 0.05, -2.4, l * 1.25, 4.8);
    c.fillStyle = steel; c.fillRect(l * 0.5, -2.4, l * 0.2, 4.8);   // barrel collar
    c.fillStyle = style.stripe; c.fillRect(l * 1.12, -2.4, 3, 4.8); // muzzle band
  } else if (kind === 'harvester') {
    const l = S * 0.46, w = S * 0.28;
    treads(c, l * 0.98, w * 1.1, S * 0.18);
    c.fillStyle = mix(style.hull, '#8a7a53', 0.5);                  // dusty ore-hauler body
    c.beginPath();
    c.moveTo(l, -w * 0.75); c.lineTo(l, w * 0.75); c.lineTo(-l, w); c.lineTo(-l, -w);
    c.closePath(); c.fill();
    c.strokeStyle = outline; c.lineWidth = 1.2; c.stroke();
    // hazard stripes on the hopper lip
    for (let x = -l * 0.7; x < l * 0.7; x += 6) { c.fillStyle = ((x / 6) | 0) % 2 ? '#e8b100' : '#171310'; c.fillRect(x, -w, 6, w * 0.28); }
    c.fillStyle = '#2c2418';                                        // hopper ribs
    for (let x = -l * 0.55; x < l * 0.7; x += 5) c.fillRect(x, -w * 0.45, 2, w * 0.9);
    c.fillStyle = steelDark; c.fillRect(l * 0.55, -w * 0.6, l * 0.5, w * 1.2); // intake scoop
    c.fillStyle = steel; c.fillRect(l * 0.98, -w * 0.5, l * 0.12, w);          // scoop blade
    c.fillStyle = '#241d12'; c.fillRect(-l * 0.95, -w * 0.25, l * 0.18, w * 0.5); // exhaust stack
  } else if (kind === 'mcv') {
    const l = S * 0.48, w = S * 0.3;
    treads(c, l * 0.98, w * 1.05, S * 0.19);
    c.fillStyle = style.hull;
    c.beginPath();
    c.moveTo(l, 0); c.lineTo(l * 0.6, -w); c.lineTo(-l * 0.65, -w);
    c.lineTo(-l, 0); c.lineTo(-l * 0.65, w); c.lineTo(l * 0.6, w);
    c.closePath(); c.fill();
    c.strokeStyle = outline; c.lineWidth = 1.3; c.stroke();
    c.fillStyle = steelDark;                                        // fold-out panel seams
    c.fillRect(-l * 0.5, -w, l, 1.6); c.fillRect(-l * 0.5, w - 1.6, l, 1.6);
    c.fillStyle = style.accent; rr(c, -l * 0.36, -w * 0.48, l * 0.72, w * 0.96, 2); c.fill();
    c.fillStyle = mix(style.accent, '#000', 0.15);
    for (let x = -l * 0.28; x < l * 0.3; x += 4) c.fillRect(x, -w * 0.4, 1.6, w * 0.8); // core vents
    c.fillStyle = style.hullDark; rr(c, -l * 0.18, -w * 0.24, l * 0.36, w * 0.48, 2); c.fill();
    c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(l * 0.4, 0, 2.6, 0, Math.PI * 2); c.fill();
  } else {
    const h = S * 0.26;
    c.fillStyle = style.hull; rr(c, -h, -h, h * 2, h * 2, 3); c.fill();
    c.strokeStyle = outline; c.lineWidth = 1.3; c.stroke();
  }
  c.restore();
}

function treads(c: CanvasRenderingContext2D, l: number, w: number, tw: number): void {
  for (const sign of [-1, 1]) {
    const ty = sign * w - (sign < 0 ? tw : 0);
    c.fillStyle = '#221f18'; c.fillRect(-l, ty, l * 2, tw);
    c.fillStyle = '#14110c';
    for (let x = -l + 2; x < l - 1; x += 4) c.fillRect(x, ty + tw * 0.35, 2, tw * 0.5);
  }
}
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// ── building body painter (baked static; animated accents drawn live by renderer) ─
function paintBuildingBody(c: CanvasRenderingContext2D, kind: string, style: TeamStyle): void {
  const big = kind === 'construction_yard' || kind === 'refinery';
  const w = big ? BLDG * 0.82 : BLDG * 0.6;
  const h = big ? BLDG * 0.66 : BLDG * 0.52;
  const depth = big ? 9 : 7;
  const x = (BLDG - w) / 2, y = (BLDG - h) / 2 - depth * 0.3;

  c.fillStyle = mix(style.hullDark, '#000000', 0.45);            // extruded front face
  c.fillRect(x, y + h - 2, w, depth + 2);
  c.fillStyle = style.hull;                                      // roof (flat; light bakes gradient)
  c.fillRect(x, y, w, h);
  c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 1;           // panel seam
  c.beginPath(); c.moveTo(x, y + h * 0.5); c.lineTo(x + w, y + h * 0.5); c.stroke();
  c.fillStyle = 'rgba(0,0,0,0.35)';                              // corner rivets
  for (const rx of [x + 3, x + w - 5]) for (const ry of [y + 3, y + h - 6]) c.fillRect(rx, ry, 2, 2);
  c.strokeStyle = style.stripe; c.lineWidth = 2;                 // team trim
  c.strokeRect(x + 1, y + 1, w - 2, h - 2);

  if (kind === 'refinery') {
    for (const sx of [x + w * 0.24, x + w * 0.44]) {
      c.fillStyle = style.accent; rr(c, sx - w * 0.1, y + h * 0.2, w * 0.2, h * 0.55, 3); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; c.stroke();
    }
    c.fillStyle = mix(style.hull, '#000', 0.28); rr(c, x + w * 0.58, y + h * 0.45, w * 0.36, h * 0.48, 2); c.fill();
  } else if (kind === 'barracks') {
    c.fillStyle = mix(style.hull, '#ffffff', 0.12); c.fillRect(x + 4, y + 4, w - 8, 4);
    c.fillStyle = '#140e09'; rr(c, BLDG / 2 - w * 0.13, y + h * 0.44, w * 0.26, h * 0.56, 2); c.fill();
  } else if (kind === 'construction_yard') {
    c.fillStyle = mix(style.hull, '#000', 0.12); c.fillRect(x + w * 0.2, y + h * 0.25, w * 0.6, h * 0.5);
  } else if (kind === 'power_node') {
    c.fillStyle = mix(style.hull, '#000', 0.1); c.fillRect(x + w * 0.35, y + h * 0.2, w * 0.3, h * 0.6);
  } else {
    c.fillStyle = style.accent;
    for (const dx of [0.18, 0.5]) for (const dy of [0.3, 0.58])
      c.fillRect(x + w * dx, y + h * dy, w * 0.18, h * 0.16);
  }
}

export interface SpriteBank {
  drawUnit(ctx: CanvasRenderingContext2D, kind: string, team: string, weaponType: string | undefined, angle: number, sx: number, sy: number): void;
  drawBuildingBody(ctx: CanvasRenderingContext2D, kind: string, team: string, sx: number, sy: number): void;
  readonly U: number;
  readonly BLDG: number;
}

export function makeSpriteBank(teams: Record<string, TeamStyle>, neutral: TeamStyle, weapons: WeaponsFile): SpriteBank {
  const unitKinds = ['infantry', 'rocket_trooper', 'vehicle', 'harvester', 'mcv', 'generic'];
  const bldgKinds = ['refinery', 'barracks', 'construction_yard', 'power_node', 'generic'];
  const teamKeys = [...Object.keys(teams), 'neutral'];
  const styleOf = (t: string): TeamStyle => teams[t] ?? neutral;

  // Weapon type per unit kind (for the infantry/rocket weapon tell). Buildings n/a.
  const weaponForKind = (kind: string): string | undefined =>
    kind === 'rocket_trooper' ? (weapons.weapons['inf_rocket']?.type)
      : kind === 'infantry' ? (weapons.weapons['rifle']?.type) : undefined;

  const unitFrames = new Map<string, HTMLCanvasElement[]>();   // key `${kind}|${team}`
  const bldgFrame = new Map<string, HTMLCanvasElement>();      // key `${kind}|${team}`

  for (const team of teamKeys) {
    const style = styleOf(team);
    for (const kind of unitKinds) {
      const frames: HTMLCanvasElement[] = [];
      const wt = weaponForKind(kind);
      for (let d = 0; d < DIRS; d++) {
        const { cv, c } = makeCanvas(U);
        c.save();
        c.translate(U / 2, U / 2); c.rotate((d / DIRS) * Math.PI * 2); c.translate(-U / 2, -U / 2);
        paintUnit(c, kind, style, wt);
        c.restore();
        bakeLight(c, U);
        frames.push(cv);
      }
      unitFrames.set(`${kind}|${team}`, frames);
    }
    for (const kind of bldgKinds) {
      const { cv, c } = makeCanvas(BLDG);
      paintBuildingBody(c, kind, style);
      bakeLight(c, BLDG);
      bldgFrame.set(`${kind}|${team}`, cv);
    }
  }

  return {
    U, BLDG,
    drawUnit(ctx, kind, team, _weaponType, angle, sx, sy) {
      const k = unitFrames.has(`${kind}|${team}`) ? kind : 'generic';
      const t = unitFrames.has(`${k}|${team}`) ? team : 'neutral';
      const frames = unitFrames.get(`${k}|${t}`);
      if (!frames) return;
      // contact shadow (world-down; NOT baked so it never rotates with the sprite)
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath(); ctx.ellipse(sx + 2, sy + U * 0.22, U * 0.28, U * 0.13, 0, 0, Math.PI * 2); ctx.fill();
      let d = Math.round((angle / (Math.PI * 2)) * DIRS) % DIRS;
      if (d < 0) d += DIRS;
      const f = frames[d] ?? frames[0];
      if (f) ctx.drawImage(f, sx - U / 2, sy - U / 2, U, U);
    },
    drawBuildingBody(ctx, kind, team, sx, sy) {
      const k = bldgFrame.has(`${kind}|${team}`) ? kind : 'generic';
      const t = bldgFrame.has(`${k}|${team}`) ? team : 'neutral';
      const f = bldgFrame.get(`${k}|${t}`);
      // grounding shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(sx - BLDG * 0.3, sy + BLDG * 0.18, BLDG * 0.6, 6);
      if (f) ctx.drawImage(f, sx - BLDG / 2, sy - BLDG / 2, BLDG, BLDG);
    },
  };
}
