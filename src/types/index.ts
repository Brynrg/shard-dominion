export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Position, Size {}

export interface GameConfig {
  width: number;
  height: number;
  tileSize: number;
}

export enum Faction {
  VANGUARD = 'vanguard',
  FORGE = 'forge',
  PHANTOM = 'phantom',
  NEUTRAL = 'neutral'
}

export interface UnitType {
  id: string;
  name: string;
  faction: Faction;
  size: number;
  speed: number;
  health: number;
  maxHealth: number;
  attack: number;
  range: number;
  armor: number;
  attackType?: 'melee' | 'ranged' | 'splash';
  cost: number;
}

export interface BuildingType {
  id: string;
  name: string;
  faction: Faction;
  size: number;
  health: number;
  cost: number;
  power?: number;
  produces?: string[];
}

export interface UnitSpecial {
  id: string;
  name: string;
  description: string;
  damage: number;
  range: number;
  radius?: number;
  cooldown: number;
}

export interface BuildingSpecial {
  id: string;
  name: string;
  description: string;
  cost: number;
  power: number;
  produces: string[];
}

export interface Resource {
  x: number;
  y: number;
  amount: number;
  max: number;
  regenRate: number;
}

export interface Credit {
  amount: number;
}

export interface HarvesterState {
  carrying: number;
  targetResource: { x: number; y: number } | null;
  targetProcessor: { x: number; y: number } | null;
  state: 'idle' | 'gathering' | 'returning';
}

export enum GameState {
  MENU = 'menu',
  PLAYING = 'playing',
  PAUSED = 'paused',
  GAME_OVER = 'game_over'
}

export enum CameraMode {
  FOLLOW = 'follow',
  FREE = 'free'
}

// Campaign types
export interface MissionObjective {
  id: string;
  type: 'destroy' | 'capture' | 'survive' | 'collect' | 'defend';
  target: string;
  description: string;
  required: number;
  current: number;
  completed: boolean;
}

export interface MissionBriefing {
  title: string;
  description: string;
  objectives: MissionObjective[];
  startingFaction: Faction;
  startingResources: number;
  startingUnits: string[];
  startingBuildings: string[];
  victoryCondition: string;
  defeatCondition: string;
  timeLimit?: number;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  briefing: MissionBriefing;
  difficulty: 'easy' | 'medium' | 'hard';
  unlocks?: string[];
  prerequisites?: string[];
  isTutorial?: boolean;
  isFinal?: boolean;
}

// Aliases for backwards compatibility
// type TypeUnitType = UnitType;
// type TypeBuildingType = BuildingType;
// type TypeFaction = Faction;