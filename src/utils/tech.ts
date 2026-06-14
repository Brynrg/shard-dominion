import { Faction } from '../types';
import type { UnitSpecial, BuildingSpecial } from '../types';

export interface TechNode {
  id: string;
  name: string;
  description: string;
  cost: number;
  researchTime: number;
  prerequisites: string[];
  effects: TechEffect[];
}

export interface TechEffect {
  type: 'unit' | 'building' | 'ability' | 'stat';
  target: string;
  value: number | string;
  description: string;
}

export interface FactionUnique {
  faction: Faction;
  name: string;
  description: string;
  abilities: FactionAbility[];
}

export interface FactionAbility {
  id: string;
  name: string;
  description: string;
  cost: number;
  cooldown: number;
  effect: AbilityEffect;
}

export interface AbilityEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'spawn' | 'teleport' | 'stealth' | 'convert' | 'destroy';
  target: string;
  value: number;
  duration?: number;
  radius?: number;
}

export const TECH_TREE: Record<string, TechNode> = {
  // Vanguard Enclave - Advanced Tech
  vanguard_research_1: {
    id: 'vanguard_research_1',
    name: 'Advanced Ballistics',
    description: 'Increases tank damage by 20%',
    cost: 500,
    researchTime: 30,
    prerequisites: [],
    effects: [
      {
        type: 'stat',
        target: 'tank',
        value: 1.2,
        description: 'Damage +20%'
      }
    ]
  },
  vanguard_research_2: {
    id: 'vanguard_research_2',
    name: 'Aerial Support',
    description: 'Unlocks air strike ability',
    cost: 800,
    researchTime: 45,
    prerequisites: ['vanguard_research_1'],
    effects: [
      {
        type: 'ability',
        target: 'air_strike',
        value: '',
        description: 'Unlocks air strike ability'
      }
    ]
  },
  vanguard_research_3: {
    id: 'vanguard_research_3',
    name: 'Long Range Optics',
    description: 'Increases scout range by 50%',
    cost: 600,
    researchTime: 35,
    prerequisites: ['vanguard_research_1'],
    effects: [
      {
        type: 'stat',
        target: 'scout',
        value: 1.5,
        description: 'Range +50%'
      }
    ]
  },

  // Forge Dominion - Heavy Tech
  forge_research_1: {
    id: 'forge_research_1',
    name: 'Heavy Armor Plating',
    description: 'Increases guard and siege tank armor by 30%',
    cost: 500,
    researchTime: 30,
    prerequisites: [],
    effects: [
      {
        type: 'stat',
        target: 'guard',
        value: 1.3,
        description: 'Armor +30%'
      },
      {
        type: 'stat',
        target: 'siege',
        value: 1.3,
        description: 'Armor +30%'
      }
    ]
  },
  forge_research_2: {
    id: 'forge_research_2',
    name: 'Siege Engine Mastery',
    description: 'Increases siege tank damage by 40%',
    cost: 700,
    researchTime: 40,
    prerequisites: ['forge_research_1'],
    effects: [
      {
        type: 'stat',
        target: 'siege',
        value: 1.4,
        description: 'Damage +40%'
      }
    ]
  },
  forge_research_3: {
    id: 'forge_research_3',
    name: 'Power Core Overdrive',
    description: 'Increases power generation by 50%',
    cost: 600,
    researchTime: 35,
    prerequisites: ['forge_research_1'],
    effects: [
      {
        type: 'stat',
        target: 'power',
        value: 1.5,
        description: 'Power generation +50%'
      }
    ]
  },

  // Phantom Collective - Disruption Tech
  phantom_research_1: {
    id: 'phantom_research_1',
    name: 'Stealth Cloaking',
    description: 'Increases stealth unit visibility radius by 50%',
    cost: 500,
    researchTime: 30,
    prerequisites: [],
    effects: [
      {
        type: 'stat',
        target: 'stealth',
        value: 1.5,
        description: 'Visibility radius +50%'
      }
    ]
  },
  phantom_research_2: {
    id: 'phantom_research_2',
    name: 'Sabotage Protocol',
    description: 'Unlocks sabotage ability',
    cost: 800,
    researchTime: 45,
    prerequisites: ['phantom_research_1'],
    effects: [
      {
        type: 'ability',
        target: 'sabotage',
        value: '',
        description: 'Unlocks sabotage ability'
      }
    ]
  },
  phantom_research_3: {
    id: 'phantom_research_3',
    name: 'Speed Boost',
    description: 'Increases all unit speed by 25%',
    cost: 600,
    researchTime: 35,
    prerequisites: ['phantom_research_1'],
    effects: [
      {
        type: 'stat',
        target: 'all',
        value: 1.25,
        description: 'Speed +25%'
      }
    ]
  }
};

export const FACTION_UNIQUES: Record<Faction, FactionUnique> = {
  [Faction.VANGUARD]: {
    faction: Faction.VANGUARD,
    name: 'Vanguard Enclave',
    description: 'Balanced, long-range, air support',
    abilities: [
      {
        id: 'vanguard_sonic_area',
        name: 'Sonic Area',
        description: 'Deals 100 damage in a 3x3 area',
        cost: 300,
        cooldown: 60,
        effect: {
          type: 'damage',
          target: 'area',
          value: 100,
          radius: 3
        }
      },
      {
        id: 'vanguard_air_strike',
        name: 'Air Strike',
        description: 'Calls in an airstrike on target',
        cost: 400,
        cooldown: 90,
        effect: {
          type: 'damage',
          target: 'point',
          value: 150,
          radius: 2
        }
      }
    ]
  },
  [Faction.FORGE]: {
    faction: Faction.FORGE,
    name: 'Forge Dominion',
    description: 'Heavy, brute force',
    abilities: [
      {
        id: 'forge_heavy_brute',
        name: 'Heavy Brute',
        description: 'Summons a behemoth unit',
        cost: 500,
        cooldown: 120,
        effect: {
          type: 'spawn',
          target: 'behemoth',
          value: 1
        }
      },
      {
        id: 'forge_siege',
        name: 'Siege',
        description: 'Increases siege tank damage by 50%',
        cost: 200,
        cooldown: 30,
        effect: {
          type: 'buff',
          target: 'siege',
          value: 1.5,
          duration: 60
        }
      }
    ]
  },
  [Faction.PHANTOM]: {
    faction: Faction.PHANTOM,
    name: 'Phantom Collective',
    description: 'Speed, stealth, disruption',
    abilities: [
      {
        id: 'phantom_deviator',
        name: 'Deviator',
        description: 'Converts enemy unit to your faction',
        cost: 350,
        cooldown: 90,
        effect: {
          type: 'convert',
          target: 'unit',
          value: 1
        }
      },
      {
        id: 'phantom_sabotage',
        name: 'Sabotage',
        description: 'Destroys enemy building',
        cost: 250,
        cooldown: 60,
        effect: {
          type: 'destroy',
          target: 'building',
          value: 1
        }
      }
    ]
  },
  [Faction.NEUTRAL]: {
    faction: Faction.NEUTRAL,
    name: 'Neutral',
    description: 'Balanced, no special abilities',
    abilities: []
  }
};

export const SPECIAL_UNITS: Record<string, UnitSpecial> = {
  // Vanguard
  sonic_area: {
    id: 'sonic_area',
    name: 'Sonic Tank',
    description: 'Deals area damage',
    damage: 100,
    range: 3,
    radius: 3,
    cooldown: 60
  },
  air_strike: {
    id: 'air_strike',
    name: 'Aircraft',
    description: 'Calls in airstrikes',
    damage: 150,
    range: 5,
    cooldown: 90
  },

  // Forge
  heavy_brute: {
    id: 'heavy_brute',
    name: 'Behemoth',
    description: 'Heavy tank with massive damage',
    damage: 80,
    range: 2,
    cooldown: 120
  },
  siege: {
    id: 'siege',
    name: 'Siege Tank',
    description: 'Long-range siege damage',
    damage: 60,
    range: 5,
    cooldown: 45
  },

  // Phantom
  deviator: {
    id: 'deviator',
    name: 'Deviator',
    description: 'Converts enemy units',
    damage: 0,
    range: 3,
    cooldown: 90
  },
  sabotage: {
    id: 'sabotage',
    name: 'Saboteur',
    description: 'Destroys enemy buildings',
    damage: 0,
    range: 4,
    cooldown: 60
  }
};

export const SPECIAL_BUILDINGS: Record<string, BuildingSpecial> = {
  // Research Lab
  research: {
    id: 'research',
    name: 'Research Lab',
    description: 'Unlocks advanced tech',
    cost: 250,
    power: 20,
    produces: ['research']
  },

  // Starport
  starport: {
    id: 'starport',
    name: 'Starport',
    description: 'Builds air units',
    cost: 300,
    power: 30,
    produces: ['scout']
  }
};