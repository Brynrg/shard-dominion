import type { UnitType, BuildingType } from '../types';
import { Faction } from '../types';

export const UNIT_TYPES: Record<string, UnitType> = {
  // Vanguard Enclave - balanced/long-range/air
  infantry: {
    id: 'infantry',
    name: 'Infantry',
    faction: Faction.VANGUARD,
    size: 1,
    speed: 1.2,
    health: 100,
    maxHealth: 100,
    attack: 20,
    range: 1,
    armor: 0,
    attackType: 'melee',
    cost: 50
  },
  scout: {
    id: 'scout',
    name: 'Scout',
    faction: Faction.VANGUARD,
    size: 1,
    speed: 2.0,
    health: 80,
    maxHealth: 80,
    attack: 10,
    range: 2,
    armor: 0,
    attackType: 'ranged',
    cost: 75
  },
  tank: {
    id: 'tank',
    name: 'Tank',
    faction: Faction.VANGUARD,
    size: 2,
    speed: 0.8,
    health: 200,
    maxHealth: 200,
    attack: 25,
    range: 3,
    armor: 2,
    attackType: 'ranged',
    cost: 150
  },
  
  // Forge Dominion - heavy/brute
  guard: {
    id: 'guard',
    name: 'Guard',
    faction: Faction.FORGE,
    size: 1,
    speed: 1.0,
    health: 150,
    maxHealth: 150,
    attack: 25,
    range: 1,
    armor: 1,
    attackType: 'melee',
    cost: 60
  },
  siege: {
    id: 'siege',
    name: 'Siege Tank',
    faction: Faction.FORGE,
    size: 2,
    speed: 0.6,
    health: 250,
    maxHealth: 250,
    attack: 35,
    range: 4,
    armor: 3,
    attackType: 'ranged',
    cost: 180
  },
  behemoth: {
    id: 'behemoth',
    name: 'Behemoth',
    faction: Faction.FORGE,
    size: 3,
    speed: 0.4,
    health: 400,
    maxHealth: 400,
    attack: 40,
    range: 2,
    armor: 5,
    attackType: 'melee',
    cost: 250
  },
  
  // Phantom Collective - speed/stealth/disruption
  trooper: {
    id: 'trooper',
    name: 'Trooper',
    faction: Faction.PHANTOM,
    size: 1,
    speed: 1.5,
    health: 90,
    maxHealth: 90,
    attack: 18,
    range: 1,
    armor: 0,
    attackType: 'melee',
    cost: 55
  },
  stealth: {
    id: 'stealth',
    name: 'Stealth Unit',
    faction: Faction.PHANTOM,
    size: 1,
    speed: 1.8,
    health: 100,
    maxHealth: 100,
    attack: 22,
    range: 1,
    armor: 1,
    attackType: 'melee',
    cost: 80
  },
  // Economy
  harvester: {
    id: 'harvester',
    name: 'Harvester',
    faction: Faction.VANGUARD,
    size: 1,
    speed: 1.0,
    health: 120,
    maxHealth: 120,
    attack: 10,
    range: 1,
    armor: 1,
    attackType: 'melee',
    cost: 100
  }
};

export const BUILDING_TYPES: Record<string, BuildingType> = {
  // Common buildings
  construction: {
    id: 'construction',
    name: 'Construction Yard',
    faction: Faction.VANGUARD,
    size: 3,
    health: 500,
    cost: 200,
    produces: ['infantry', 'scout', 'tank']
  },
  processor: {
    id: 'processor',
    name: 'Processor',
    faction: Faction.VANGUARD,
    size: 2,
    health: 300,
    cost: 150
  },
  silo: {
    id: 'silo',
    name: 'Silo',
    faction: Faction.VANGUARD,
    size: 2,
    health: 250,
    cost: 100
  },
  power: {
    id: 'power',
    name: 'Power Node',
    faction: Faction.VANGUARD,
    size: 2,
    health: 200,
    cost: 120
  },
  foundation: {
    id: 'foundation',
    name: 'Foundation Slab',
    faction: Faction.VANGUARD,
    size: 1,
    health: 100,
    cost: 25
  },
  repair: {
    id: 'repair',
    name: 'Repair Pad',
    faction: Faction.VANGUARD,
    size: 2,
    health: 150,
    cost: 100
  },
  
  // Faction-specific
  starport: {
    id: 'starport',
    name: 'Starport',
    faction: Faction.VANGUARD,
    size: 3,
    health: 350,
    cost: 300,
    produces: ['scout']
  },
  
  forge: {
    id: 'forge',
    name: 'Forge',
    faction: Faction.FORGE,
    size: 2,
    health: 300,
    cost: 180,
    produces: ['guard']
  },
  
  nexus: {
    id: 'nexus',
    name: 'Command Nexus',
    faction: Faction.PHANTOM,
    size: 3,
    health: 400,
    cost: 350,
    produces: ['stealth']
  },
  researchLab: {
    id: 'researchLab',
    name: 'Research Lab',
    faction: Faction.PHANTOM,
    size: 2,
    health: 300,
    cost: 250
  },
  titanWorm: {
    id: 'titanWorm',
    name: 'Titan Worm',
    faction: Faction.PHANTOM,
    size: 4,
    health: 600,
    cost: 400,
    produces: ['titanWorm']
  },
  volatileBloom: {
    id: 'volatileBloom',
    name: 'Volatile Bloom',
    faction: Faction.PHANTOM,
    size: 2,
    health: 200,
    cost: 150
  }
};