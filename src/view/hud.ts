// ── HUD: credits + cargo + storage + build queue + power readout ────────────────
// Renders economy and build queue HUD on top of the game canvas.
import type { SimState } from '../sim/state.js';
import type { Camera } from '../sim/coords.js';
import type { ConstructionOutput } from '../sim/systems/construction.js';

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
}

/** The C&C-style sidebar build menu. `kind` decides the click action:
 *  train → queue a unit at the barracks; build → enter placement mode. */
interface BuildItem { id: string; key: string; name: string; cost: number; kind: 'train' | 'build'; tier?: number; cellCost?: number; factionLock?: string }
// Split across two tabs (XP-1) — [S]TRUCTURES and [U]NITS — so the roster can grow.
// `tier` mirrors data/{structures,units}.json (view-side copy, like cost).
const BASE_MENU: readonly BuildItem[] = [
  { id: 'barracks', key: 'B', name: 'Barracks', cost: 300, kind: 'build' },
  { id: 'power_node', key: 'N', name: 'Power', cost: 400, kind: 'build' },
  { id: 'refinery', key: 'F', name: 'Refinery', cost: 1200, kind: 'build' },
  { id: 'radar', key: 'J', name: 'Radar', cost: 600, kind: 'build', tier: 2 },
  { id: 'processing_plant', key: 'K', name: 'Proc Plant', cost: 800, kind: 'build', tier: 2 },
  { id: 'war_factory', key: 'W', name: 'War Fctry', cost: 1000, kind: 'build', tier: 2 },
  { id: 'skypad', key: '', name: 'Skypad', cost: 600, kind: 'build', tier: 2 },
];
const DEF_MENU: readonly BuildItem[] = [
  { id: 'defense_turret', key: 'G', name: 'Turret', cost: 550, kind: 'build' },
  { id: 'aa_turret', key: '', name: 'AA Turret', cost: 500, kind: 'build' },
  { id: 'wall', key: 'L', name: 'Wall', cost: 50, kind: 'build' },
  { id: 'gate', key: '', name: 'Gate', cost: 100, kind: 'build' },
  { id: 'bunker', key: '', name: 'Bunker', cost: 450, kind: 'build' },
  { id: 'infirmary', key: '', name: 'Infirmary', cost: 500, kind: 'build' },
  { id: 'machine_shop', key: '', name: 'Mach Shop', cost: 600, kind: 'build', tier: 2 },
  { id: 'hq', key: '', name: '☄ STRIKE', cost: 0, kind: 'build', tier: 3, cellCost: 5 },
];
const UNIT_MENU: readonly BuildItem[] = [
  { id: 'infantry', key: 'T', name: 'Infantry', cost: 100, kind: 'train' },
  { id: 'rocket_trooper', key: 'R', name: 'Rocket', cost: 200, kind: 'train' },
  { id: 'harvester', key: 'H', name: 'Harvester', cost: 400, kind: 'train' },
  { id: 'scout_vehicle', key: 'V', name: 'Scout', cost: 350, kind: 'train', tier: 2 },
  { id: 'assault_tank', key: 'C', name: 'Tank', cost: 700, kind: 'train', tier: 2 },
  { id: 'longbow', key: '', name: 'Longbow', cost: 900, kind: 'train', tier: 2 },
  { id: 'skimmer_apc', key: '', name: 'APC', cost: 500, kind: 'train', tier: 2 },
  { id: 'gunship', key: '', name: 'Gunship', cost: 900, kind: 'train', tier: 2 },
  { id: 'warden', key: 'E', name: 'Warden ★', cost: 800, kind: 'train', cellCost: 2, factionLock: 'concord' },
  { id: 'ghostwalker', key: '', name: 'Ghostwalkr', cost: 350, kind: 'train', tier: 2, factionLock: 'emberhand' },
  { id: 'vane', key: 'E', name: 'Vane ★', cost: 800, kind: 'train', cellCost: 2, factionLock: 'emberhand' },
];
// HQ upgrade ladder (view-side mirror of construction_yard.tierUpgrades).
const HQ_UPGRADES = [{ toTier: 2, cost: 1000, seconds: 30 }, { toTier: 3, cost: 2000, seconds: 45 }];

/** A build-menu button hit-test result: `"train:infantry"`, `"build:barracks"`, … */
export type BuildAction = string;

export function makeHUD(cfg: HUDConfig): {
  draw(): void;
  buttonAt(sx: number, sy: number): BuildAction | null;
  panelRect(): { x: number; y: number; w: number; h: number };
  setTab(tab: 'base' | 'def' | 'units'): void;
  rectOf(action: BuildAction): { x: number; y: number; w: number; h: number } | null;
} {
  let activeTab: 'base' | 'def' | 'units' = 'base';
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

  // Beveled panel frame (Westwood command-bar look: dark fill, light top edge, dark base).
  function drawPanel(x: number, y: number, w: number, h: number): void {
    context.fillStyle = 'rgba(14,16,20,0.88)';
    context.fillRect(x, y, w, h);
    context.strokeStyle = '#5a6472';
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    context.fillStyle = 'rgba(255,255,255,0.10)';   // top highlight
    context.fillRect(x + 1, y + 1, w - 2, 1);
    context.fillStyle = 'rgba(0,0,0,0.35)';          // bottom shadow
    context.fillRect(x + 1, y + h - 2, w - 2, 1);
  }

  function hasBarracks(): boolean {
    for (const e of simState.store.all())
      if (e.components.faction?.team === viewerTeam && e.components.faction?.faction === 'barracks') return true;
    return false;
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
  function hasWarFactory(): boolean {
    for (const e of simState.store.all())
      if (e.components.faction?.team === viewerTeam && e.components.faction?.faction === 'war_factory') return true;
    return false;
  }

  // Clickable C&C-style build button. Records its rect (+ enabled) for hit-testing.
  // `progress` 0-100 = the item currently building (draws a fill); `queued` = how many
  // more of it are waiting.
  const rects: { action: BuildAction; x: number; y: number; w: number; h: number; enabled: boolean }[] = [];
  function drawBuildButton(item: BuildItem, x: number, y: number, w: number, h: number, enabled: boolean, hovered: boolean, progress: number, queued: number, powerWarn = false): void {
    rects.push({ action: `${item.kind}:${item.id}`, x, y, w, h, enabled });
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
      return { x: canvas.width - 184 - 8, y: 8, w: 184 + 8, h: 380 };
    },
    setTab(tab: 'base' | 'def' | 'units'): void { activeTab = tab; },
    rectOf(action: BuildAction): { x: number; y: number; w: number; h: number } | null {
      const r = rects.find(r => r.action === action);
      return r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
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
      const barracks = getProducer('barracks');       // trains infantry / rocket
      const refineryProd = getProducer('refinery');    // builds harvesters
      const credits = refinery ? Math.floor(refinery.credits) : 0;

      // ── Right-edge command panel ────────────────────────────────────────────
      const pw = 184;
      const px = canvas.width - pw - 8;
      const py = 8;
      const ph = 574; // fits 10 build rows + repair row + footer
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
        context.fillText('⛈ SHARDSTORM', px + 120, py + 46);
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
      const barracksUp = hasBarracks();
      const factoryUp = hasWarFactory();
      const warFactoryProd = getProducer('war_factory');
      const isVehicle = (id: string): boolean => id === 'scout_vehicle' || id === 'assault_tank' || id === 'longbow' || id === 'skimmer_apc';
      const tech = getTech();
      const bw = pw - 16;
      // Tab row.
      const tabY = py + 118, tabH = 22, tabW = Math.floor(bw / 3) - 3;
      for (const [i, tab] of (['base', 'def', 'units'] as const).entries()) {
        const tx0 = px + 8 + i * (tabW + 4);
        const active = activeTab === tab;
        rects.push({ action: `tab:${tab}`, x: tx0, y: tabY, w: tabW, h: tabH, enabled: true });
        context.fillStyle = active ? 'rgba(0,229,255,0.18)' : 'rgba(20,26,34,0.9)';
        context.fillRect(tx0, tabY, tabW, tabH);
        context.strokeStyle = active ? '#00e5ff' : '#3a4a5a';
        context.strokeRect(tx0 + 0.5, tabY + 0.5, tabW - 1, tabH - 1);
        context.fillStyle = active ? '#00e5ff' : '#8fa3b8';
        context.font = 'bold 10px monospace'; context.textBaseline = 'top';
        context.fillText(tab === 'base' ? 'BASE' : tab === 'def' ? 'DEF' : 'UNITS', tx0 + 12, tabY + 6);
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
      const menu = (activeTab === 'base' ? BASE_MENU : activeTab === 'def' ? DEF_MENU : UNIT_MENU)
        .filter(i => !i.factionLock || i.factionLock === fid); // XP-3 asymmetric rosters
      for (const item of menu) {
        // Which building makes this item? Harvester ← Refinery, vehicles ← War
        // Factory (FG-3), foot troops ← Barracks; structures are placed (no producer).
        const skypadProd = getProducer('skypad');
        const producer = item.kind !== 'train' ? null
          : (item.id === 'harvester' ? refineryProd : item.id === 'gunship' ? skypadProd : isVehicle(item.id) ? warFactoryProd : barracks);
        // Prereq: harvester needs a Refinery (always present), vehicles a War
        // Factory, foot troops a Barracks; builds just need credits.
        const prereqMet = item.kind === 'build' ? true
          : (item.id === 'harvester' ? !!refineryProd : item.id === 'gunship' ? !!skypadProd : isVehicle(item.id) ? factoryUp : barracksUp);
        // Faction pricing (QA BUG-2): the label + affordability use the SAME adjusted
        // price the production system charges (Emberhand 0.8×, Shardborn 1.15×, …).
        const shownCost = item.kind === 'train' ? (cfg.unitCost?.(item.cost) ?? item.cost) : item.cost;
        // Predictive power warning (QA BUG-4): building this would exceed supply.
        const itemDemand = item.kind === 'build' ? (cfg.powerDemandOf?.(item.id) ?? 0) : 0;
        const powerWarn = itemDemand > 0 && power.supply < power.demand + itemDemand;
        const tierOk = (item.tier ?? 1) <= tech.tier;
        const cellsOk = (item.cellCost ?? 0) <= (refinery?.cells ?? 0);
        const enabled = credits >= shownCost && prereqMet && tierOk && cellsOk;
        const hovered = !!hover && hover.sx >= px + 8 && hover.sx <= px + 8 + bw && hover.sy >= by && hover.sy <= by + 30;
        const progress = producer?.current === item.id ? (producer?.progress ?? 0) : 0;
        const queued = producer ? producer.queue.filter(q => q === item.id).length : 0;
        drawBuildButton({ ...item, cost: shownCost }, px + 8, by, bw, 30, enabled, hovered, progress, queued, powerWarn);
        if (!tierOk) { // tier chip: teaches WHY it's grey (XP-1)
          context.fillStyle = '#c9a24a'; context.font = 'bold 10px monospace';
          context.fillText(`T${item.tier}`, px + 8 + bw - 70, by + 4);
        }
        if (item.cellCost) { // cell price chip (XP-2)
          context.fillStyle = cellsOk ? '#7dd3fc' : '#e24a4a'; context.font = 'bold 10px monospace';
          context.fillText(`⬡${item.cellCost}`, px + 8 + bw - 70, by + 16);
        }
        by += 34;
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
      }

      // Legend (footer).
      context.fillStyle = '#8894a4';
      context.font = '10px monospace';
      context.fillText('L-click select · R-click move/attack/mine', px + 10, py + ph - 42);
      context.fillText('A atk-move · S stop · E hero · dblclick=type', px + 10, py + ph - 30);
      context.fillText('X stance · U unload · P pause · M mute', px + 10, py + ph - 18);

      // Overflow warning (below panel, hard to miss).
      if (refinery && refinery.storage >= refinery.maxStorage) {
        drawBox(px, py + ph + 4, pw, 20, 'rgba(226,74,74,0.8)');
        drawText('STORAGE FULL', px + 10, py + ph + 8, '#ffffff');
      }
    },
  };
}
