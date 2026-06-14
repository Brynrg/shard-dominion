import { Faction } from '../types';

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
  timeLimit?: number; // seconds
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  briefing: MissionBriefing;
  difficulty: 'easy' | 'medium' | 'hard';
  unlocks?: string[]; // Mission IDs that become available after this mission
  prerequisites?: string[]; // Mission IDs required to play this mission
  isTutorial?: boolean;
  isFinal?: boolean;
}

export const MISSIONS: Record<string, Mission> = {
  // Tutorial Mission
  tutorial: {
    id: 'tutorial',
    name: 'First Steps',
    description: 'Learn the basics of Shard Dominion',
    briefing: {
      title: 'First Steps',
      description: 'Welcome to Aether Prime. Your task is to establish a base and gather resources. Build a Construction Yard, then a Processor and Silo. Harvest shards from the nearby fields and deliver them to your Processor.',
      objectives: [
        {
          id: 'build_construction',
          type: 'capture',
          target: 'construction',
          description: 'Build a Construction Yard',
          required: 1,
          current: 0,
          completed: false,
        },
        {
          id: 'build_processor',
          type: 'capture',
          target: 'processor',
          description: 'Build a Processor',
          required: 1,
          current: 0,
          completed: false,
        },
        {
          id: 'build_silo',
          type: 'capture',
          target: 'silo',
          description: 'Build a Silo',
          required: 1,
          current: 0,
          completed: false,
        },
        {
          id: 'harvest_shards',
          type: 'collect',
          target: 'shards',
          description: 'Harvest 500 shards',
          required: 500,
          current: 0,
          completed: false,
        },
      ],
      startingFaction: Faction.VANGUARD,
      startingResources: 1000,
      startingUnits: ['infantry'],
      startingBuildings: [],
      victoryCondition: 'Complete all objectives',
      defeatCondition: 'Lose all Construction Yards',
    },
    difficulty: 'easy',
    isTutorial: true,
  },

  // Mission 1: Defend the Base
  mission_1: {
    id: 'mission_1',
    name: 'Defend the Base',
    description: 'Defend your base from enemy raids',
    briefing: {
      title: 'Defend the Base',
      description: 'Enemy forces are approaching. Build defenses and repel their attacks. Protect your Construction Yard at all costs.',
      objectives: [
        {
          id: 'survive_10_minutes',
          type: 'survive',
          target: 'time',
          description: 'Survive for 10 minutes',
          required: 600,
          current: 0,
          completed: false,
        },
        {
          id: 'destroy_enemy_construction',
          type: 'destroy',
          target: 'enemy_construction',
          description: 'Destroy all enemy Construction Yards',
          required: 3,
          current: 0,
          completed: false,
        },
      ],
      startingFaction: Faction.VANGUARD,
      startingResources: 1500,
      startingUnits: ['infantry', 'scout', 'tank'],
      startingBuildings: ['construction', 'processor', 'silo'],
      victoryCondition: 'Destroy all enemy Construction Yards',
      defeatCondition: 'Lose your Construction Yard',
    },
    difficulty: 'easy',
    unlocks: ['mission_2'],
  },

  // Mission 2: Expand and Conquer
  mission_2: {
    id: 'mission_2',
    name: 'Expand and Conquer',
    description: 'Expand your territory and capture enemy bases',
    briefing: {
      title: 'Expand and Conquer',
      description: 'The enemy has fortified their positions. Capture their Construction Yards and establish your own forward bases. Use your advanced units to break through their defenses.',
      objectives: [
        {
          id: 'capture_3_bases',
          type: 'capture',
          target: 'enemy_construction',
          description: 'Capture 3 enemy Construction Yards',
          required: 3,
          current: 0,
          completed: false,
        },
        {
          id: 'build_advanced_tech',
          type: 'collect',
          target: 'research',
          description: 'Research at least 2 advanced technologies',
          required: 2,
          current: 0,
          completed: false,
        },
      ],
      startingFaction: Faction.VANGUARD,
      startingResources: 2000,
      startingUnits: ['infantry', 'scout', 'tank', 'harvester'],
      startingBuildings: ['construction', 'processor', 'silo', 'power'],
      victoryCondition: 'Capture 3 enemy bases and research advanced tech',
      defeatCondition: 'Lose all Construction Yards',
    },
    difficulty: 'medium',
    unlocks: ['mission_3', 'mission_4'],
  },

  // Mission 3: Titan Worms
  mission_3: {
    id: 'mission_3',
    name: 'Titan Worms',
    description: 'Face the Titan Worms - a neutral threat',
    briefing: {
      title: 'Titan Worms',
      description: 'Titan Worms have emerged from the deep sands. They are attracted to thumpers and vibrations. Use thumpers to lure and destroy them, or build defenses to withstand their attacks.',
      objectives: [
        {
          id: 'destroy_2_titan_worms',
          type: 'destroy',
          target: 'titan_worm',
          description: 'Destroy 2 Titan Worms',
          required: 2,
          current: 0,
          completed: false,
        },
        {
          id: 'build_thumpers',
          type: 'collect',
          target: 'thumpers',
          description: 'Build 3 Thumpers',
          required: 3,
          current: 0,
          completed: false,
        },
      ],
      startingFaction: Faction.FORGE,
      startingResources: 1800,
      startingUnits: ['infantry', 'guard', 'siege'],
      startingBuildings: ['construction', 'processor', 'silo', 'power'],
      victoryCondition: 'Destroy 2 Titan Worms using thumpers',
      defeatCondition: 'Lose all Construction Yards',
    },
    difficulty: 'medium',
    unlocks: ['mission_4'],
  },

  // Mission 4: Volatile Blooms
  mission_4: {
    id: 'mission_4',
    name: 'Volatile Blooms',
    description: 'Navigate through volatile bloom fields',
    briefing: {
      title: 'Volatile Blooms',
      description: 'Volatile Blooms are unstable energy crystals that can explode. Navigate your forces through the bloom fields carefully, or use them to your advantage in battle.',
      objectives: [
        {
          id: 'navigate_bloom_field',
          type: 'survive',
          target: 'bloom_field',
          description: 'Navigate through the volatile bloom field',
          required: 1,
          current: 0,
          completed: false,
        },
        {
          id: 'destroy_blooms',
          type: 'destroy',
          target: 'volatile_bloom',
          description: 'Destroy 5 Volatile Blooms',
          required: 5,
          current: 0,
          completed: false,
        },
      ],
      startingFaction: Faction.PHANTOM,
      startingResources: 1600,
      startingUnits: ['trooper', 'stealth', 'harvester'],
      startingBuildings: ['construction', 'processor', 'silo', 'power'],
      victoryCondition: 'Destroy 5 Volatile Blooms',
      defeatCondition: 'Lose all Construction Yards',
    },
    difficulty: 'hard',
    unlocks: ['mission_5'],
  },

  // Mission 5: Final Battle
  mission_5: {
    id: 'mission_5',
    name: 'Final Battle',
    description: 'The ultimate test - defeat the enemy faction',
    briefing: {
      title: 'Final Battle',
      description: 'The enemy has gathered their full forces. This is the final battle for Aether Prime. Use all your units, technologies, and strategies to defeat them and claim victory.',
      objectives: [
        {
          id: 'destroy_all_enemies',
          type: 'destroy',
          target: 'all_enemies',
          description: 'Destroy all enemy units and buildings',
          required: 1,
          current: 0,
          completed: false,
        },
        {
          id: 'capture_enemy_command',
          type: 'capture',
          target: 'enemy_command',
          description: 'Capture the enemy Command Nexus',
          required: 1,
          current: 0,
          completed: false,
        },
      ],
      startingFaction: Faction.VANGUARD,
      startingResources: 2500,
      startingUnits: ['infantry', 'scout', 'tank', 'harvester', 'sonic_area'],
      startingBuildings: ['construction', 'processor', 'silo', 'power', 'starport'],
      victoryCondition: 'Destroy all enemies and capture the Command Nexus',
      defeatCondition: 'Lose all Construction Yards',
    },
    difficulty: 'hard',
    isFinal: true,
  },
};

export const getMission = (missionId: string): Mission | undefined => {
  return MISSIONS[missionId];
};

export const getAvailableMissions = (completedMissionIds: string[]): Mission[] => {
  return Object.values(MISSIONS).filter(
    (mission) =>
      !mission.prerequisites ||
      mission.prerequisites.every((prereq) => completedMissionIds.includes(prereq))
  );
};

export const getMissionProgress = (completedMissionIds: string[]): Mission[] => {
  return Object.values(MISSIONS).filter((mission) =>
    completedMissionIds.includes(mission.id)
  );
};