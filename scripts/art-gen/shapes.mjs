// Shape library: SHAPES[assetId](team) -> full <svg> string. Palette-driven, so
// enemy/emberhand/shardborn recolors come for free. Top-down, painted Westwood look.
import { pal, shade, block, seams, vent, light, topGrad, svg, tracks, wheels, turret, barrel, soldier, rotorDisc, langShape, hashStr } from './kit.mjs';

const F = 512; // frame size
const S = (p, def, body) => svg(F, F, def, body);

// ============================ BUILDINGS ============================

function constructionYard(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(96, 150, 320, 230, 26, p, g.id, 18)}
    ${seams(96, 150, 320, 230, p, 3, 3)}
    ${vent(120, 172, 60, 46, p)} ${vent(120, 236, 60, 46, p)}
    <rect x="250" y="176" width="150" height="120" rx="10" fill="${shade(p.main, 0.06)}" stroke="${shade(p.shadow, -0.3)}" stroke-width="2.5"/>
    ${seams(250, 176, 150, 120, p, 2, 2)}
    <circle cx="292" cy="230" r="27" fill="${shade(p.shadow, -0.05)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3"/>
    <circle cx="292" cy="230" r="12" fill="${shade(p.main, 0.15)}"/>
    <g stroke="${shade(p.shadow, -0.35)}" stroke-width="3" fill="${shade(p.main, 0.08)}"><polygon points="286,214 408,308 396,326 274,236"/></g>
    <g stroke="${shade(p.shadow, -0.42)}" stroke-width="2"><line x1="292" y1="222" x2="398" y2="318"/><line x1="300" y1="242" x2="392" y2="322"/></g>
    <line x1="398" y1="316" x2="398" y2="352" stroke="${shade(p.shadow, -0.45)}" stroke-width="4"/>
    <polygon points="390,352 406,352 402,366 394,366" fill="${shade(p.main, 0.2)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2"/>
    ${light(150, 168, 9, team === 'neutral' ? '#ff5a3c' : p.accent)}
    ${light(150, 362, 7, team === 'neutral' ? '#ff5a3c' : p.accent)}`;
  return S(p, g.def, body);
}

function barracks(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(126, 150, 260, 232, 24, p, g.id, 16)}
    ${seams(126, 150, 260, 232, p, 3, 4)}
    ${vent(150, 172, 210, 34, p)}
    <rect x="214" y="330" width="84" height="52" rx="6" fill="${shade(p.shadow, -0.5)}"/>
    <rect x="222" y="338" width="68" height="44" fill="${shade(p.accent, 0.15)}" opacity="0.85" filter="url(#glow)"/>
    <rect x="222" y="338" width="68" height="44" fill="${shade(p.accent, 0.35)}" opacity="0.5"/>
    <g fill="${shade(p.main, -0.05)}" stroke="${shade(p.shadow, -0.3)}" stroke-width="1.5">
      ${Array.from({ length: 6 }, (_, i) => `<ellipse cx="${140 + i * 42}" cy="378" rx="17" ry="11"/>`).join('')}
    </g>
    ${light(150, 168, 7, p.accent)} ${light(362, 168, 7, p.accent)}`;
  return S(p, g.def, body);
}

function silo(x, y, w, p) {
  const cx = x + w / 2;
  return `
    <rect x="${x}" y="${y + 6}" width="${w}" height="96" fill="${shade(p.shadow, -0.05)}"/>
    <rect x="${x}" y="${y + 6}" width="${w * 0.6}" height="96" fill="${p.main}"/>
    <rect x="${x}" y="${y + 6}" width="${w * 0.28}" height="96" fill="${shade(p.hi, 0)}" opacity="0.5"/>
    <rect x="${x}" y="${y + 6}" width="${w}" height="96" fill="none" stroke="${shade(p.shadow, -0.4)}" stroke-width="3"/>
    <ellipse cx="${cx}" cy="${y + 8}" rx="${w / 2}" ry="14" fill="${shade(p.main, 0.2)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="3"/>
    <ellipse cx="${cx}" cy="${y + 102}" rx="${w / 2}" ry="13" fill="${shade(p.shadow, -0.15)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3"/>`;
}

function refinery(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(96, 170, 320, 200, 24, p, g.id, 16)}
    ${seams(96, 170, 320, 200, p, 3, 2)}
    ${silo(150, 120, 64, p)} ${silo(232, 120, 64, p)}
    <g stroke="${shade(p.shadow, -0.2)}" stroke-width="9" fill="none" stroke-linecap="round"><path d="M182 184 V 250 H 330 V 300"/><path d="M264 184 V 232"/></g>
    <rect x="286" y="292" width="112" height="82" rx="8" fill="${shade(p.shadow, -0.5)}"/>
    <rect x="296" y="300" width="92" height="66" rx="4" fill="${shade(p.main, -0.18)}"/>
    <rect x="120" y="300" width="96" height="64" rx="8" fill="${shade(p.shadow, -0.25)}"/>
    ${light(168, 332, 13, '#b48bff')}
    <rect x="352" y="150" width="34" height="52" rx="6" fill="${shade(p.main, 0.05)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5"/>
    ${light(200, 200, 7, p.accent)} ${light(330, 200, 7, p.accent)}`;
  return S(p, g.def, body);
}

function powerNode(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(176, 210, 160, 150, 22, p, g.id, 14)}
    <g fill="${shade(p.shadow, -0.15)}">${Array.from({ length: 4 }, (_, i) => `<rect x="${190 + i * 36}" y="226" width="22" height="118" rx="4"/>`).join('')}</g>
    <g fill="${shade(p.hi, 0)}" opacity="0.35">${Array.from({ length: 4 }, (_, i) => `<rect x="${190 + i * 36}" y="226" width="8" height="118" rx="4"/>`).join('')}</g>
    <g fill="${shade(p.shadow, -0.2)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2"><polygon points="176,352 150,392 176,384"/><polygon points="336,352 362,392 336,384"/></g>
    <rect x="250" y="96" width="12" height="130" rx="4" fill="${shade(p.main, 0.1)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2"/>
    ${light(256, 96, 11, p.accent)} ${light(210, 250, 7, p.accent)}`;
  return S(p, g.def, body);
}

function warFactory(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(90, 150, 332, 250, 26, p, g.id, 18)}
    ${seams(90, 150, 332, 250, p, 4, 3)}
    <!-- big roll-up bay door at front -->
    <rect x="150" y="300" width="212" height="100" rx="8" fill="${shade(p.shadow, -0.45)}"/>
    <g stroke="${shade(p.shadow, -0.2)}" stroke-width="6">${Array.from({ length: 5 }, (_, i) => `<line x1="158" y1="${316 + i * 16}" x2="354" y2="${316 + i * 16}"/>`).join('')}</g>
    <polygon points="230,352 282,352 292,392 220,392" fill="${shade(p.accent, 0.1)}" opacity="0.5"/>
    <!-- gantry crane rail across roof -->
    <rect x="110" y="196" width="292" height="26" rx="6" fill="${shade(p.main, 0.05)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5"/>
    <rect x="238" y="188" width="42" height="42" rx="6" fill="${shade(p.shadow, -0.1)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5"/>
    ${vent(120, 236, 70, 48, p)} ${vent(332, 236, 60, 48, p)}
    ${light(120, 168, 8, p.accent)} ${light(392, 168, 8, p.accent)}`;
  return S(p, g.def, body);
}

function defenseTurret(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(186, 250, 140, 120, 20, p, g.id, 14)}
    <g fill="${shade(p.main, -0.05)}" stroke="${shade(p.shadow, -0.3)}" stroke-width="2">${Array.from({ length: 4 }, (_, i) => `<circle cx="${210 + (i % 2) * 92}" cy="${272 + Math.floor(i / 2) * 74}" r="8"/>`).join('')}</g>
    ${turret(256, 258, 56, p)}
    ${barrel(256, 250, 150, 20, p, p.accent)}
    <rect x="238" y="104" width="36" height="18" rx="5" fill="${shade(p.shadow, -0.2)}"/>
    ${light(256, 108, 7, p.accent)}`;
  return S(p, g.def, body);
}

function aaTurret(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(190, 250, 132, 120, 20, p, g.id, 14)}
    ${turret(256, 262, 52, p)}
    <!-- twin AA barrels, angled up-outward -->
    ${barrel(236, 258, 130, 12, p, p.accent)} ${barrel(276, 258, 130, 12, p, p.accent)}
    <rect x="222" y="240" width="68" height="20" rx="6" fill="${shade(p.shadow, -0.15)}"/>
    <!-- radar dish -->
    <ellipse cx="316" cy="286" rx="26" ry="16" fill="${shade(p.main, 0.1)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5" transform="rotate(28 316 286)"/>
    ${light(256, 130, 6, p.accent)}`;
  return S(p, g.def, body);
}

function radar(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(160, 250, 192, 130, 22, p, g.id, 16)}
    ${seams(160, 250, 192, 130, p, 2, 2)}
    <!-- rotating dish on a mast -->
    <rect x="248" y="150" width="16" height="110" rx="5" fill="${shade(p.main, 0.1)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5"/>
    <ellipse cx="256" cy="150" rx="78" ry="40" fill="${shade(p.main, 0.06)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5" transform="rotate(-18 256 150)"/>
    <ellipse cx="256" cy="150" rx="52" ry="24" fill="${shade(p.shadow, -0.1)}" transform="rotate(-18 256 150)"/>
    <line x1="256" y1="150" x2="300" y2="120" stroke="${shade(p.accent, 0.1)}" stroke-width="4"/>
    ${light(300, 120, 7, p.accent)} ${light(190, 300, 7, p.accent)} ${light(322, 300, 7, p.accent)}`;
  return S(p, g.def, body);
}

function processingPlant(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(96, 170, 320, 210, 24, p, g.id, 16)}
    ${seams(96, 170, 320, 210, p, 3, 2)}
    ${silo(120, 130, 58, p)}
    <!-- reactor drum -->
    <circle cx="300" cy="240" r="60" fill="${shade(p.main, 0.05)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5"/>
    <circle cx="300" cy="240" r="34" fill="${shade(p.shadow, -0.12)}"/>
    ${light(300, 240, 16, '#b48bff')}
    <g stroke="${shade(p.shadow, -0.2)}" stroke-width="8" fill="none" stroke-linecap="round"><path d="M149 210 V 300 H 240"/><path d="M300 300 V 344"/></g>
    ${vent(120, 320, 90, 46, p)}
    ${light(200, 200, 7, p.accent)} ${light(380, 200, 7, p.accent)}`;
  return S(p, g.def, body);
}

function skypad(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(120, 210, 272, 180, 22, p, g.id, 18)}
    <!-- circular landing pad with H and glow ring -->
    <circle cx="256" cy="300" r="96" fill="${shade(p.shadow, -0.1)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3"/>
    <circle cx="256" cy="300" r="96" fill="none" stroke="${p.accent}" stroke-width="4" opacity="0.6" filter="url(#glow)"/>
    <g stroke="${shade(p.hi, 0)}" stroke-width="12" opacity="0.7"><line x1="228" y1="272" x2="228" y2="328"/><line x1="284" y1="272" x2="284" y2="328"/><line x1="228" y1="300" x2="284" y2="300"/></g>
    <rect x="130" y="220" width="52" height="60" rx="8" fill="${shade(p.main, 0.05)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5"/>
    ${light(156, 232, 7, p.accent)} ${light(360, 232, 7, p.accent)}`;
  return S(p, g.def, body);
}

function wall(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(150, 210, 212, 92, 22, p, g.id, 10)}
    <g stroke="${shade(p.shadow, -0.25)}" stroke-width="3">${Array.from({ length: 3 }, (_, i) => `<line x1="${203 + i * 53}" y1="216" x2="${203 + i * 53}" y2="296"/>`).join('')}<line x1="150" y1="256" x2="362" y2="256"/></g>
    <g fill="${shade(p.main, 0.1)}">${Array.from({ length: 5 }, (_, i) => `<rect x="${152 + i * 44}" y="196" width="26" height="16" rx="3"/>`).join('')}</g>`;
  return S(p, g.def, body);
}

function gate(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(120, 200, 80, 112, 22, p, g.id, 8)} ${block(312, 200, 80, 112, 22, p, g.id, 8)}
    <g fill="${shade(p.main, 0.1)}">${Array.from({ length: 2 }, (_, i) => `<rect x="${124 + i * 44}" y="186" width="26" height="16" rx="3"/>`).join('')}${Array.from({ length: 2 }, (_, i) => `<rect x="${316 + i * 44}" y="186" width="26" height="16" rx="3"/>`).join('')}</g>
    <!-- open gate throat with glow -->
    <rect x="200" y="228" width="112" height="56" fill="${shade(p.shadow, -0.5)}"/>
    <rect x="200" y="228" width="112" height="56" fill="${p.accent}" opacity="0.18" filter="url(#glow)"/>
    ${light(160, 216, 7, p.accent)} ${light(352, 216, 7, p.accent)}`;
  return S(p, g.def, body);
}

function bunker(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    <!-- low domed pillbox -->
    <ellipse cx="256" cy="288" rx="150" ry="120" fill="${shade(p.shadow, -0.15)}"/>
    <ellipse cx="256" cy="276" rx="150" ry="118" fill="url(#${g.id})" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5"/>
    <ellipse cx="222" cy="238" rx="70" ry="52" fill="${shade(p.hi, 0)}" opacity="0.2"/>
    <!-- firing slits -->
    <g fill="${shade(p.shadow, -0.5)}"><rect x="176" y="250" width="46" height="16" rx="6" transform="rotate(-16 199 258)"/><rect x="290" y="250" width="46" height="16" rx="6" transform="rotate(16 313 258)"/><rect x="234" y="196" width="44" height="16" rx="6"/></g>
    <g fill="${shade(p.main, 0.05)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2">${Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return `<circle cx="${256 + Math.cos(a) * 120}" cy="${276 + Math.sin(a) * 92}" r="12"/>`; }).join('')}</g>
    ${light(256, 276, 8, p.accent)}`;
  return S(p, g.def, body);
}

function infirmary(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(130, 170, 252, 220, 24, p, g.id, 18)}
    ${seams(130, 170, 252, 220, p, 2, 2)}
    <!-- glowing medical cross -->
    <rect x="228" y="220" width="56" height="120" rx="8" fill="#e8f6ff"/>
    <rect x="196" y="252" width="120" height="56" rx="8" fill="#e8f6ff"/>
    <rect x="228" y="220" width="56" height="120" rx="8" fill="${p.accent}" opacity="0.25" filter="url(#glow)"/>
    <rect x="196" y="252" width="120" height="56" rx="8" fill="${p.accent}" opacity="0.25" filter="url(#glow)"/>
    ${vent(146, 350, 80, 32, p)}
    ${light(150, 188, 7, p.accent)} ${light(362, 188, 7, p.accent)}`;
  return S(p, g.def, body);
}

function machineShop(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(110, 180, 292, 200, 24, p, g.id, 16)}
    ${seams(110, 180, 292, 200, p, 3, 2)}
    <!-- sawtooth factory roof -->
    <g fill="${shade(p.shadow, -0.05)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2">${Array.from({ length: 4 }, (_, i) => `<polygon points="${130 + i * 66},250 ${172 + i * 66},210 ${172 + i * 66},250"/>`).join('')}</g>
    <g fill="${shade(p.accent, 0.2)}" opacity="0.5">${Array.from({ length: 4 }, (_, i) => `<polygon points="${150 + i * 66},250 ${172 + i * 66},226 ${172 + i * 66},250"/>`).join('')}</g>
    <rect x="150" y="320" width="200" height="60" rx="6" fill="${shade(p.shadow, -0.4)}"/>
    <g stroke="${shade(p.shadow, -0.15)}" stroke-width="5">${Array.from({ length: 4 }, (_, i) => `<line x1="158" y1="${332 + i * 12}" x2="342" y2="${332 + i * 12}"/>`).join('')}</g>
    ${light(130, 198, 7, p.accent)} ${light(382, 198, 7, p.accent)}`;
  return S(p, g.def, body);
}

// neutral capturable structures
function derrick(team) {
  const p = pal('neutral'); const g = topGrad(p);
  const body = `
    ${block(180, 250, 152, 120, 20, p, g.id, 12)}
    <!-- pump-jack derrick tower (lattice) -->
    <g stroke="${shade(p.shadow, -0.35)}" stroke-width="4" fill="none"><polygon points="230,120 282,120 300,250 212,250"/><line x1="240" y1="160" x2="272" y2="160"/><line x1="228" y1="200" x2="284" y2="200"/></g>
    <g stroke="${shade(p.shadow, -0.4)}" stroke-width="3"><line x1="230" y1="120" x2="300" y2="250"/><line x1="282" y1="120" x2="212" y2="250"/></g>
    <ellipse cx="256" cy="118" rx="20" ry="10" fill="${shade(p.main, 0.1)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5"/>
    <rect x="150" y="300" width="60" height="50" rx="8" fill="${shade(p.main, 0.05)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5"/>
    ${light(180, 312, 8, '#ffd34d')}`;
  return S(p, g.def, body);
}
function relay(team) {
  const p = pal('neutral'); const g = topGrad(p);
  const body = `
    ${block(200, 260, 112, 110, 18, p, g.id, 12)}
    <rect x="250" y="120" width="12" height="150" rx="4" fill="${shade(p.main, 0.1)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2"/>
    <g stroke="${shade(p.shadow, -0.35)}" stroke-width="3"><line x1="220" y1="150" x2="292" y2="150"/><line x1="228" y1="176" x2="284" y2="176"/><line x1="236" y1="202" x2="276" y2="202"/></g>
    ${light(256, 120, 12, '#00e5ff')} ${light(228, 300, 7, '#ffd34d')}`;
  return S(p, g.def, body);
}
function wreck(team) {
  const p = pal('neutral'); const g = topGrad(p);
  const rust = '#7a6a52';
  const body = `
    <polygon points="256,170 330,220 320,350 190,350 182,222" fill="${shade(rust, 0.05)}" stroke="${shade(rust, -0.4)}" stroke-width="3.5"/>
    <polygon points="256,170 300,206 214,206" fill="${shade(rust, 0.2)}" opacity="0.4"/>
    <circle cx="256" cy="278" r="44" fill="${shade(rust, -0.15)}" stroke="${shade(rust, -0.45)}" stroke-width="3"/>
    <!-- broken barrel, holes, scorch -->
    <rect x="248" y="150" width="14" height="120" rx="4" fill="${shade(rust, 0.05)}" stroke="${shade(rust, -0.4)}" stroke-width="2" transform="rotate(24 256 210)"/>
    <g fill="${shade(rust, -0.5)}"><circle cx="220" cy="300" r="12"/><circle cx="296" cy="256" r="9"/><circle cx="240" cy="240" r="7"/></g>
    <g fill="#2a2420" opacity="0.5"><ellipse cx="270" cy="320" rx="40" ry="20"/></g>`;
  return S(p, g.def, body);
}

// ============================ UNITS (facing up) ============================

function assaultTank(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${tracks(150, 316, 168, 46, 200, p)}
    ${langShape([[256, 150], [344, 210], [344, 360], [168, 360], [168, 210]], p, g.id, hashStr('assault_tank'))}
    <polygon points="256,150 300,196 212,196" fill="${shade(p.hi, 0)}" opacity="0.3"/>
    ${vent(198, 322, 116, 30, p)}
    ${turret(256, 270, 52, p)}
    ${barrel(256, 250, 130, 16, p, p.accent)}
    ${light(256, 126, 6, p.accent)}`;
  return S(p, g.def, body);
}

function scoutVehicle(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${wheels(178, 334, 210, 350, 30, 2, p)}
    <!-- open frame body -->
    ${langShape([[196, 196], [316, 196], [316, 366], [196, 366]], p, g.id, hashStr('scout_vehicle'))}
    <rect x="216" y="220" width="80" height="120" rx="12" fill="${shade(p.shadow, -0.2)}"/>
    <!-- roll cage bars -->
    <g stroke="${shade(p.shadow, -0.35)}" stroke-width="6" fill="none"><rect x="216" y="220" width="80" height="120" rx="12"/><line x1="256" y1="220" x2="256" y2="340"/></g>
    <!-- pintle MG forward -->
    <rect x="248" y="150" width="16" height="80" rx="4" fill="${shade(p.shadow, -0.45)}"/>
    <circle cx="256" cy="238" r="16" fill="${shade(p.main, 0.1)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5"/>
    ${light(256, 154, 5, p.accent)}`;
  return S(p, g.def, body);
}

function longbow(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${tracks(158, 316, 210, 40, 158, p)}
    ${langShape([[196, 220], [316, 220], [316, 370], [196, 370]], p, g.id, hashStr('longbow'))}
    <!-- splayed stabiliser feet -->
    <g fill="${shade(p.shadow, -0.1)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5"><polygon points="196,232 150,206 168,244"/><polygon points="316,232 362,206 344,244"/><polygon points="196,358 150,384 168,346"/><polygon points="316,358 362,384 344,346"/></g>
    <!-- ammo rack -->
    ${vent(210, 320, 92, 40, p)}
    <circle cx="256" cy="300" r="30" fill="${shade(p.main, 0.06)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3"/>
    <!-- signature very long barrel -->
    ${barrel(256, 300, 220, 18, p, p.accent)}
    <rect x="242" y="120" width="28" height="16" rx="5" fill="${shade(p.shadow, -0.2)}"/>
    ${light(256, 118, 6, p.accent)}`;
  return S(p, g.def, body);
}

function skimmerApc(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    <!-- glowing hover skirt -->
    <rect x="164" y="180" width="184" height="210" rx="30" fill="${p.accent}" opacity="0.28" filter="url(#glow)"/>
    ${langShape([[176, 188], [336, 188], [336, 384], [176, 384]], p, g.id, hashStr('skimmer_apc'))}
    <rect x="176" y="188" width="60" height="196" rx="22" fill="${shade(p.hi, 0)}" opacity="0.18"/>
    <!-- side viewports -->
    <g fill="${shade(p.accent, 0.1)}">${Array.from({ length: 3 }, (_, i) => `<rect x="188" y="${226 + i * 46}" width="16" height="24" rx="3"/><rect x="308" y="${226 + i * 46}" width="16" height="24" rx="3"/>`).join('')}</g>
    <!-- sensor mast + rear ramp seam -->
    <rect x="244" y="150" width="24" height="46" rx="6" fill="${shade(p.main, 0.1)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5"/>
    <line x1="196" y1="366" x2="316" y2="366" stroke="${shade(p.shadow, -0.4)}" stroke-width="4"/>
    ${light(256, 154, 5, p.accent)}`;
  return S(p, g.def, body);
}

function gunship(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    <!-- narrow fuselage -->
    ${langShape([[256, 150], [288, 230], [280, 360], [232, 360], [224, 230]], p, g.id, hashStr('gunship'))}
    <ellipse cx="256" cy="210" rx="22" ry="30" fill="${shade(p.accent, 0.1)}"/>
    <!-- stub wings + missile pods -->
    <rect x="150" y="250" width="80" height="26" rx="8" fill="${shade(p.main, 0.02)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5"/>
    <rect x="282" y="250" width="80" height="26" rx="8" fill="${shade(p.main, 0.02)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5"/>
    <g fill="${shade(p.shadow, -0.3)}"><rect x="150" y="238" width="26" height="20" rx="4"/><rect x="336" y="238" width="26" height="20" rx="4"/></g>
    <!-- twin rotor discs -->
    ${rotorDisc(158, 210, 74)} ${rotorDisc(354, 210, 74)}
    <rect x="256" y="356" width="6" height="60" fill="${shade(p.shadow, -0.3)}" transform="translate(-3,0)"/>
    ${light(256, 200, 6, p.accent)}`;
  return S(p, g.def, body);
}

function harvester(team) {
  const p = pal(team); const g = topGrad(p);
  const ore = '#8a7a53';
  const body = `
    ${tracks(150, 322, 200, 40, 180, p)}
    <!-- big ore hopper body -->
    ${langShape([[256, 158], [356, 214], [356, 372], [156, 372], [156, 214]], p, g.id, hashStr('harvester'))}
    <rect x="196" y="230" width="120" height="120" rx="10" fill="${shade(ore, -0.1)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5"/>
    <g fill="${shade(ore, 0.1)}"><circle cx="224" cy="262" r="12"/><circle cx="256" cy="250" r="14"/><circle cx="288" cy="266" r="11"/><circle cx="240" cy="292" r="10"/><circle cx="276" cy="300" r="12"/></g>
    <!-- front intake scoop -->
    <polygon points="196,158 316,158 336,196 176,196" fill="${shade(p.shadow, -0.2)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5"/>
    <g stroke="${shade(p.shadow, -0.45)}" stroke-width="3">${Array.from({ length: 5 }, (_, i) => `<line x1="${196 + i * 30}" y1="158" x2="${188 + i * 30}" y2="196"/>`).join('')}</g>
    ${light(180, 214, 5, p.accent)} ${light(332, 214, 5, p.accent)}`;
  return S(p, g.def, body);
}

// infantry-type figures
function infantry(team) { return S(pal(team), '', soldier(256, 256, pal(team), { weapon: 'rifle' })); }
function rocketTrooper(team) { return S(pal(team), '', soldier(256, 256, pal(team), { weapon: 'rocket' })); }
function warden(team) {
  const p = pal(team);
  // heavy exo commander: big body, oversized shoulder plates, cyan visor, two-handed cannon
  const body = `
    <g fill="${shade(p.main, 0.04)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="4"><ellipse cx="176" cy="248" rx="46" ry="34"/><ellipse cx="336" cy="248" rx="46" ry="34"/></g>
    ${soldier(256, 268, p, { hero: true, weapon: 'cannon' })}
    <rect x="222" y="250" width="68" height="16" rx="6" fill="${shade(p.accent, -0.05)}" opacity="0.9"/>`;
  return S(p, '', body);
}
function ghostwalker(team) {
  const p = pal('emberhand');
  const cloak = shade('#4a4038', 0.05), ash = '#6b5f52';
  const body = `
    <!-- ragged shroud cloak, filling the frame -->
    <polygon points="256,120 336,236 366,392 146,392 176,236" fill="${cloak}" stroke="${shade(cloak, -0.4)}" stroke-width="4"/>
    <polygon points="256,120 308,224 204,224" fill="${ash}" opacity="0.5"/>
    <g fill="${shade(cloak, -0.3)}"><polygon points="146,392 178,336 200,394"/><polygon points="366,392 334,336 312,394"/><polygon points="256,394 232,348 280,348"/></g>
    <circle cx="256" cy="224" r="38" fill="${shade(ash, 0.05)}" stroke="${shade(cloak, -0.4)}" stroke-width="3.5"/>
    <rect x="226" y="214" width="60" height="14" rx="5" fill="${shade(p.accent, -0.1)}"/>
    <!-- long curved blade held low to the right -->
    <path d="M330 300 q 78 34 60 128" stroke="#c8ccd2" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M330 300 q 78 34 60 128" stroke="#eef2f6" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${light(256, 222, 7, p.accent)}`;
  return S(p, '', body);
}
function vane(team) {
  const p = pal('emberhand');
  const cloak = '#8a8178';
  const body = `
    <polygon points="256,124 340,244 366,392 146,392 172,244" fill="${cloak}" stroke="${shade(cloak, -0.4)}" stroke-width="4"/>
    <polygon points="256,124 300,216 212,216" fill="${shade(cloak, 0.12)}" opacity="0.5"/>
    <!-- crimson sash across the chest -->
    <polygon points="196,246 316,338 296,364 176,272" fill="#c8203a" stroke="#7d1020" stroke-width="2"/>
    <g fill="${shade(p.main, 0.05)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5"><ellipse cx="182" cy="256" rx="38" ry="26"/><ellipse cx="330" cy="256" rx="38" ry="26"/></g>
    <circle cx="256" cy="234" r="34" fill="${shade(cloak, 0.12)}" stroke="${shade(cloak, -0.4)}" stroke-width="3.5"/>
    <!-- dual pistols forward -->
    <rect x="170" y="150" width="22" height="104" rx="7" fill="${shade(p.shadow, -0.4)}"/>
    <rect x="320" y="150" width="22" height="104" rx="7" fill="${shade(p.shadow, -0.4)}"/>
    ${light(181, 156, 6, p.accent)} ${light(331, 156, 6, p.accent)}`;
  return S(p, '', body);
}

function riftmaw(team) {
  const obs = '#3c3630';
  const body = `
    <!-- segmented obsidian worm rearing up -->
    <g stroke="${shade(obs, -0.4)}" stroke-width="3">
      <ellipse cx="256" cy="360" rx="90" ry="46" fill="${shade(obs, 0.02)}"/>
      <ellipse cx="256" cy="300" rx="80" ry="44" fill="${shade(obs, 0.05)}"/>
      <ellipse cx="256" cy="242" rx="70" ry="42" fill="${shade(obs, 0.08)}"/>
      <ellipse cx="256" cy="190" rx="58" ry="40" fill="${shade(obs, 0.1)}"/>
    </g>
    <!-- open jaws at top -->
    <g fill="${shade(obs, -0.2)}" stroke="${shade(obs, -0.45)}" stroke-width="2.5">
      <polygon points="216,160 256,120 250,180"/><polygon points="296,160 256,120 262,180"/>
      <polygon points="230,150 210,190 244,176"/><polygon points="282,150 302,190 268,176"/></g>
    <!-- glowing violet crystal spines -->
    <g stroke="${shade('#3c3630', -0.3)}" stroke-width="2">
      ${[[220, 330, 26], [292, 330, 26], [230, 274, 24], [282, 274, 24], [240, 220, 20], [272, 220, 20]].map(([x, y, h]) => `<polygon points="${x},${y - h} ${x - 12},${y} ${x + 12},${y}" fill="#b48bff"/><polygon points="${x},${y - h} ${x - 4},${y} ${x + 4},${y}" fill="#e6d4ff"/>`).join('')}
    </g>
    ${[[220, 330], [292, 330], [256, 250]].map(([x, y]) => light(x, y - 10, 6, '#b48bff')).join('')}`;
  return svg(F, F, '', body);
}

// light tank (the generic 'vehicle' unit) — smaller than the assault tank
function vehicle(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${tracks(168, 314, 200, 40, 150, p)}
    ${langShape([[196, 200], [316, 200], [316, 350], [196, 350]], p, g.id, hashStr('vehicle'))}
    <polygon points="256,200 296,232 216,232" fill="${shade(p.hi, 0)}" opacity="0.28"/>
    ${turret(256, 268, 44, p)}
    ${barrel(256, 252, 96, 13, p, p.accent)}
    ${light(256, 160, 5, p.accent)}`;
  return S(p, g.def, body);
}

function genericStructure(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(150, 180, 212, 200, 22, p, g.id, 14)}
    ${seams(150, 180, 212, 200, p, 2, 2)}
    ${vent(172, 202, 80, 40, p)}
    ${light(172, 198, 6, p.accent)} ${light(342, 198, 6, p.accent)}`;
  return S(p, g.def, body);
}

// ============================ EXPANSION BUILDINGS ============================

function techLab(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(120, 160, 272, 230, 24, p, g.id, 16)}
    ${seams(120, 160, 272, 230, p, 3, 2)}
    <!-- research dome -->
    <circle cx="256" cy="250" r="70" fill="${shade(p.main, 0.05)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5"/>
    <circle cx="256" cy="250" r="42" fill="${shade(p.shadow, -0.1)}"/>
    ${light(256, 250, 18, p.accent)}
    ${vent(140, 340, 70, 36, p)} ${vent(302, 340, 70, 36, p)}
    ${light(150, 178, 7, p.accent)} ${light(362, 178, 7, p.accent)}`;
  return S(p, g.def, body);
}

function heavyGate(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(100, 190, 100, 130, 20, p, g.id, 10)} ${block(312, 190, 100, 130, 20, p, g.id, 10)}
    <g fill="${shade(p.main, 0.08)}">${Array.from({ length: 2 }, (_, i) => `<rect x="${110 + i * 50}" y="176" width="30" height="18" rx="3"/>`).join('')}${Array.from({ length: 2 }, (_, i) => `<rect x="${322 + i * 50}" y="176" width="30" height="18" rx="3"/>`).join('')}</g>
    <!-- thick reinforced throat -->
    <rect x="200" y="220" width="112" height="70" fill="${shade(p.shadow, -0.55)}"/>
    <rect x="208" y="228" width="96" height="54" fill="${p.accent}" opacity="0.22" filter="url(#glow)"/>
    <g stroke="${shade(p.shadow, -0.25)}" stroke-width="5"><line x1="220" y1="236" x2="292" y2="236"/><line x1="220" y1="256" x2="292" y2="256"/><line x1="220" y1="276" x2="292" y2="276"/></g>
    ${light(150, 206, 7, p.accent)} ${light(362, 206, 7, p.accent)}`;
  return S(p, g.def, body);
}

function barracksElite(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(110, 140, 292, 250, 26, p, g.id, 18)}
    ${seams(110, 140, 292, 250, p, 3, 4)}
    ${vent(130, 162, 250, 36, p)}
    <!-- elite chevron banner -->
    <polygon points="256,200 300,260 256,240 212,260" fill="${p.accent}" opacity="0.55" filter="url(#glow)"/>
    <rect x="200" y="320" width="112" height="56" rx="6" fill="${shade(p.shadow, -0.5)}"/>
    <rect x="210" y="328" width="92" height="40" fill="${shade(p.accent, 0.2)}" opacity="0.85"/>
    <g fill="${shade(p.main, -0.05)}" stroke="${shade(p.shadow, -0.3)}" stroke-width="1.5">
      ${Array.from({ length: 7 }, (_, i) => `<ellipse cx="${130 + i * 38}" cy="388" rx="15" ry="10"/>`).join('')}
    </g>
    ${light(140, 158, 7, p.accent)} ${light(372, 158, 7, p.accent)}`;
  return S(p, g.def, body);
}

function armorUpgradeCenter(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(130, 170, 252, 210, 24, p, g.id, 16)}
    ${seams(130, 170, 252, 210, p, 2, 2)}
    <!-- anvil / plating press -->
    <rect x="186" y="230" width="140" height="90" rx="10" fill="${shade(p.shadow, -0.2)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3"/>
    <rect x="206" y="210" width="100" height="30" rx="6" fill="${shade(p.main, 0.05)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5"/>
    <g fill="${shade(p.accent, 0.15)}" opacity="0.7">${Array.from({ length: 3 }, (_, i) => `<rect x="${220 + i * 28}" y="250" width="18" height="50" rx="3"/>`).join('')}</g>
    ${vent(150, 340, 80, 30, p)}
    ${light(160, 188, 7, p.accent)} ${light(352, 188, 7, p.accent)}`;
  return S(p, g.def, body);
}

function airPad(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(130, 200, 252, 170, 22, p, g.id, 16)}
    <circle cx="256" cy="290" r="88" fill="${shade(p.shadow, -0.12)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3"/>
    <circle cx="256" cy="290" r="88" fill="none" stroke="${p.accent}" stroke-width="3" opacity="0.5" filter="url(#glow)"/>
    <!-- landing chevrons -->
    <g fill="${shade(p.hi, 0)}" opacity="0.65"><polygon points="256,240 276,280 236,280"/><polygon points="256,340 276,300 236,300"/></g>
    <rect x="140" y="210" width="48" height="50" rx="8" fill="${shade(p.main, 0.05)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5"/>
    ${light(164, 222, 6, p.accent)} ${light(348, 222, 6, p.accent)}`;
  return S(p, g.def, body);
}

function radarAddon(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(180, 260, 152, 110, 18, p, g.id, 12)}
    <rect x="248" y="140" width="16" height="130" rx="5" fill="${shade(p.main, 0.1)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5"/>
    <ellipse cx="256" cy="140" rx="64" ry="32" fill="${shade(p.main, 0.06)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3" transform="rotate(-22 256 140)"/>
    <line x1="256" y1="140" x2="300" y2="112" stroke="${shade(p.accent, 0.15)}" stroke-width="3"/>
    ${light(300, 112, 6, p.accent)} ${light(210, 300, 6, p.accent)}`;
  return S(p, g.def, body);
}

function ionCannon(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${block(90, 160, 332, 250, 28, p, g.id, 18)}
    ${seams(90, 160, 332, 250, p, 3, 2)}
    <!-- massive dish / emitter -->
    <ellipse cx="256" cy="240" rx="110" ry="70" fill="${shade(p.shadow, -0.15)}" stroke="${shade(p.shadow, -0.45)}" stroke-width="4"/>
    <ellipse cx="256" cy="240" rx="70" ry="42" fill="${shade(p.main, 0.05)}"/>
    <circle cx="256" cy="240" r="28" fill="${shade(p.accent, 0.2)}" filter="url(#glow)"/>
    ${barrel(256, 240, 180, 22, p, p.accent)}
    <rect x="120" y="340" width="80" height="50" rx="8" fill="${shade(p.shadow, -0.3)}"/>
    <rect x="312" y="340" width="80" height="50" rx="8" fill="${shade(p.shadow, -0.3)}"/>
    ${light(256, 200, 10, p.accent)} ${light(130, 180, 7, p.accent)} ${light(382, 180, 7, p.accent)}`;
  return S(p, g.def, body);
}

function resonanceDevice(team) {
  const p = pal(team === 'enemy' ? 'shardborn' : team); const g = topGrad(p);
  const crystal = '#b48bff';
  const body = `
    ${block(100, 170, 312, 230, 26, p, g.id, 16)}
    ${seams(100, 170, 312, 230, p, 2, 2)}
    <!-- living crystal core -->
    <polygon points="256,140 320,230 256,320 192,230" fill="${crystal}" opacity="0.85" filter="url(#glow)"/>
    <polygon points="256,160 300,230 256,300 212,230" fill="${shade(crystal, 0.25)}"/>
    <g stroke="${shade(crystal, -0.2)}" stroke-width="3" fill="none">
      <line x1="160" y1="200" x2="210" y2="230"/><line x1="352" y1="200" x2="302" y2="230"/>
      <line x1="160" y1="320" x2="210" y2="280"/><line x1="352" y1="320" x2="302" y2="280"/>
    </g>
    ${light(256, 230, 14, crystal)} ${light(140, 190, 6, p.accent)} ${light(372, 190, 6, p.accent)}`;
  return S(p, g.def, body);
}

// ============================ EXPANSION UNITS ============================

function howitzer(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${tracks(158, 316, 200, 42, 170, p)}
    ${langShape([[190, 230], [322, 230], [322, 380], [190, 380]], p, g.id, hashStr('howitzer'))}
    <g fill="${shade(p.shadow, -0.1)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5">
      <polygon points="190,250 140,220 160,268"/><polygon points="322,250 372,220 352,268"/>
    </g>
    ${vent(210, 320, 92, 36, p)}
    <circle cx="256" cy="300" r="34" fill="${shade(p.main, 0.06)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3"/>
    <!-- short fat siege barrel -->
    ${barrel(256, 290, 160, 28, p, p.accent)}
    <rect x="236" y="150" width="40" height="22" rx="6" fill="${shade(p.shadow, -0.2)}"/>
    ${light(256, 148, 6, p.accent)}`;
  return S(p, g.def, body);
}

function engineer(team) {
  const p = pal(team);
  const body = `
    ${soldier(256, 268, p, { weapon: 'rifle' })}
    <!-- tool pack + wrench silhouette -->
    <rect x="300" y="240" width="48" height="70" rx="10" fill="${shade(p.shadow, -0.15)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5"/>
    <rect x="312" y="200" width="10" height="50" rx="3" fill="${shade(p.accent, 0.1)}" transform="rotate(25 317 225)"/>
    <rect x="300" y="210" width="36" height="10" rx="3" fill="${shade(p.accent, 0.1)}" transform="rotate(25 318 215)"/>
    ${light(324, 250, 5, p.accent)}`;
  return S(p, '', body);
}

function transportApc(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${wheels(170, 340, 200, 360, 28, 3, p)}
    ${langShape([[170, 190], [342, 190], [342, 380], [170, 380]], p, g.id, hashStr('transport_apc'))}
    <rect x="190" y="220" width="132" height="130" rx="12" fill="${shade(p.shadow, -0.18)}"/>
    <g fill="${shade(p.accent, 0.12)}">${Array.from({ length: 4 }, (_, i) => `<rect x="${200 + i * 28}" y="240" width="16" height="28" rx="3"/>`).join('')}</g>
    <line x1="190" y1="360" x2="322" y2="360" stroke="${shade(p.shadow, -0.4)}" stroke-width="5"/>
    <rect x="240" y="160" width="32" height="40" rx="6" fill="${shade(p.main, 0.08)}" stroke="${shade(p.shadow, -0.35)}" stroke-width="2.5"/>
    ${light(256, 164, 5, p.accent)}`;
  return S(p, g.def, body);
}

function defenseDrone(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    <!-- compact flying disc -->
    <ellipse cx="256" cy="270" rx="90" ry="50" fill="${p.accent}" opacity="0.2" filter="url(#glow)"/>
    ${langShape([[210, 220], [302, 220], [320, 300], [192, 300]], p, g.id, hashStr('defense_drone'))}
    <circle cx="256" cy="260" r="28" fill="${shade(p.shadow, -0.1)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5"/>
    ${barrel(256, 250, 70, 10, p, p.accent)}
    ${rotorDisc(180, 240, 40)} ${rotorDisc(332, 240, 40)}
    ${light(256, 248, 5, p.accent)}`;
  return S(p, g.def, body);
}

function repairTruck(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${wheels(176, 336, 210, 350, 28, 2, p)}
    ${langShape([[186, 200], [326, 200], [326, 370], [186, 370]], p, g.id, hashStr('repair_truck'))}
    <!-- crane arm -->
    <g stroke="${shade(p.shadow, -0.35)}" stroke-width="10" fill="none" stroke-linecap="round">
      <path d="M256 230 L 256 160 L 330 130"/>
    </g>
    <circle cx="256" cy="230" r="18" fill="${shade(p.main, 0.1)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5"/>
    <rect x="210" y="280" width="92" height="60" rx="8" fill="${shade(p.shadow, -0.2)}"/>
    <!-- medical/repair cross -->
    <rect x="244" y="292" width="24" height="36" rx="4" fill="#e8f6ff"/>
    <rect x="232" y="304" width="48" height="20" rx="4" fill="#e8f6ff"/>
    ${light(330, 130, 6, p.accent)}`;
  return S(p, g.def, body);
}

function mediumTank(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${tracks(160, 318, 190, 42, 180, p)}
    ${langShape([[196, 180], [316, 180], [316, 360], [196, 360]], p, g.id, hashStr('medium_tank'))}
    <polygon points="256,180 296,216 216,216" fill="${shade(p.hi, 0)}" opacity="0.28"/>
    ${vent(210, 300, 92, 28, p)}
    ${turret(256, 270, 48, p)}
    ${barrel(256, 252, 110, 14, p, p.accent)}
    ${light(256, 150, 5, p.accent)}`;
  return S(p, g.def, body);
}

function superHeavyTank(team) {
  const p = pal(team); const g = topGrad(p);
  const body = `
    ${tracks(130, 330, 150, 52, 230, p)}
    ${langShape([[170, 140], [342, 140], [354, 380], [158, 380]], p, g.id, hashStr('super_heavy_tank'))}
    <polygon points="256,140 310,190 202,190" fill="${shade(p.hi, 0)}" opacity="0.25"/>
    ${vent(200, 300, 112, 40, p)}
    ${turret(256, 260, 64, p)}
    ${barrel(256, 240, 160, 20, p, p.accent)}
    <!-- side sponsons -->
    <rect x="150" y="250" width="36" height="70" rx="8" fill="${shade(p.main, 0.02)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5"/>
    <rect x="326" y="250" width="36" height="70" rx="8" fill="${shade(p.main, 0.02)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5"/>
    ${light(256, 120, 7, p.accent)}`;
  return S(p, g.def, body);
}

function commando(team) {
  const p = pal(team);
  const body = `
    ${soldier(256, 268, p, { weapon: 'rifle' })}
    <!-- satchel charge pack -->
    <rect x="290" y="250" width="44" height="56" rx="8" fill="${shade(p.shadow, -0.2)}" stroke="${shade(p.shadow, -0.45)}" stroke-width="2.5"/>
    <rect x="300" y="262" width="24" height="16" rx="3" fill="#c8203a" opacity="0.8"/>
    ${light(312, 270, 4, '#ff6a2b')}`;
  return S(p, '', body);
}

function laserTrooper(team) {
  const p = pal(team);
  const body = `
    ${soldier(256, 268, p, { weapon: 'rifle' })}
    <!-- glowing laser emitter replacing muzzle -->
    <rect x="244" y="120" width="24" height="70" rx="6" fill="${shade(p.accent, 0.15)}" filter="url(#glow)"/>
    <rect x="248" y="110" width="16" height="18" rx="4" fill="${p.accent}" opacity="0.9"/>
    ${light(256, 116, 6, p.accent)}`;
  return S(p, '', body);
}

function razor(team) {
  const p = pal(team);
  const body = `
    <g fill="${shade(p.main, 0.04)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="3.5">
      <ellipse cx="170" cy="250" rx="40" ry="28"/><ellipse cx="342" cy="250" rx="40" ry="28"/>
    </g>
    ${soldier(256, 270, p, { hero: true, weapon: 'rifle' })}
    <!-- twin laser emitters -->
    <rect x="160" y="140" width="18" height="90" rx="5" fill="${shade(p.accent, 0.2)}" filter="url(#glow)"/>
    <rect x="334" y="140" width="18" height="90" rx="5" fill="${shade(p.accent, 0.2)}" filter="url(#glow)"/>
    ${light(169, 146, 5, p.accent)} ${light(343, 146, 5, p.accent)}
    <rect x="220" y="248" width="72" height="14" rx="5" fill="${shade(p.accent, -0.05)}" opacity="0.85"/>`;
  return S(p, '', body);
}

function tempest(team) {
  const p = pal(team === 'player' ? 'shardborn' : team); const g = topGrad(p);
  const body = `
    ${tracks(150, 320, 170, 46, 200, p)}
    ${langShape([[200, 160], [312, 160], [340, 370], [172, 370]], p, g.id, hashStr('tempest'))}
    <!-- crystal wedge prow -->
    <polygon points="256,130 300,200 212,200" fill="#b48bff" opacity="0.7" filter="url(#glow)"/>
    ${turret(256, 270, 50, p)}
    <!-- missile pods -->
    <rect x="170" y="250" width="36" height="80" rx="8" fill="${shade(p.shadow, -0.2)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5"/>
    <rect x="306" y="250" width="36" height="80" rx="8" fill="${shade(p.shadow, -0.2)}" stroke="${shade(p.shadow, -0.4)}" stroke-width="2.5"/>
    ${barrel(256, 250, 100, 14, p, '#b48bff')}
    ${light(256, 140, 7, '#b48bff')}`;
  return S(p, g.def, body);
}

export const SHAPES = {
  vehicle, generic_structure: genericStructure,
  construction_yard: constructionYard, barracks, refinery, power_node: powerNode,
  war_factory: warFactory, defense_turret: defenseTurret, aa_turret: aaTurret,
  radar, processing_plant: processingPlant, skypad, wall, gate, bunker,
  infirmary, machine_shop: machineShop, derrick, relay, wreck,
  tech_lab: techLab, heavy_gate: heavyGate, barracks_elite: barracksElite,
  armor_upgrade_center: armorUpgradeCenter, air_pad: airPad, radar_addon: radarAddon,
  ion_cannon: ionCannon, resonance_device: resonanceDevice,
  assault_tank: assaultTank, scout_vehicle: scoutVehicle, longbow,
  skimmer_apc: skimmerApc, gunship, harvester, infantry, rocket_trooper: rocketTrooper,
  warden, ghostwalker, vane, riftmaw,
  howitzer, engineer, transport_apc: transportApc, defense_drone: defenseDrone,
  repair_truck: repairTruck, medium_tank: mediumTank, super_heavy_tank: superHeavyTank,
  commando, laser_trooper: laserTrooper, razor, tempest,
};
