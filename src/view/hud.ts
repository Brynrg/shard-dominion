// ── HUD: credits + cargo + storage + build queue + power readout ────────────────
// Renders economy and build queue HUD on top of the game canvas.
import type { SimState } from '../sim/state.js';
import type { Camera } from '../sim/coords.js';
import type { ConstructionOutput } from '../sim/systems/construction.js';
import type { Refinement } from '../loaders/refinements.js';
import { SIM_TICK_RATE } from '../sim/loop.js';
import { chamferedRectPath, shatterFacetRect, hashStr } from './facet.js';
import { itemsForTab, pageOf, pageCount, type MenuTab, type MenuItem } from './buildMenu.js';
import type { UnitDef } from '../loaders/units.js';
import type { StructureDef } from '../loaders/structures.js';

export interface HUDConfig {
  canvas: HTMLCanvasElement;
  simState: SimState;
  /** The side this screen belongs to (FG-7 multiplayer seats; default 'player'). */
  viewerTeam?: 'player' | 'enemy';
  camera: Camera; // unused in current implementation
  constructionOutput?: ConstructionOutput;
  /** Cursor position (canvas px) for hover highlighting the build buttons. */
  getHover?: () => { sx: number; sy: number } | null;
  /** Harvester cargo capacity (from economyConstants) — the cargo-bar denominator. */
  cargoCapacity?: number;
  /** Live mute state (FG-polish): draws a 🔇 chip by the credits; M toggles. */
  isMuted?: () => boolean;
  /** Faction-adjusted unit price (QA BUG-2) — falls back to the base cost. */
  unitCost?: (base: number) => number;
  /** Structure power demand (QA BUG-4) — >0 + shortfall draws the ⚡ warning. */
  powerDemandOf?: (structureId: string) => number;
  /** XP-3: the viewer's faction id — faction-locked buttons of OTHER factions hide. */
  playerFactionId?: string;
  /** XP-5: live Shardstorm indicator. */
  isStorm?: () => boolean;
  /** Economy depth: the researchable Refinement definitions (for the TECH tab). */
  refinements?: readonly Refinement[];
  /** Phase C1: the sidebar is GENERATED from these, not from a hardcoded list. */
  units?: readonly UnitDef[];
  structures?: readonly StructureDef[];
  /** Whether a prerequisite/producer structure is standing for the viewer's team. */
  hasStructure?: (structureId: string) => boolean;
  /** Whether a refinement's prerequisites + tier gates are satisfied (Phase C2). */
  refinementBlocked?: (r: Refinement) => 'prereq' | 'tier' | 'faction' | null;
}

// HQ upgrade ladder (view-side mirror of construction_yard.tierUpgrades).
const HQ_UPGRADES = [{ toTier: 2, cost: 1000, seconds: 30 }, { toTier: 3, cost: 2000, seconds: 45 }];

/** A build-menu button hit-test result: `"train:infantry"`, `"build:barracks"`, … */
export type BuildAction = string;

// Sidebar geometry — ONE source of truth. `panelRect()` used to report h:380 while
// draw() rendered 574, so the bottom third of the sidebar was outside the renderer's
// edge-scroll dead zone and browsing those buttons dragged the camera.
const PANEL_W = 184;
const PANEL_PAD = 8;
const PANEL_Y = 8;
const PANEL_H = 574;
/** Extra height claimed below the panel for the STORAGE FULL banner. */
const PANEL_FOOTER_H = 26;

/** Why a disabled build button refused the click (v0.52 EVA feedback). */
export type DenyReason = 'funds' | 'tier' | 'prereq' | 'cells' | 'busy';

/** A compact human label for a structure id, for "needs a War Factory" hints. */
function shortLabel(structureId: string): string {
  const WORDS: Record<string, string> = {
    power_node: 'Power', war_factory: 'War Fctry', processing_plant: 'Proc Plant',
    construction_yard: 'Con Yard', barracks_elite: 'Elite Brks', defense_turret: 'Turret',
    tech_lab: 'Tech Lab', aa_turret: 'AA', armor_upgrade_center: 'Armor Ctr',
    machine_shop: 'Mach Shop', heavy_gate: 'Gate',
  };
  return WORDS[structureId] ?? structureId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function makeHUD(cfg: HUDConfig): {
  draw(): void;
  buttonAt(sx: number, sy: number): BuildAction | null;
  anyButtonAt(sx: number, sy: number): BuildAction | null;
  deniedAt(sx: number, sy: number): DenyReason | null;
  panelRect(): { x: number; y: number; w: number; h: number };
  setTab(tab: MenuTab): void;
  /** Scroll a tab's page (RA sidebar arrows). Clamped by the caller's page count. */
  turnPage(tab: MenuTab, dir: 'prev' | 'next'): void;
  rectOf(action: BuildAction): { x: number; y: number; w: number; h: number } | null;
} {
  let activeTab: MenuTab = 'base';
  /** Per-tab scroll position (RA's sidebar arrows). Kept per tab so switching back
   *  to UNITS lands where you left it. */
  const tabPage: Record<MenuTab, number> = { base: 0, def: 0, units: 0, tech: 0 };
  const { canvas, simState } = cfg;
  const viewerTeam = cfg.viewerTeam ?? 'player';
  const cargoCapacity = cfg.cargoCapacity ?? 600;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Use ctx as non-null after the check
  const context = ctx as CanvasRenderingContext2D;

  // HUD colors
  const COLORS = {
    background: 'rgba(0, 0, 0, 0.7)',
    text: '#ffffff',
    highlight: '#4a90e2',
    warning: '#e24a4a',
    success: '#4caf50',
    powerOk: '#4caf50',
    powerLow: '#e24a4a',
  };

  function getHarvester(): { cargo: number; capacity: number } | null {
    for (const e of simState.store.all()) {
      if (e.components.faction?.team === viewerTeam &&
          e.components.faction?.faction === 'harvester' && e.components.harvest) {
        return { cargo: e.components.harvest.cargo || 0, capacity: cargoCapacity };
      }
    }
    return null;
  }

  // The player's economy (never the enemy's — scope by team so affordability is correct).
  function getRefinery(): { credits: number; storage: number; maxStorage: number; cells: number; mined: number } | null {
    // Sum across ALL player refineries (buildable refineries add banks + storage).
    let found = false; let credits = 0, storage = 0, maxStorage = 0, cells = 0, mined = 0;
    for (const e of simState.store.all()) {
      if (e.components.faction?.team === viewerTeam && e.components.building && e.components.economy) {
        found = true;
        credits += e.components.economy.credits || 0;
        storage += e.components.economy.refineryStorage || 0;
        maxStorage += e.components.economy.maxStorage || 0;
        cells += e.components.economy.cells ?? 0;
        mined += e.components.economy.minedTotal ?? 0;
      }
    }
    return found ? { credits, storage, maxStorage, cells, mined } : null;
  }

  function getPowerStatus(): { supply: number; demand: number; powered: boolean } {
    let supply = 0;
    let demand = 0;

    for (const e of simState.store.all()) {
      const power = e.components.power;
      if (power) {
        supply += power.powerSupply;
        demand += power.powerDemand;
      }
    }

    return { supply, demand, powered: supply >= demand };
  }

  // A player producer building's live production state, looked up by its faction id
  // ('barracks' → combat units, 'refinery' → Harvesters). Drives the build-button
  // progress fill + queue count for whichever unit that building makes.
  function getProducer(faction: string): { queue: readonly string[]; progress: number; current: string | null } | null {
    for (const e of simState.store.all()) {
      if (e.components.faction?.team === viewerTeam &&
          e.components.faction?.faction === faction && e.components.production) {
        return {
          queue: e.components.production.queue ?? [],
          progress: e.components.production.progress ?? 0,
          current: e.components.production.current ?? null,
        };
      }
    }
    return null;
  }

  function drawBox(x: number, y: number, width: number, height: number, color: string): void {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  }

  function drawText(text: string, x: number, y: number, color: string = COLORS.text): void {
    context.fillStyle = color;
    context.font = '14px monospace';
    context.textBaseline = 'top';
    context.fillText(text, x, y);
  }

  function drawProgressBar(x: number, y: number, width: number, value: number, max: number, color: string): void {
    const pct = Math.min(1, Math.max(0, value / max));
    const barWidth = Math.floor(width * pct);

    // Background
    context.fillStyle = 'rgba(255, 255, 255, 0.2)';
    context.fillRect(x, y, width, 12);

    // Progress
    context.fillStyle = color;
    context.fillRect(x, y, barWidth, 12);

    // Text
    context.fillStyle = '#ffffff';
    context.font = '12px monospace';
    context.textBaseline = 'top';
    context.fillText(`${Math.floor(value)} / ${max}`, x + 5, y + 1);
  }

  // Baked HUD panel fill (Obsidian Bloom): a fine-scale shatterFacet field baked to
  // an offscreen canvas at UI init / whenever the panel size actually changes —
  // NOT per-frame (RENDER-COST DISCIPLINE). draw() just blits + clips it every frame.
  let panelTexture: HTMLCanvasElement | null = null;
  let panelTextureKey = '';
  function panelFillTexture(w: number, h: number): HTMLCanvasElement {
    const key = `${Math.round(w)}x${Math.round(h)}`;
    if (panelTexture && panelTextureKey === key) return panelTexture;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h));
    const c = cv.getContext('2d') as CanvasRenderingContext2D;
    c.fillStyle = '#0e1015'; c.fillRect(0, 0, cv.width, cv.height);
    shatterFacetRect(c, 0, 0, cv.width, cv.height, {
      seed: hashStr(`hud-panel|${key}`), facetScale: 18, baseColor: '#14161c', valueJitter: 0.10, jitter: 0.4,
    });
    panelTexture = cv; panelTextureKey = key;
    return cv;
  }

  // Chamfered chrome frame (Obsidian Bloom HUD chrome: 45°-cut corners, no
  // rounding, a baked facet fill, a #e8ecf2 chrome-bevel stroke) — replaces the
  // old flat beveled rect panel.
  function drawPanel(x: number, y: number, w: number, h: number): void {
    context.save();
    chamferedRectPath(context, x, y, w, h, 12);
    context.clip();
    context.drawImage(panelFillTexture(w, h), x, y);
    context.fillStyle = 'rgba(6,7,10,0.32)'; // depth wash so text stays legible over the facets
    context.fillRect(x, y, w, h);
    context.restore();
    context.save();
    chamferedRectPath(context, x, y, w, h, 12);
    context.strokeStyle = '#e8ecf2';
    context.lineWidth = 1.25;
    context.globalAlpha = 0.55;
    context.stroke();
    context.restore();
    context.fillStyle = 'rgba(255,255,255,0.08)';   // top highlight
    context.fillRect(x + 12, y + 1, w - 24, 1);
    context.fillStyle = 'rgba(0,0,0,0.35)';          // bottom shadow
    context.fillRect(x + 12, y + h - 2, w - 24, 1);
  }

  // RA's sidebar scroll arrows. Returns the new y cursor. Draws nothing when the tab
  // fits on one page, so short tabs keep their clean look.
  function drawPager(px: number, by: number, bw: number, tab: MenuTab, page: number, pages: number): number {
    if (pages <= 1) return by;
    const h = 20;
    const half = Math.floor((bw - 6) / 2);
    for (const [i, dir] of (['prev', 'next'] as const).entries()) {
      const x = px + 8 + i * (half + 6);
      const canGo = dir === 'prev' ? page > 0 : page < pages - 1;
      rects.push({ action: `page:${tab}:${dir}`, x, y: by, w: half, h, enabled: canGo });
      context.fillStyle = canGo ? 'rgba(0,229,255,0.14)' : 'rgba(60,64,72,0.18)';
      context.fillRect(x, by, half, h);
      context.strokeStyle = canGo ? '#00e5ff' : '#3a4a5a';
      context.strokeRect(x + 0.5, by + 0.5, half - 1, h - 1);
      context.fillStyle = canGo ? '#00e5ff' : '#5c636d';
      context.font = 'bold 11px monospace'; context.textBaseline = 'top';
      context.fillText(dir === 'prev' ? '▲ PREV' : 'NEXT ▼', x + 8, by + 5);
    }
    context.fillStyle = '#8fa3b8'; context.font = '9px monospace';
    context.fillText(`${page + 1}/${pages}`, px + 8 + bw - 22, by + 6);
    return by + h + 4;
  }

  // XP-1: the viewer's HQ tech state (tier + in-flight upgrade) from tech components.
  function getTech(): { tier: number; upgradingTo: number | null; ticksLeft: number } {
    let best: { tier: number; upgradingTo: number | null; ticksLeft: number } | null = null;
    for (const e of simState.store.all()) {
      if (e.components.faction?.team !== viewerTeam || !e.components.tech) continue;
      if (!best || e.components.tech.tier > best.tier) best = e.components.tech;
    }
    return best ?? { tier: 1, upgradingTo: null, ticksLeft: 0 };
  }

  // Clickable C&C-style build button. Records its rect (+ enabled) for hit-testing.
  // `progress` 0-100 = the item currently building (draws a fill); `queued` = how many
  // more of it are waiting.
  const rects: { action: BuildAction; x: number; y: number; w: number; h: number; enabled: boolean; denyReason?: DenyReason }[] = [];
  interface ButtonView { id: string; key: string; name: string; cost: number; kind: 'build' | 'train'; cellCost?: number }
  function drawBuildButton(item: ButtonView, x: number, y: number, w: number, h: number, enabled: boolean, hovered: boolean, progress: number, queued: number, powerWarn = false, denyReason?: DenyReason): void {
    rects.push({ action: `${item.kind}:${item.id}`, x, y, w, h, enabled, denyReason });
    context.fillStyle = !enabled ? 'rgba(70,72,82,0.20)' : hovered ? 'rgba(74,144,226,0.50)' : 'rgba(74,144,226,0.22)';
    context.fillRect(x, y, w, h);
    // Production fill: a green wash sweeping left→right as the unit builds.
    if (progress > 0) {
      context.fillStyle = 'rgba(76,175,80,0.40)';
      context.fillRect(x, y, Math.floor((w * progress) / 100), h);
    }
    context.strokeStyle = !enabled ? '#3a3d46' : (progress > 0 ? COLORS.success : hovered ? '#8fd6ff' : '#4a6a8a');
    context.lineWidth = 1; context.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // hotkey chip
    context.fillStyle = enabled ? COLORS.highlight : '#4a4a52';
    context.fillRect(x + 5, y + 6, 18, 18);
    context.fillStyle = enabled ? '#0e1014' : '#2a2a30';
    context.font = 'bold 13px monospace'; context.textBaseline = 'top';
    context.fillText(item.key, x + 10, y + 9);
    // name + cost
    context.font = '13px monospace';
    context.fillStyle = enabled ? COLORS.text : '#6d6d75';
    context.fillText(item.name, x + 30, y + 9);
    context.font = '12px monospace';
    context.fillStyle = enabled ? '#ffd34a' : '#6d6d75';
    if (powerWarn) {
      // Predictive low-power warning: this build would exceed supply → it will idle
      // until a Power Node goes up. Amber, so the player learns BEFORE spending.
      context.fillStyle = '#ffb04a';
      context.fillText(`⚡◈${item.cost}`, x + w - 52, y + 9);
    } else {
      context.fillText(`◈${item.cost}`, x + w - 44, y + 9);
    }
    // Building/queue badge on the right.
    if (progress > 0) { context.fillStyle = COLORS.success; context.font = 'bold 11px monospace'; context.fillText(`${progress}%`, x + w - 30, y + 9); }
    if (queued > 0) { context.fillStyle = COLORS.text; context.font = 'bold 12px monospace'; context.fillText(`×${queued}`, x + w - 16, y + 9); }
  }

  return {
    // Hit-test the build buttons; returns e.g. "train:infantry" / "build:barracks",
    // or null if (sx,sy) isn't over an enabled button.
    // The sidebar panel's bounds — the renderer treats it as an edge-scroll dead
    // zone (QA: browsing build buttons dragged the camera right).
    panelRect(): { x: number; y: number; w: number; h: number } {
      return {
        x: canvas.width - PANEL_W - PANEL_PAD, y: PANEL_Y,
        w: PANEL_W + PANEL_PAD, h: PANEL_H + PANEL_FOOTER_H,
      };
    },
    setTab(tab: MenuTab): void { activeTab = tab; },
    turnPage(tab: MenuTab, dir: 'prev' | 'next'): void {
      tabPage[tab] = Math.max(0, tabPage[tab] + (dir === 'next' ? 1 : -1));
    },
    rectOf(action: BuildAction): { x: number; y: number; w: number; h: number } | null {
      const r = rects.find(r => r.action === action);
      return r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
    },
    anyButtonAt(sx: number, sy: number): BuildAction | null {
      // Hit-test IGNORING enabled state (v0.55: right-click cancel must land on
      // the disabled in-progress button too).
      for (const r of rects) if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return r.action;
      return null;
    },
    deniedAt(sx: number, sy: number): DenyReason | null {
      // A click on a DISABLED build button (v0.52 EVA feedback): report WHY it
      // was refused so the announcer can say the right line.
      for (const r of rects) if (!r.enabled && sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return r.denyReason ?? 'funds';
      return null;
    },
    buttonAt(sx: number, sy: number): BuildAction | null {
      for (const r of rects) if (r.enabled && sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return r.action;
      return null;
    },
    draw() {
      rects.length = 0; // rebuild the clickable rects each frame
      const harvester = getHarvester();
      const refinery = getRefinery();
      const power = getPowerStatus();
      const credits = refinery ? Math.floor(refinery.credits) : 0;

      // ── Right-edge command panel ────────────────────────────────────────────
      const pw = PANEL_W;
      const px = canvas.width - pw - PANEL_PAD;
      const py = PANEL_Y;
      const ph = PANEL_H; // fits 10 build rows + repair row + footer
      drawPanel(px, py, pw, ph);

      // Title bar.
      drawBox(px + 1, py + 1, pw - 2, 20, 'rgba(74,144,226,0.35)');
      context.fillStyle = COLORS.text;
      context.font = 'bold 13px monospace';
      context.textBaseline = 'top';
      context.fillText('COMMAND', px + 10, py + 5);

      // Credits (large).
      context.fillStyle = '#ffd34a';
      context.font = 'bold 20px monospace';
      context.fillText(`◈ ${credits}`, px + 10, py + 28);

      // Sine-pulsed amber divider (Obsidian Bloom HUD chrome): a thin glowing rule
      // under the resource readout, contextual amber — the ONE new pulse element,
      // reusing the legacy #ffcf4a token untouched elsewhere in this file.
      {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 900);
        context.save();
        context.strokeStyle = '#ffcf4a';
        context.globalAlpha = 0.35 + pulse * 0.35;
        context.shadowColor = '#ffcf4a';
        context.shadowBlur = 3 + pulse * 3;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(px + 8, py + 42);
        context.lineTo(px + pw - 8, py + 42);
        context.stroke();
        context.restore();
      }
      // Cells (XP-2): the elite-systems charges.
      context.fillStyle = '#7dd3fc';
      context.font = 'bold 13px monospace';
      context.fillText(`⬡ ${refinery?.cells ?? 0}`, px + 128, py + 33);
      // Resonance (XP-2): how hard the planet is watching YOU (fills per 3000 mined).
      const resPct = Math.min(1, ((refinery?.mined ?? 0) % 3000) / 3000);
      context.fillStyle = 'rgba(201,166,255,0.25)';
      context.fillRect(px + 10, py + 50, 106, 3);
      context.fillStyle = '#c9a6ff';
      context.fillRect(px + 10, py + 50, Math.floor(106 * resPct), 3);
      // Shardstorm chip (XP-5).
      if (cfg.isStorm?.()) {
        context.fillStyle = '#c9a6ff'; context.font = 'bold 11px monospace';
        context.fillText('⛈ STORM', px + 122, py + 46);
      }

      // Power lamp.
      const powerColor = power.powered ? COLORS.powerOk : COLORS.powerLow;
      context.fillStyle = powerColor;
      context.beginPath();
      context.arc(px + 16, py + 62, 5, 0, Math.PI * 2);
      context.fill();
      drawText(`POWER ${power.powered ? 'OK' : 'LOW'}  ${power.supply}/${power.demand}`, px + 28, py + 56, powerColor);

      // Cargo + storage bars.
      if (harvester) {
        drawText('Cargo', px + 10, py + 78);
        drawProgressBar(px + 60, py + 76, 106, harvester.cargo, harvester.capacity,
          harvester.cargo >= harvester.capacity ? COLORS.warning : COLORS.success);
      }
      if (refinery) {
        drawText('Store', px + 10, py + 98);
        drawProgressBar(px + 60, py + 96, 106, refinery.storage, refinery.maxStorage,
          refinery.storage >= refinery.maxStorage ? COLORS.warning : COLORS.success);
      }

      // Build menu (XP-1): two tabs — STRUCT / UNITS — + the HQ upgrade row.
      const hover = cfg.getHover?.() ?? null;
      const tech = getTech();
      const bw = pw - 16;
      // Tab row (4 tabs: BASE / DEF / UNITS / TECH).
      const tabY = py + 118, tabH = 22, tabW = Math.floor(bw / 4) - 3;
      const TAB_LABEL: Record<string, string> = { base: 'BASE', def: 'DEF', units: 'UNITS', tech: 'TECH' };
      for (const [i, tab] of (['base', 'def', 'units', 'tech'] as const).entries()) {
        const tx0 = px + 8 + i * (tabW + 4);
        const active = activeTab === tab;
        rects.push({ action: `tab:${tab}`, x: tx0, y: tabY, w: tabW, h: tabH, enabled: true });
        context.fillStyle = active ? 'rgba(0,229,255,0.18)' : 'rgba(20,26,34,0.9)';
        context.fillRect(tx0, tabY, tabW, tabH);
        if (active) {
          // Sine-pulsed faction-glow divider under the active tab (contextual glow).
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 700);
          context.save();
          context.strokeStyle = '#00e5ff';
          context.shadowColor = '#00e5ff';
          context.shadowBlur = 2 + pulse * 4;
          context.lineWidth = 1.5;
          context.beginPath();
          context.moveTo(tx0 + 2, tabY + tabH - 1);
          context.lineTo(tx0 + tabW - 2, tabY + tabH - 1);
          context.stroke();
          context.restore();
        }
        context.strokeStyle = active ? '#00e5ff' : '#3a4a5a';
        context.strokeRect(tx0 + 0.5, tabY + 0.5, tabW - 1, tabH - 1);
        context.fillStyle = active ? '#00e5ff' : '#8fa3b8';
        context.font = 'bold 10px monospace'; context.textBaseline = 'top';
        context.fillText(TAB_LABEL[tab]!, tx0 + 8, tabY + 6);
      }
      let by = py + 146;
      // HQ tier row (STRUCT tab): tier readout + the upgrade button.
      if (activeTab === 'base') {
        const step = HQ_UPGRADES.find(u => u.toTier === tech.tier + 1);
        const upgrading = tech.upgradingTo != null;
        const label = upgrading ? `⬆ UPGRADING… T${tech.upgradingTo}`
          : step ? `⬆ HQ TIER ${step.toTier}` : 'HQ AT MAX TIER';
        const cost = step?.cost ?? 0;
        const enabled = !upgrading && !!step && credits >= cost;
        rects.push({ action: 'upgrade:hq', x: px + 8, y: by, w: bw, h: 30, enabled });
        // Progress fill while upgrading.
        if (upgrading && step) {
          const total = (HQ_UPGRADES.find(u => u.toTier === tech.upgradingTo)?.seconds ?? 30) * 20;
          const pct = Math.max(0, Math.min(1, 1 - tech.ticksLeft / total));
          context.fillStyle = 'rgba(0,229,255,0.25)';
          context.fillRect(px + 8, by, Math.floor(bw * pct), 30);
        }
        context.strokeStyle = enabled ? '#ffd34d' : '#3a4a5a';
        context.strokeRect(px + 8.5, by + 0.5, bw - 1, 29);
        context.fillStyle = enabled ? '#ffd34d' : (upgrading ? '#00e5ff' : '#68727e');
        context.font = 'bold 12px monospace'; context.textBaseline = 'top';
        context.fillText(`${label}  T${tech.tier}`, px + 14, by + 4);
        if (step && !upgrading) { context.font = '11px monospace'; context.fillText(`◈${cost}`, px + bw - 36, by + 4); }
        by += 34;
      }
      const fid = cfg.playerFactionId ?? 'concord';
      // TECH tab (economy depth): team-wide Refinements researched at a Processing
      // Plant. PAGED — 13 refinements at 38px overflowed the panel by ~60px and the
      // last entries were unclickable. Prerequisite/tier gates are now REFLECTED here:
      // command.ts always enforced them, so those buttons looked enabled and then
      // silently did nothing when clicked.
      if (activeTab === 'tech') {
        const refs = cfg.refinements ?? [];
        const led = simState.refinements.get(viewerTeam);
        const done = led?.done ?? [];
        const researching = led?.researching ?? null;
        const busy = researching != null;
        const hasPlant = [...simState.store.all()].some(e =>
          e.components.faction?.team === viewerTeam &&
          e.components.faction?.faction === 'processing_plant' &&
          (e.components.health?.hp ?? 1) > 0);
        const perPage = 8;
        const totalPages = Math.max(1, Math.ceil(refs.length / perPage));
        if (tabPage.tech >= totalPages) tabPage.tech = 0;
        const shown = refs.slice(tabPage.tech * perPage, tabPage.tech * perPage + perPage);
        for (const r of shown) {
          const isDone = done.includes(r.id);
          const isNow = researching === r.id;
          const affordable = credits >= r.cost && (refinery?.cells ?? 0) >= (r.cells ?? 0);
          const blocked = cfg.refinementBlocked?.(r) ?? null;
          const enabled = !isDone && !busy && affordable && hasPlant && !blocked;
          rects.push({
            action: `research:${r.id}`, x: px + 8, y: by, w: bw, h: 34, enabled,
            denyReason: enabled || isDone ? undefined
              : blocked === 'tier' ? 'tier' : blocked ? 'prereq'
                : busy ? 'busy' : !hasPlant ? 'prereq' : !affordable ? 'funds' : 'prereq',
          });
          if (isNow && led) {
            const total = Math.max(1, Math.round(r.timeSeconds * SIM_TICK_RATE));
            const pct = Math.max(0, Math.min(1, 1 - led.ticksLeft / total));
            context.fillStyle = 'rgba(0,229,255,0.22)'; context.fillRect(px + 8, by, Math.floor(bw * pct), 34);
          } else if (isDone) {
            context.fillStyle = 'rgba(80,200,120,0.14)'; context.fillRect(px + 8, by, bw, 34);
          }
          context.strokeStyle = isDone ? '#4fc27a' : isNow ? '#00e5ff' : enabled ? '#ffd34d' : '#3a4a5a';
          context.strokeRect(px + 8.5, by + 0.5, bw - 1, 33);
          context.fillStyle = isDone ? '#4fc27a' : isNow ? '#00e5ff' : enabled ? '#e6edf3' : '#68727e';
          context.font = 'bold 11px monospace'; context.textBaseline = 'top';
          context.fillText(`${isDone ? '✓ ' : ''}${r.name}`.slice(0, 22), px + 14, by + 5);
          const pct = `${Math.round(r.value * 100)}%`;
          const hint = r.effect === 'harvest' ? `+${pct} harvest` : r.effect === 'damage' ? `+${pct} damage`
            : r.effect === 'armor' ? `-${pct} dmg taken` : r.effect === 'range' ? `+${pct} range`
              : r.effect === 'firepower' ? `+${pct} rate of fire` : r.effect === 'buildTime' ? `-${pct} build time`
                : `-${pct} planet aggro`;
          context.font = '9px monospace';
          if (isDone) { context.fillStyle = '#4fc27a'; context.fillText(`RESEARCHED · ${hint}`, px + 14, by + 20); }
          else if (isNow) { context.fillStyle = '#00e5ff'; context.fillText('RESEARCHING…', px + 14, by + 20); }
          else if (blocked) {
            // Teach WHY it is grey instead of silently swallowing the click.
            context.fillStyle = '#c9a24a';
            context.fillText(blocked === 'tier' ? 'needs War Factory + Tech Lab'
              : blocked === 'faction' ? 'other faction only' : 'needs an earlier refinement', px + 14, by + 20);
          } else {
            context.fillStyle = affordable ? '#ffd34d' : '#a04a4a';
            context.fillText(`◈${r.cost}${r.cells ? ` ⬡${r.cells}` : ''}`, px + 14, by + 20);
            context.fillStyle = '#8fa3b8';
            context.fillText(hint, px + 92, by + 20);
          }
          by += 38;
        }
        by = drawPager(px, by, bw, 'tech', tabPage.tech, totalPages);
        context.font = '9px monospace'; context.fillStyle = '#68727e';
        context.fillText(busy ? 'one refinement at a time' : hasPlant ? 'permanent, team-wide' : 'needs a Processing Plant', px + 14, by + 2);
      }
      // ── Build rows, GENERATED FROM DATA (Phase C1) ──────────────────────────
      // Was three hardcoded literal arrays that reached 11 of 24 units and 14 of 25
      // structures — every other authored unit/structure (both faction heroes, the
      // Tech Lab, both superweapons) was unclickable. Paged, because 23 producible
      // units cannot fit a fixed 9-row panel.
      const allItems: MenuItem[] = activeTab === 'tech' ? []
        : itemsForTab(activeTab as MenuTab, cfg.units ?? [], cfg.structures ?? [], fid);
      const totalPages = pageCount(allItems);
      if (tabPage[activeTab] >= totalPages) tabPage[activeTab] = 0;
      const menu = activeTab === 'tech' ? [] : pageOf(allItems, tabPage[activeTab]);
      const standing = (id: string): boolean => cfg.hasStructure?.(id) ?? false;
      for (const item of menu) {
        // Producer comes from DATA (`units[].producedBy`) — the same field the sim
        // uses to accept or refuse the queue entry, so the button can never promise
        // something production will drop.
        const producer = item.kind === 'train' && item.producedBy ? getProducer(item.producedBy) : null;
        // Prereq: units need their producer standing; structures need every
        // `prerequisites` entry standing.
        const missing = item.requires.filter(r => !standing(r));
        const prereqMet = item.kind === 'train' ? !!producer : missing.length === 0;
        const shownCost = item.kind === 'train' ? (cfg.unitCost?.(item.cost) ?? item.cost) : item.cost;
        const itemDemand = item.kind === 'build' ? (cfg.powerDemandOf?.(item.id) ?? 0) : 0;
        const powerWarn = itemDemand > 0 && power.supply < power.demand + itemDemand;
        const tierOk = item.tier <= tech.tier;
        const cellsOk = item.cellCost <= (refinery?.cells ?? 0);
        const job = item.kind === 'build' ? simState.structureBuild.get(viewerTeam) : undefined;
        const jobMine = !!job && job.structureId === item.id;
        const jobReady = jobMine && job.ticksLeft <= 0;
        const busyOther = item.kind === 'build' && !!job && !jobMine;
        const enabled = jobReady || (credits >= shownCost && prereqMet && tierOk && cellsOk && !busyOther && !jobMine);
        const hovered = !!hover && hover.sx >= px + 8 && hover.sx <= px + 8 + bw && hover.sy >= by && hover.sy <= by + 30;
        const progress = jobMine && !jobReady && job ? Math.round((1 - job.ticksLeft / job.totalTicks) * 100)
          : producer?.current === item.id ? (producer?.progress ?? 0) : 0;
        const queued = producer ? producer.queue.filter(q => q === item.id).length : 0;
        const denyReason: DenyReason | undefined = enabled ? undefined
          : (busyOther || (jobMine && !jobReady)) ? 'busy'
            : !tierOk ? 'tier' : !prereqMet ? 'prereq' : !cellsOk ? 'cells' : 'funds';
        drawBuildButton(
          { id: item.id, key: item.hotkey, name: item.name, cost: shownCost, kind: item.kind, cellCost: item.cellCost },
          px + 8, by, bw, 30, enabled, hovered, progress, queued, powerWarn, denyReason);
        if (jobReady) {
          const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 180);
          context.fillStyle = `rgba(255, 231, 122, ${pulse.toFixed(3)})`;
          context.font = 'bold 13px monospace';
          context.textBaseline = 'top';
          context.fillText('READY — click to place', px + 20, by + 8);
        } else if (!tierOk) {
          context.fillStyle = '#c9a24a'; context.font = 'bold 10px monospace';
          context.fillText(`T${item.tier}`, px + 8 + bw - 70, by + 4);
        } else if (!prereqMet) {
          // Name the MISSING building instead of just greying out — this is the
          // difference between a discoverable tech tree and a wall of dead buttons.
          const need = item.kind === 'train' ? item.producedBy ?? '' : missing[0] ?? '';
          context.fillStyle = '#c9a24a'; context.font = '9px monospace';
          context.fillText(`needs ${shortLabel(need)}`.slice(0, 20), px + 8 + bw - 96, by + 19);
        }
        if (item.cellCost) {
          context.fillStyle = cellsOk ? '#7dd3fc' : '#e24a4a'; context.font = 'bold 10px monospace';
          context.fillText(`⬡${item.cellCost}`, px + 8 + bw - 70, by + 16);
        }
        by += 34;
      }
      if (activeTab !== 'tech') by = drawPager(px, by, bw, activeTab, tabPage[activeTab], totalPages);

      // ── Superweapon charge rows (Phase C3) ──────────────────────────────────
      // One row per standing superweapon: a charge bar while it recharges, a pulsing
      // FIRE button when ready. Before this the Ion Cannon was buildable scenery.
      for (const sw of (cfg.structures ?? [])) {
        if (!sw.superweapon) continue;
        const charge = simState.superweapons.get(`${viewerTeam}:${sw.id}`);
        if (!charge) continue; // not standing
        const ready = charge.ticksLeft <= 0;
        rects.push({ action: `superweapon:${sw.id}`, x: px + 8, y: by, w: bw, h: 28, enabled: ready, denyReason: 'busy' });
        const pct = 1 - Math.max(0, charge.ticksLeft) / Math.max(1, charge.totalTicks);
        context.fillStyle = ready ? 'rgba(255,120,80,0.35)' : 'rgba(0,229,255,0.16)';
        context.fillRect(px + 8, by, Math.floor(bw * (ready ? 1 : pct)), 28);
        context.strokeStyle = ready ? '#ff8a5c' : '#3a4a5a';
        context.strokeRect(px + 8.5, by + 0.5, bw - 1, 27);
        context.font = 'bold 11px monospace'; context.textBaseline = 'top';
        if (ready) {
          const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);
          context.fillStyle = `rgba(255,220,180,${pulse.toFixed(3)})`;
          context.fillText(`☢ ${sw.superweapon.label} — FIRE`, px + 14, by + 8);
        } else {
          context.fillStyle = '#8fd6ff';
          const secs = Math.ceil(charge.ticksLeft / SIM_TICK_RATE);
          context.fillText(`☢ ${sw.superweapon.label}  ${secs}s`, px + 14, by + 8);
        }
        by += 32;
      }

      // ── Faction Strike row (XP-7) ───────────────────────────────────────────
      // The old hardcoded DEF menu carried a "☄ STRIKE" button; the data-driven
      // rewrite dropped it. Restored as an action row: T3 + 5 Cells arms a
      // 3s-telegraphed orbital splash at the next clicked point (command.ts is
      // unchanged — it always kept the intent).
      if (tech.tier >= 3) {
        const cellsHave = refinery?.cells ?? 0;
        const canFire = cellsHave >= 5;
        rects.push({ action: 'strike:arm', x: px + 8, y: by, w: bw, h: 26, enabled: canFire, denyReason: 'cells' });
        context.fillStyle = canFire ? 'rgba(201,166,255,0.28)' : 'rgba(70,72,82,0.20)';
        context.fillRect(px + 8, by, bw, 26);
        context.strokeStyle = canFire ? '#c9a6ff' : '#3a4a5a';
        context.strokeRect(px + 8.5, by + 0.5, bw - 1, 25);
        context.fillStyle = canFire ? '#e8dcff' : '#6d6d75';
        context.font = 'bold 12px monospace'; context.textBaseline = 'top';
        context.fillText(`☄ FACTION STRIKE  ⬡5`, px + 16, by + 6);
        by += 30;
      }

      // Repair button (FG-2): shown while a damaged player building is selected.
      let repairTarget: { repairing: boolean } | null = null;
      for (const e of simState.store.all()) {
        if (!e.components.selection?.selected) continue;
        if (e.components.faction?.team !== 'player') continue;
        const b = e.components.building; const h = e.components.health;
        if (b && h && h.hp < h.maxHp) { repairTarget = { repairing: !!b.repairing }; break; }
      }
      if (repairTarget) {
        const active = repairTarget.repairing;
        rects.push({ action: 'repair:toggle', x: px + 8, y: by, w: bw, h: 26, enabled: true });
        context.fillStyle = active ? 'rgba(76,175,80,0.45)' : 'rgba(226,178,74,0.30)';
        context.fillRect(px + 8, by, bw, 26);
        context.strokeStyle = active ? COLORS.success : '#c9a24a';
        context.strokeRect(px + 8.5, by + 0.5, bw - 1, 25);
        context.fillStyle = '#ffe9b0';
        context.font = 'bold 12px monospace'; context.textBaseline = 'top';
        context.fillText(active ? '🔧 REPAIRING…  (click to stop)' : '🔧 REPAIR  (drains credits)', px + 16, by + 7);
        by += 30;
      }

      // Sell button (v0.52, Westwood convention): shown while any own COMPLETED
      // building is selected — demolish for a 50% refund (the last-ditch classic).
      let sellTarget = false;
      for (const e of simState.store.all()) {
        if (!e.components.selection?.selected) continue;
        if (e.components.faction?.team !== viewerTeam) continue;
        const b = e.components.building;
        if (b && (b.buildProgress ?? 100) >= 100) { sellTarget = true; break; }
      }
      if (sellTarget) {
        rects.push({ action: 'sell:selected', x: px + 8, y: by, w: bw, h: 26, enabled: true });
        context.fillStyle = 'rgba(226,74,74,0.28)';
        context.fillRect(px + 8, by, bw, 26);
        context.strokeStyle = '#e24a4a';
        context.strokeRect(px + 8.5, by + 0.5, bw - 1, 25);
        context.fillStyle = '#ffc9c9';
        context.font = 'bold 12px monospace'; context.textBaseline = 'top';
        context.fillText('$ SELL  (50% refund, demolishes)', px + 16, by + 7);
      }

      // Legend (footer).
      context.fillStyle = '#8894a4';
      context.font = '10px monospace';
      // Short lines only — longer ones clip at the panel edge (playtest v0.53).
      context.fillText('L select · R order · S stop', px + 10, py + ph - 66);
      context.fillText('A atkmove · Shift queue', px + 10, py + ph - 54);
      context.fillText('Q army · I idle · O hero', px + 10, py + ph - 42);
      context.fillText('Ctrl+1-9 group · ×2 centre', px + 10, py + ph - 30);
      context.fillText('X stance · U unload · P pause', px + 10, py + ph - 18);

      // Overflow warning (below panel, hard to miss).
      if (refinery && refinery.storage >= refinery.maxStorage) {
        drawBox(px, py + ph + 4, pw, 20, 'rgba(226,74,74,0.8)');
        drawText('STORAGE FULL', px + 10, py + ph + 8, '#ffffff');
      }
    },
  };
}
