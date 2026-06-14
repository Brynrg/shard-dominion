import { Faction, GameState } from '../types';
import { FACTION_PRESETS } from './ai';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface SkirmishConfig {
  mapSize: number;
  startingResources: number;
  difficulty: Difficulty;
  playerFaction: Faction;
  aiFactions: Faction[];
  aiDifficulties: Difficulty[];
}

export interface GameSession {
  config: SkirmishConfig;
  state: GameState;
  resources: number;
  units: string[];
  buildings: string[];
  aiSessions: Map<Faction, any>; // AI instances
  startTime: number;
  winner: Faction | null;
}

export class GameSessionManager {
  private currentSession: GameSession | null = null;

  createSession(config: SkirmishConfig): GameSession {
    this.currentSession = {
      config,
      state: GameState.PLAYING,
      resources: config.startingResources,
      units: [],
      buildings: ['construction'], // Start with construction yard
      aiSessions: new Map(),
      startTime: Date.now(),
      winner: null,
    };

    // Initialize AI sessions
    for (const [faction, difficulty] of this.getAIFactions(config)) {
      const aiConfig = FACTION_PRESETS[faction];
      this.currentSession!.aiSessions.set(faction, {
        config: { ...aiConfig, difficulty, startingResources: config.startingResources },
        state: {
          resources: config.startingResources,
          units: [],
          buildings: ['construction'],
          researchLevel: 0,
          lastAction: 'idle',
          lastActionTime: Date.now(),
        },
      });
    }

    return this.currentSession;
  }

  getAIFactions(config: SkirmishConfig): Array<[Faction, 'easy' | 'medium' | 'hard']> {
    const aiFactions: Array<[Faction, 'easy' | 'medium' | 'hard']> = [];

    for (const faction of config.aiFactions) {
      const difficulty = config.aiDifficulties[aiFactions.length] || 'medium';
      aiFactions.push([faction, difficulty]);
    }

    return aiFactions;
  }

  updateSession(deltaTime: number): void {
    if (!this.currentSession) return;

    // Update AI sessions
    for (const [_, ai] of this.currentSession.aiSessions) {
      // AI update would be called here
      // For now, just update the state
      ai.state.lastActionTime += deltaTime;
    }

    // Check win condition
    this.checkWinCondition();
  }

  checkWinCondition(): void {
    if (!this.currentSession) return;

    const { playerFaction, aiFactions } = this.currentSession.config;
    const playerHasConstruction = this.currentSession.buildings.includes('construction');
    const aiHasConstruction = aiFactions.some(() =>
      (this.currentSession as GameSession).buildings.includes('construction')
    );

    if (!playerHasConstruction) {
      this.currentSession.winner = this.getEnemyFaction(playerFaction);
    } else if (!aiHasConstruction) {
      this.currentSession.winner = playerFaction;
    }
  }

  getEnemyFaction(playerFaction: Faction): Faction | null {
    const { aiFactions } = this.currentSession!.config;
    const enemy = aiFactions.find(f => f !== playerFaction);
    return enemy || null;
  }

  getCurrentSession(): GameSession | null {
    return this.currentSession;
  }

  endSession(): void {
    this.currentSession = null;
  }
}

// UI State for skirmish menu
export interface SkirmishMenuState {
  show: boolean;
  selectedMap: number;
  selectedDifficulty: 'easy' | 'medium' | 'hard';
  selectedPlayerFaction: Faction;
  selectedAIFactions: Faction[];
  selectedAIDifficulties: ('easy' | 'medium' | 'hard')[];
}

export const DEFAULT_SKIRMISH_MENU: SkirmishMenuState = {
  show: true,
  selectedMap: 0,
  selectedDifficulty: 'medium',
  selectedPlayerFaction: Faction.VANGUARD,
  selectedAIFactions: [Faction.FORGE, Faction.PHANTOM],
  selectedAIDifficulties: ['medium', 'medium'],
};

// Available maps
export const AVAILABLE_MAPS = [
  { id: 0, name: 'Standard', size: 25 },
  { id: 1, name: 'Large', size: 35 },
  { id: 2, name: 'Small', size: 15 },
];

// Available factions
export const AVAILABLE_FACTIONS = [
  Faction.VANGUARD,
  Faction.FORGE,
  Faction.PHANTOM,
];