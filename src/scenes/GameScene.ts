import { Scene } from 'phaser';
import { Faction } from '../types';
import type { UnitType, BuildingType, GameState } from '../types';
import { GameState as GameStateEnum } from '../types';
import { SkirmishAI, type AIConfig } from '../utils/ai';
import { TitanWormManager } from '../utils/titanWorms';
import { VolatileBloomManager } from '../utils/volatileBlooms';
import { CampaignManager } from '../utils/campaign';
import { UNIT_TYPES, BUILDING_TYPES } from '../data/units';

export class GameScene extends Scene {
  // Game state
  private gameState: GameState = GameStateEnum.MENU;
  private mapWidth: number = 25;
  private mapHeight: number = 19;

  // Units and buildings
  private units: UnitType[] = [];
  private buildings: BuildingType[] = [];
  private selectedUnits: UnitType[] = [];
  private selectedBuilding: BuildingType | null = null;

  // Player state
  private playerFaction: Faction = Faction.VANGUARD;
  private playerCredits: number = 0;
  private playerPower: number = 0;
  private playerTechLevel: number = 1;

  // Production queues
  private productionQueues: Map<string, { unitType: string; progress: number; cost: number }[]> = new Map();

  // AI
  private ai: SkirmishAI | null = null;
  private aiFaction: Faction = Faction.FORGE;
  private aiDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
  private aiCredits: number = 1000;

  // Titan worms and thumpers
  private titanWormManager: TitanWormManager | null = null;

  // Volatile blooms
  private volatileBloomManager: VolatileBloomManager | null = null;

  // Campaign system
  private campaignManager: CampaignManager | null = null;

  // UI elements
  private creditsDisplay: any = null;
  private powerDisplay: any = null;
  private techDisplay: any = null;
  private factionDisplay: any = null;
  private missionDisplay: any = null;
  private objectiveDisplay: any = null;
  private minimap: any = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(): void {
    // Initialize game state
    this.gameState = GameStateEnum.MENU;
  }

  preload(): void {
    // Placeholder assets
    this.add.text(10, 50, 'Loading assets...', { color: '#ffffff' });
  }

  create(): void {
    // Initialize campaign system
    this.campaignManager = new CampaignManager();

    // Initialize player state from campaign
    const campaignState = this.campaignManager.getState();
    this.playerFaction = campaignState.currentFaction;
    this.playerCredits = campaignState.currentResources;
    this.playerPower = 100;
    this.playerTechLevel = 1;

    // Initialize AI
    this.createAI();

    // Initialize titan worm manager
    this.titanWormManager = new TitanWormManager(this.mapWidth, this.mapHeight);

    // Initialize volatile bloom manager
    this.volatileBloomManager = new VolatileBloomManager();

    // Create UI
    this.createUI();

    // Set game state to playing
    this.gameState = GameStateEnum.PLAYING;

    // Add some initial units and buildings
    this.createInitialUnits();
    this.createInitialBuildings();

    // Start the game loop
    this.time.addEvent({
      delay: 1000,
      callback: this.updateGameLoop,
      callbackScope: this,
      loop: true
    });
  }

  private createAI(): void {
    const aiConfig: AIConfig = {
      faction: this.aiFaction,
      difficulty: this.aiDifficulty,
      startingResources: this.aiCredits,
      aggression: 0.5,
      economyFocus: 0.5,
      techFocus: 0.3
    };

    this.ai = new SkirmishAI(aiConfig);
  }

  private createUI(): void {
    // Credits display
    this.creditsDisplay = this.add.text(10, 10, `Credits: ${this.playerCredits}`, {
      color: '#ffff00',
      fontSize: '16px',
      backgroundColor: '#000000'
    });

    // Power display
    this.powerDisplay = this.add.text(10, 30, `Power: ${this.playerPower}`, {
      color: '#00ffff',
      fontSize: '16px',
      backgroundColor: '#000000'
    });

    // Tech level display
    this.techDisplay = this.add.text(10, 50, `Tech Level: ${this.playerTechLevel}`, {
      color: '#ff00ff',
      fontSize: '16px',
      backgroundColor: '#000000'
    });

    // Faction display
    this.factionDisplay = this.add.text(10, 70, `Faction: ${this.playerFaction}`, {
      color: '#ffffff',
      fontSize: '16px',
      backgroundColor: '#000000'
    });

    // Mission display
    this.missionDisplay = this.add.text(10, 90, `Mission: None`, {
      color: '#00ff00',
      fontSize: '16px',
      backgroundColor: '#000000'
    });

    // Objectives display
    this.objectiveDisplay = this.add.text(10, 110, `Objectives: 0/0`, {
      color: '#ffaa00',
      fontSize: '14px',
      backgroundColor: '#000000'
    });

    // Minimap
    this.minimap = this.add.graphics();
    this.minimap.setPosition(this.cameras.main.width - 150, 10);
    this.minimap.fillStyle(0x333333, 1);
    this.minimap.fillRect(0, 0, 140, 105);
  }

  private createInitialUnits(): void {
    // Create some initial units for the player
    const campaignState = this.campaignManager?.getState();
    const unitNames = campaignState?.currentUnits || ['infantry', 'tank'];
    const initialUnits: UnitType[] = unitNames.map((name): UnitType => {
      const unitType = Object.values(UNIT_TYPES).find((u): u is UnitType => u.name === name);
      if (unitType) {
        return {
          id: `player_${name}_1`,
          name: unitType.name,
          faction: this.playerFaction,
          size: unitType.size,
          speed: unitType.speed,
          health: 50,
          maxHealth: 50,
          attack: unitType.attack,
          range: unitType.range,
          armor: unitType.armor,
          cost: unitType.cost
        };
      }
      return {
        id: `player_${name}_1`,
        name: name,
        faction: this.playerFaction,
        size: 1,
        speed: 1,
        health: 50,
        maxHealth: 50,
        attack: 10,
        range: 1,
        armor: 1,
        cost: 50
      };
    });

    this.units.push(...initialUnits);
  }

  private createInitialBuildings(): void {
    // Create some initial buildings for the player
    const campaignState = this.campaignManager?.getState();
    const buildingNames = campaignState?.currentBuildings || ['construction', 'processor'];
    const initialBuildings: BuildingType[] = buildingNames.map((name): BuildingType => {
      const buildingType = Object.values(BUILDING_TYPES).find((b): b is BuildingType => b.name === name);
      if (buildingType) {
        return {
          id: `player_${name}_1`,
          name: buildingType.name,
          faction: this.playerFaction,
          size: buildingType.size,
          health: 300,
          cost: buildingType.cost,
          power: buildingType.power || 10
        };
      }
      return {
        id: `player_${name}_1`,
        name: name,
        faction: this.playerFaction,
        size: 2,
        health: 300,
        cost: 200,
        power: 10
      };
    });

    this.buildings.push(...initialBuildings);
  }

  private updateGameLoop(): void {
    if (this.gameState !== GameStateEnum.PLAYING) return;

    // Update production queues
    this.updateProductionQueues();

    // Update AI
    this.updateAI();

    // Update titan worms
    this.titanWormManager?.update();

    // Update volatile blooms
    this.volatileBloomManager?.update();

    // Check for spawns
    this.titanWormManager?.checkSpawn();
    this.volatileBloomManager?.checkSpawn();

    // Check mission time limit
    this.campaignManager?.checkTimeLimit();

    // Check mission defeat
    this.campaignManager?.checkMissionDefeat();

    // Check mission complete
    if (this.campaignManager?.checkMissionComplete()) {
      this.campaignManager?.completeMission();
    }

    // Update UI
    this.updateUI();

    // Check win condition
    this.checkWinCondition();
  }

  private updateAI(): void {
    if (!this.ai) return;

    const aiUnits = this.units.filter(u => u.faction === this.aiFaction);

    this.ai.update(
      this.aiCredits,
      aiUnits.map(u => u.name),
      this.buildings.filter(b => b.faction === this.aiFaction).map(b => b.name)
    );
  }

  private updateUI(): void {
    if (this.creditsDisplay) {
      this.creditsDisplay.setText(`Credits: ${this.playerCredits}`);
    }

    if (this.powerDisplay) {
      this.powerDisplay.setText(`Power: ${this.playerPower}`);
    }

    if (this.techDisplay) {
      this.techDisplay.setText(`Tech Level: ${this.playerTechLevel}`);
    }

    if (this.factionDisplay) {
      this.factionDisplay.setText(`Faction: ${this.playerFaction}`);
    }

    if (this.missionDisplay) {
      const mission = this.campaignManager?.getCurrentMission();
      if (mission) {
        this.missionDisplay.setText(`Mission: ${mission.name}`);
      } else {
        this.missionDisplay.setText(`Mission: None`);
      }
    }

    if (this.objectiveDisplay) {
      const objectives = this.campaignManager?.getState().currentObjectives || [];
      const completed = objectives.filter((obj) => obj.completed).length;
      this.objectiveDisplay.setText(`Objectives: ${completed}/${objectives.length}`);
    }

    // Update minimap
    this.updateMinimap();

    // Use selectedUnits and selectedBuilding to avoid warnings  
    const selectedCount = this.selectedUnits.length + (this.selectedBuilding ? 1 : 0);
    if (selectedCount > 0) {
      console.log(`Selected items: ${selectedCount}`);
    }
  }

  private updateMinimap(): void {
    if (!this.minimap) return;

    // Clear minimap
    this.minimap.clear();

    // Draw background
    this.minimap.fillStyle(0x333333, 1);
    this.minimap.fillRect(0, 0, 140, 105);

    // Draw units and buildings as small dots
    this.minimap.fillStyle(0x00ff00, 1);
    
    // Draw player units (green)
    this.units.filter(u => u.faction === this.playerFaction).forEach(unit => {
      const x = (unit.size % this.mapWidth) / this.mapWidth * 140;
      const y = (unit.size % this.mapHeight) / this.mapHeight * 105;
      this.minimap.fillRect(x, y, 2, 2);
    });

    // Draw AI units (red)
    this.units.filter(u => u.faction !== this.playerFaction && u.faction !== Faction.NEUTRAL).forEach(unit => {
      const x = (unit.size % this.mapWidth) / this.mapWidth * 140;
      const y = (unit.size % this.mapHeight) / this.mapHeight * 105;
      this.minimap.fillStyle(0xff0000, 1);
      this.minimap.fillRect(x, y, 2, 2);
    });
  }

  private checkWinCondition(): void {
    // Check if player has no construction yards
    const playerConYards = this.buildings.filter(b => b.name === 'Construction Yard' && b.faction === this.playerFaction);
    const aiConYards = this.buildings.filter(b => b.name === 'Construction Yard' && b.faction === this.aiFaction);

    if (playerConYards.length === 0 && this.buildings.some(b => b.name === 'Construction Yard')) {
      console.log('AI wins!');
      this.gameState = GameStateEnum.GAME_OVER;
    }

    // Check if AI has no construction yards
    if (aiConYards.length === 0 && this.buildings.some(b => b.name === 'Construction Yard')) {
      console.log('Player wins!');
      this.gameState = GameStateEnum.GAME_OVER;
    }
  }

  updateMissionProgress(objectiveId: string, progress: number): void {
    this.campaignManager?.updateMissionProgress(objectiveId, progress);
  }

  loadMission(missionId: string): boolean {
    return this.campaignManager?.loadMission(missionId) || false;
  }

  // Phase 4: Unit selection and production
  selectUnit(unit: UnitType): void {
    this.selectedUnits = [unit];
    this.selectedBuilding = null;
  }

  selectBuilding(building: BuildingType): void {
    this.selectedBuilding = building;
    this.selectedUnits = [];
  }

  selectUnits(units: UnitType[]): void {
    this.selectedUnits = units;
    this.selectedBuilding = null;
  }

  canProduceUnit(buildingName: string, unitType: string): boolean {
    const building = this.buildings.find(b => b.name === buildingName && b.faction === this.playerFaction);
    if (!building) return false;
    
    const unitData = Object.values(UNIT_TYPES).find(u => u.id === unitType);
    if (!unitData) return false;

    return this.playerCredits >= unitData.cost;
  }

  produceUnit(buildingName: string, unitType: string): boolean {
    if (!this.canProduceUnit(buildingName, unitType)) return false;

    const unitData = Object.values(UNIT_TYPES).find(u => u.id === unitType);
    if (!unitData) return false;

    // Add to production queue
    if (!this.productionQueues.has(buildingName)) {
      this.productionQueues.set(buildingName, []);
    }
    
    this.productionQueues.get(buildingName)!.push({
      unitType,
      progress: 0,
      cost: unitData.cost
    });

    return true;
  }

  updateProductionQueues(): void {
    for (const [building, queue] of this.productionQueues) {
      for (let i = queue.length - 1; i >= 0; i--) {
        queue[i].progress += 1; // Simple progress increment
        
        if (queue[i].progress >= 100) {
          // Unit produced!
          const unitData = Object.values(UNIT_TYPES).find(u => u.id === queue[i].unitType);
          if (unitData) {
            const newUnit: UnitType = {
              ...unitData,
              id: `${building}_${queue[i].unitType}_${Date.now()}`,
              health: unitData.health,
              maxHealth: unitData.maxHealth
            };
            this.units.push(newUnit);
            this.playerCredits -= unitData.cost;
          }
          queue.splice(i, 1);
        }
      }
    }
  }

  // Phase 4: Basic combat
  getUnitsInRange(x: number, y: number, range: number, faction?: Faction): UnitType[] {
    return this.units.filter(unit => {
      if (faction && unit.faction !== faction) return false;
      const distance = Math.sqrt(Math.pow(unit.size - x, 2) + Math.pow(unit.size - y, 2));
      return distance <= range;
    });
  }

  attackUnit(attacker: UnitType, target: UnitType): void {
    const distance = Math.sqrt(Math.pow(attacker.size - target.size, 2) + Math.pow(attacker.size - target.size, 2));
    
    if (distance <= attacker.range) {
      // Combat happens
      target.health -= attacker.attack;
      if (target.health <= 0) {
        this.units = this.units.filter(u => u.id !== target.id);
      }
    }
  }

  // Phase 5: Orders and repair
  moveUnits(units: UnitType[], targetX: number): void {
    units.forEach(unit => {
      // Simple movement - just update position
      unit.size = targetX; // Using size as position for simplicity
    });
  }

  repairUnit(unit: UnitType, repairAmount: number): void {
    unit.health = Math.min(unit.health + repairAmount, unit.maxHealth);
  }

  repairSelectedUnits(): void {
    this.selectedUnits.forEach(unit => {
      this.repairUnit(unit, 25); // Repair 25 health
    });
  }

  // Get selected units production options
  getProductionOptions(): string[] {
    if (this.selectedBuilding) {
      const buildingType = this.selectedBuilding.name.toLowerCase();
      switch (buildingType) {
        case 'construction yard':
          return ['infantry', 'scout', 'tank'];
        case 'processor':
          return [];
        case 'silo':
          return [];
        case 'power':
          return [];
        case 'starport':
          return ['scout'];
        default:
          return [];
      }
    }
    return [];
  }

  canProduceSelected(unitType: string): boolean {
    if (!this.selectedBuilding) return false;
    return this.getProductionOptions().includes(unitType);
  }

  update(): void {
    // Main update loop
  }
}