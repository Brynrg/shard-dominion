// Sprite definitions. Each entry: { file, w, h, draw(team) -> svg-body-string }.
// `file` uses the pipeline convention assetId__team__state.png so import-art.mjs routes it.
import { pal, shade, block, seams, vent, light, topGrad, svg } from './kit.mjs';

// ---------- BUILDINGS ----------

// Heavy construction yard: broad platform + roof crane arm + hazard beacon.
function constructionYard(team) {
  const p = pal(team);
  const g = topGrad(p);
  const cyan = p.accent;
  const body = `
    ${block(96, 150, 320, 230, 26, p, g.id, 18)}
    ${seams(96, 150, 320, 230, p, 3, 3)}
    ${vent(120, 172, 60, 46, p)}
    ${vent(120, 236, 60, 46, p)}
    <!-- machinery deck -->
    <rect x="250" y="176" width="150" height="120" rx="10" fill="${shade(p.main, 0.06)}" stroke="${shade(p.shadow, -0.3)}" stroke-width="2.5"/>
    ${seams(250, 176, 150, 120, p, 2, 2)}
    <!-- crane pivot + lattice jib reaching down-right, staying within margins -->
    <circle cx="292" cy="230" r="27" fill="${shade(p.shadow, -0.05)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3"/>
    <circle cx="292" cy="230" r="12" fill="${shade(p.main, 0.15)}"/>
    <g stroke="${shade(p.shadow, -0.35)}" stroke-width="3" fill="${shade(p.main, 0.08)}">
      <polygon points="286,214 408,308 396,326 274,236"/>
    </g>
    <g stroke="${shade(p.shadow, -0.42)}" stroke-width="2">
      <line x1="292" y1="222" x2="398" y2="318"/><line x1="300" y1="242" x2="392" y2="322"/>
    </g>
    <line x1="398" y1="316" x2="398" y2="352" stroke="${shade(p.shadow, -0.45)}" stroke-width="4"/>
    <polygon points="390,352 406,352 402,366 394,366" fill="${shade(p.main, 0.2)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2"/>
    <!-- hazard beacon (red on neutral, faction accent otherwise) -->
    ${light(150, 168, 9, team === 'neutral' ? '#ff5a3c' : cyan)}
    ${light(150, 362, 7, team === 'neutral' ? '#ff5a3c' : cyan)}`;
  return svg(512, 512, g.def, body);
}

// Infantry barracks: blocky bunker, lit doorway, ridged roof, sandbag rim.
function barracks(team) {
  const p = pal(team);
  const g = topGrad(p);
  const body = `
    ${block(126, 150, 260, 232, 24, p, g.id, 16)}
    ${seams(126, 150, 260, 232, p, 3, 4)}
    ${vent(150, 172, 210, 34, p)}
    <!-- lit doorway at the front (lower edge) -->
    <rect x="214" y="330" width="84" height="52" rx="6" fill="${shade(p.shadow, -0.5)}"/>
    <rect x="222" y="338" width="68" height="44" fill="${shade(p.accent, 0.15)}" opacity="0.85" filter="url(#glow)"/>
    <rect x="222" y="338" width="68" height="44" fill="${shade(p.accent, 0.35)}" opacity="0.5"/>
    <!-- sandbag nubs along the walls -->
    <g fill="${shade(p.main, -0.05)}" stroke="${shade(p.shadow, -0.3)}" stroke-width="1.5">
      ${Array.from({ length: 6 }, (_, i) => `<ellipse cx="${140 + i * 42}" cy="378" rx="17" ry="11"/>`).join('')}
    </g>
    ${light(150, 168, 7, p.accent)}
    ${light(362, 168, 7, p.accent)}`;
  return svg(512, 512, g.def, body);
}

// Ore refinery: two silo tanks + docking bay + pipework + purple intake glow.
function refinery(team) {
  const p = pal(team);
  const g = topGrad(p);
  const body = `
    ${block(96, 170, 320, 200, 24, p, g.id, 16)}
    ${seams(96, 170, 320, 200, p, 3, 2)}
    <!-- two vertical silo tanks -->
    ${silo(150, 120, 64, p)}
    ${silo(232, 120, 64, p)}
    <!-- pipework silos -> bay -->
    <g stroke="${shade(p.shadow, -0.2)}" stroke-width="9" fill="none" stroke-linecap="round">
      <path d="M182 184 V 250 H 330 V 300"/>
      <path d="M264 184 V 232"/>
    </g>
    <!-- open docking bay (front) -->
    <rect x="286" y="292" width="112" height="82" rx="8" fill="${shade(p.shadow, -0.5)}"/>
    <rect x="296" y="300" width="92" height="66" rx="4" fill="${shade(p.main, -0.18)}"/>
    <!-- intake hopper with violet shard glow -->
    <rect x="120" y="300" width="96" height="64" rx="8" fill="${shade(p.shadow, -0.25)}"/>
    ${light(168, 332, 13, '#b48bff')}
    <!-- exhaust stack -->
    <rect x="352" y="150" width="34" height="52" rx="6" fill="${shade(p.main, 0.05)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5"/>
    ${light(200, 200, 7, p.accent)}
    ${light(330, 200, 7, p.accent)}`;
  return svg(512, 512, g.def, body);
}
function silo(x, y, w, p) {
  // cylindrical shading: dark right edge, light left, painted with layered rects
  const cx = x + w / 2;
  return `
    <rect x="${x}" y="${y + 6}" width="${w}" height="96" fill="${shade(p.shadow, -0.05)}"/>
    <rect x="${x}" y="${y + 6}" width="${w * 0.6}" height="96" fill="${p.main}"/>
    <rect x="${x}" y="${y + 6}" width="${w * 0.28}" height="96" fill="${shade(p.hi, 0)}" opacity="0.5"/>
    <rect x="${x}" y="${y + 6}" width="${w}" height="96" fill="none" stroke="${shade(p.shadow, -0.4)}" stroke-width="3"/>
    <ellipse cx="${cx}" cy="${y + 8}" rx="${w / 2}" ry="14" fill="${shade(p.main, 0.2)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="3"/>
    <ellipse cx="${cx}" cy="${y + 102}" rx="${w / 2}" ry="13" fill="${shade(p.shadow, -0.15)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3"/>`;
}

// Compact power node: squat generator + cooling fins + tall antenna mast.
function powerNode(team) {
  const p = pal(team);
  const g = topGrad(p);
  const body = `
    ${block(176, 210, 160, 150, 22, p, g.id, 14)}
    <!-- cooling fins -->
    <g fill="${shade(p.shadow, -0.15)}">
      ${Array.from({ length: 4 }, (_, i) => `<rect x="${190 + i * 36}" y="226" width="22" height="118" rx="4"/>`).join('')}
    </g>
    <g fill="${shade(p.hi, 0)}" opacity="0.35">
      ${Array.from({ length: 4 }, (_, i) => `<rect x="${190 + i * 36}" y="226" width="8" height="118" rx="4"/>`).join('')}
    </g>
    <!-- splayed feet -->
    <g fill="${shade(p.shadow, -0.2)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2">
      <polygon points="176,352 150,392 176,384"/>
      <polygon points="336,352 362,392 336,384"/>
    </g>
    <!-- antenna mast with glowing tip -->
    <rect x="250" y="96" width="12" height="130" rx="4" fill="${shade(p.main, 0.1)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2"/>
    ${light(256, 96, 11, p.accent)}
    ${light(210, 250, 7, p.accent)}`;
  return svg(512, 512, g.def, body);
}

// ---------- UNITS (top-down, facing up; loader rotates to heading) ----------

// Mid-size tracked battle tank: hull + treads + turret + forward cannon.
function assaultTank(team) {
  const p = pal(team);
  const g = topGrad(p);
  const tread = shade(p.shadow, -0.35);
  const body = `
    <!-- treads -->
    <rect x="150" y="168" width="46" height="200" rx="12" fill="${tread}"/>
    <rect x="316" y="168" width="46" height="200" rx="12" fill="${tread}"/>
    <g stroke="${shade(p.shadow, -0.5)}" stroke-width="3">
      ${Array.from({ length: 9 }, (_, i) => `<line x1="150" y1="${180 + i * 21}" x2="196" y2="${180 + i * 21}"/><line x1="316" y1="${180 + i * 21}" x2="362" y2="${180 + i * 21}"/>`).join('')}
    </g>
    <!-- hull (wedge glacis up) -->
    <polygon points="256,150 344,210 344,360 168,360 168,210" fill="url(#${g.id})" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5"/>
    <polygon points="256,150 300,196 212,196" fill="${shade(p.hi, 0)}" opacity="0.3"/>
    <!-- rear engine louvres -->
    ${vent(198, 322, 116, 30, p)}
    <!-- turret -->
    <circle cx="256" cy="270" r="52" fill="${shade(p.main, 0.06)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5"/>
    <circle cx="256" cy="270" r="22" fill="${shade(p.shadow, -0.15)}"/>
    <!-- forward cannon -->
    <rect x="248" y="120" width="16" height="164" rx="5" fill="${shade(p.main, 0.12)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5"/>
    <rect x="245" y="120" width="22" height="14" rx="3" fill="${shade(p.accent, 0.2)}"/>
    ${light(256, 126, 6, p.accent)}`;
  return svg(512, 512, g.def, body);
}

export const SPRITES = [
  { file: 'construction_yard__neutral__idle', w: 512, h: 512, draw: () => constructionYard('neutral') },
  { file: 'barracks__player__idle', w: 512, h: 512, draw: () => barracks('player') },
  { file: 'barracks__enemy__idle', w: 512, h: 512, draw: () => barracks('enemy') },
  { file: 'refinery__player__idle', w: 512, h: 512, draw: () => refinery('player') },
  { file: 'refinery__enemy__idle', w: 512, h: 512, draw: () => refinery('enemy') },
  { file: 'power_node__player__idle', w: 512, h: 512, draw: () => powerNode('player') },
  { file: 'assault_tank__player__move', w: 512, h: 512, draw: () => assaultTank('player') },
  { file: 'assault_tank__enemy__move', w: 512, h: 512, draw: () => assaultTank('enemy') },
];
