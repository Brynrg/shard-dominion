// ── Factions (FG-6): per-side identity as DATA modifiers + a view palette ───────
// Placeholder-first per the locked plan decision: every faction ships as stat
// modifiers over the shared unit roster + a palette/stripe for the procedural
// chassis — painted per-faction art swaps in later with no code change.
//
// Applied at the three spawn sites (seedMission, production, trigger spawns) and
// at production PAYMENT time, so a faction plays differently everywhere units come
// from. Deterministic: plain multipliers, rounded once.
export type FactionId = 'concord' | 'emberhand' | 'shardborn';

export interface FactionMods {
  id: FactionId;
  name: string;
  costMult: number;   // production price
  hpMult: number;     // spawn hp
  speedMult: number;  // spawn speed
  /** View palette (renderer team style override). */
  palette: { hull: string; hullDark: string; accent: string; stripe: string };
  /** XP-2 Emberhand identity: ANY unit reclaims wrecks by touch (others: harvesters only). */
  salvageAll?: boolean;
}

export const FACTIONS: Record<FactionId, FactionMods> = {
  // The baseline coalition military: disciplined, standard-issue everything.
  concord: {
    id: 'concord',
    name: 'Meridian Concord',
    costMult: 1, hpMult: 1, speedMult: 1,
    palette: { hull: '#3d7fd6', hullDark: '#28568f', accent: '#a7d6ff', stripe: '#00e5ff' },
  },
  // The raider insurgency: cheap, fast, fragile — swarm and slash.
  emberhand: {
    id: 'emberhand',
    name: 'The Emberhand',
    costMult: 0.8, hpMult: 0.85, speedMult: 1.15, salvageAll: true,
    palette: { hull: '#d1503a', hullDark: '#8f3020', accent: '#ffb08f', stripe: '#ff4a3d' },
  },
  // The planet's chosen: tough, slow, expensive — living crystal (FG-6b preview).
  shardborn: {
    id: 'shardborn',
    name: 'The Shardborn',
    costMult: 1.15, hpMult: 1.25, speedMult: 0.85,
    palette: { hull: '#7d5fae', hullDark: '#54407a', accent: '#d9c2ff', stripe: '#c9a6ff' },
  },
};

export function factionOf(id: string | null | undefined): FactionMods {
  return FACTIONS[(id ?? 'concord') as FactionId] ?? FACTIONS.concord;
}

/** Stat application helpers (round once — determinism-friendly integers). */
export function modCost(base: number, f: FactionMods): number { return Math.round(base * f.costMult); }
export function modHp(base: number, f: FactionMods): number { return Math.max(1, Math.round(base * f.hpMult)); }
export function modSpeed(base: number, f: FactionMods): number { return Math.max(1, Math.round(base * f.speedMult)); }

/** Per-team faction assignment for a match (sim systems look mods up by team). */
export interface TeamFactions { player: FactionMods; enemy: FactionMods }
export function makeTeamFactions(player?: string | null, enemy?: string | null): TeamFactions {
  return { player: factionOf(player), enemy: factionOf(enemy) };
}
