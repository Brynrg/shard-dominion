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
  PHANTOM = 'phantom'
}

export interface UnitType {
  id: string;
  name: string;
  faction: Faction;
  size: number;
  speed: number;
  health: number;
  attack: number;
  range: number;
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

// Aliases for backwards compatibility
// type TypeUnitType = UnitType;
// type TypeBuildingType = BuildingType;
// type TypeFaction = Faction;