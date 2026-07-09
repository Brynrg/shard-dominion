// ── CONTRACT: the combat type space ──────────────────────────────────────────
// The damage model is `damage = weapon.damage × matrix[weaponType][armorClass]`.
// These two ordered tuples ARE the RPS surface; the data loader proves the
// matrix is complete over their cross product. Lives in src/sim (pure) so the
// combat system and the loader share one source of truth.
export const WEAPON_TYPES = ['BULLET', 'ROCKET', 'SHELL', 'SIEGE', 'FLAME', 'SONIC', 'EXPLOSIVE'] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

export const ARMOR_CLASSES = ['NONE', 'LIGHT', 'MEDIUM', 'HEAVY', 'BUILDING', 'AIR'] as const; // AIR: XP-5
export type ArmorClass = (typeof ARMOR_CLASSES)[number];
