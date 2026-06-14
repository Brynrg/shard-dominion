import { Faction } from '../types';
import { UNIT_TYPES, BUILDING_TYPES } from '../data/units';

export interface AIConfig {
  faction: Faction;
  difficulty: 'easy' | 'medium' | 'hard';
  startingResources: number;
  aggression: number; // 0-1, higher = more aggressive
  economyFocus: number; // 0-1, higher = more economy
  techFocus: number; // 0-1, higher = more tech
}

export interface AIState {
  resources: number;
  units: string[];
  buildings: string[];
  researchLevel: number;
  lastAction: string;
  lastActionTime: number;
}

export class SkirmishAI {
  private config: AIConfig;
  private state: AIState;
  private readonly DECISION_INTERVAL = 2000; // ms

  constructor(config: AIConfig) {
    this.config = config;
    this.state = {
      resources: config.startingResources,
      units: [],
      buildings: [],
      researchLevel: 0,
      lastAction: 'idle',
      lastActionTime: Date.now(),
    };
  }

  update(resources: number, units: string[], buildings: string[]): AIState {
    this.state.resources = resources;
    this.state.units = units;
    this.state.buildings = buildings;

    // Check if it's time to make a decision
    if (Date.now() - this.state.lastActionTime > this.DECISION_INTERVAL) {
      this.makeDecision();
    }

    return this.state;
  }

  private makeDecision(): void {
    const now = Date.now();
    this.state.lastActionTime = now;

    // Determine priority based on difficulty and faction personality
    const priority = this.calculatePriority();

    switch (priority) {
      case 'economy':
        this.buildEconomy();
        break;
      case 'military':
        this.buildMilitary();
        break;
      case 'tech':
        this.advanceTech();
        break;
      case 'attack':
        this.attack();
        break;
      default:
        this.buildEconomy();
    }
  }

  private calculatePriority(): string {
    const { aggression, economyFocus, techFocus, difficulty } = this.config;

    // Base weights
    let militaryWeight = aggression * 0.4;
    let economyWeight = economyFocus * 0.3;
    let techWeight = techFocus * 0.2;

    // Difficulty modifiers
    if (difficulty === 'easy') {
      militaryWeight *= 0.5;
      economyWeight *= 1.5;
    } else if (difficulty === 'hard') {
      militaryWeight *= 1.5;
      economyWeight *= 0.5;
    }

    // Faction-specific modifiers
    switch (this.config.faction) {
      case Faction.VANGUARD:
        // Balanced, long-range, air
        techWeight += 0.2;
        break;
      case Faction.FORGE:
        // Heavy, brute
        militaryWeight += 0.2;
        economyWeight += 0.1;
        break;
      case Faction.PHANTOM:
        // Speed, stealth, disruption
        militaryWeight += 0.1;
        techWeight += 0.1;
        break;
    }

    // Normalize weights
    const total = militaryWeight + economyWeight + techWeight;
    const militaryRatio = militaryWeight / total;
    const economyRatio = economyWeight / total;
    const techRatio = techWeight / total;

    if (militaryRatio > 0.5) return 'military';
    if (economyRatio > 0.5) return 'economy';
    if (techRatio > 0.5) return 'tech';
    if (militaryRatio > 0.3) return 'attack';
    return 'economy';
  }

  private buildEconomy(): void {
    // Check if we have a processor
    const hasProcessor = this.state.buildings.includes('processor');

    if (!hasProcessor) {
      this.state.lastAction = 'build_processor';
      this.state.buildings.push('processor');
      this.state.resources -= BUILDING_TYPES.processor.cost;
    } else {
      // Build harvester if we have resources
      const hasHarvester = this.state.units.includes('harvester');
      if (!hasHarvester && this.state.resources >= UNIT_TYPES.harvester.cost) {
        this.state.lastAction = 'build_harvester';
        this.state.units.push('harvester');
        this.state.resources -= UNIT_TYPES.harvester.cost;
      }
    }
  }

  private buildMilitary(): void {
    // Check if we have a barracks
    const hasBarracks = this.state.buildings.some(b =>
      b === 'construction' || b === 'forge' || b === 'nexus'
    );

    if (!hasBarracks) {
      this.state.lastAction = 'build_barracks';
      this.state.buildings.push('construction');
      this.state.resources -= BUILDING_TYPES.construction.cost;
    } else {
      // Build units based on faction
      const unit = this.selectUnit();
      if (unit && this.state.resources >= UNIT_TYPES[unit].cost) {
        this.state.lastAction = `build_${unit}`;
        this.state.units.push(unit);
        this.state.resources -= UNIT_TYPES[unit].cost;
      }
    }
  }

  private selectUnit(): string | null {
    const { faction } = this.config;

    switch (faction) {
      case Faction.VANGUARD:
        // Balanced, long-range
        return Math.random() > 0.5 ? 'scout' : 'tank';
      case Faction.FORGE:
        // Heavy, brute
        return Math.random() > 0.5 ? 'guard' : 'siege';
      case Faction.PHANTOM:
        // Speed, stealth
        return Math.random() > 0.5 ? 'trooper' : 'stealth';
      default:
        return 'infantry';
    }
  }

  private advanceTech(): void {
    // Check if we have a research lab
    const hasResearchLab = this.state.buildings.includes('researchLab');

    if (!hasResearchLab) {
      this.state.lastAction = 'build_research_lab';
      this.state.buildings.push('researchLab');
      this.state.resources -= BUILDING_TYPES.researchLab.cost;
    } else {
      // Advance research level
      this.state.researchLevel = Math.min(3, this.state.researchLevel + 1);
      this.state.lastAction = 'advance_research';
    }
  }

  private attack(): void {
    // Check if we have military units
    const hasMilitary = this.state.units.some(u =>
      u === 'tank' || u === 'scout' || u === 'guard' || u === 'siege' ||
      u === 'trooper' || u === 'stealth'
    );

    if (hasMilitary) {
      this.state.lastAction = 'attack';
    }
  }

  getDecision(): string {
    return this.state.lastAction;
  }

  getState(): AIState {
    return { ...this.state };
  }
}

// Skirmish configuration presets
export const SKIRMISH_PRESETS = {
  easy: {
    difficulty: 'easy' as const,
    startingResources: 1000,
    aggression: 0.3,
    economyFocus: 0.7,
    techFocus: 0.2,
  },
  medium: {
    difficulty: 'medium' as const,
    startingResources: 1500,
    aggression: 0.5,
    economyFocus: 0.5,
    techFocus: 0.3,
  },
  hard: {
    difficulty: 'hard' as const,
    startingResources: 2000,
    aggression: 0.7,
    economyFocus: 0.4,
    techFocus: 0.4,
  },
};

export const FACTION_PRESETS: Record<Faction, AIConfig> = {
  [Faction.VANGUARD]: {
    faction: Faction.VANGUARD,
    ...SKIRMISH_PRESETS.medium,
  },
  [Faction.FORGE]: {
    faction: Faction.FORGE,
    ...SKIRMISH_PRESETS.hard,
  },
  [Faction.PHANTOM]: {
    faction: Faction.PHANTOM,
    ...SKIRMISH_PRESETS.easy,
  },
  [Faction.NEUTRAL]: {
    faction: Faction.NEUTRAL,
    ...SKIRMISH_PRESETS.medium,
  },
};