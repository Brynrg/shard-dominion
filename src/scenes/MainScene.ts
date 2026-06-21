import { Scene } from 'phaser';
import type { Position } from '../types';
import { GameState } from '../types';
import { TerrainGenerator } from '../utils/terrain';
import { PathFinder } from '../utils/pathfinding';
import { FogOfWar } from '../utils/fog';
import { Faction } from '../types';
import { UNIT_TYPES, BUILDING_TYPES } from '../data';
import type { AIConfig } from '../utils/ai';
import { SkirmishAI } from '../utils/ai';
import { TitanWormManager } from '../utils/titanWorms';
import { VolatileBloomManager } from '../utils/volatileBlooms';

interface Unit {
  id: string;
  x: number;
  y: number;
  type: keyof typeof UNIT_TYPES;
  selected: boolean;
  path: { x: number; y: number }[];
  health: number;
  currentHealth: number;
  progress: number; // For pixel-lerp movement
  targetX: number | undefined; // Target tile X for lerp
  targetY: number | undefined; // Target tile Y for lerp
  owner: 'player' | 'ai';
  faction: Faction;
  lastAttackTime: number; // Cooldown tracking
}

export class MainScene extends Scene {
  private gameState: GameState = GameState.MENU;
  private terrain: number[][] = [];
  private units: Unit[] = [];
  private selectedUnit: Unit | null = null;
  private fogOfWar!: FogOfWar;
  private tileSize!: number;
  private mapWidth!: number;
  private mapHeight!: number;
  private titanWormManager!: TitanWormManager;
  private volatileBloomManager!: VolatileBloomManager;
  private gameStartTime: number = Date.now();
  private creditDisplay!: any;
  private projectiles: Array<{
    id: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    speed: number;
    damage: number;
    owner: 'player' | 'ai';
    type: string;
    graphics: Phaser.GameObjects.Graphics;
  }> = [];

  // Economy
  private credits: number = 0;
  private harvesters: Unit[] = [];
  private resourceFields: { x: number; y: number }[] = [];
  private processors: { x: number; y: number }[] = [];
  private silos: { x: number; y: number }[] = [];
  private buildings: { x: number; y: number; type: string; health: number; maxHealth: number; foundation: boolean; power: number; selected: boolean; size: number; id?: string }[] = [];
  private repairPads: { x: number; y: number; type: string; health: number; maxHealth: number; size: number }[] = [];
  private power: number = 0;
  private powerUsage: number = 0;
  private powerDisplay!: any;
  private constructionQueue: { type: string; progress: number; spawnX?: number; spawnY?: number }[] = [];
  private productionQueue: { type: string; progress: number; spawnX?: number; spawnY?: number }[] = [];
  private constructionDisplay!: any;
  private productionDisplay!: any;
  private techDisplay!: any;
    private uiContainer!: Phaser.GameObjects.Container;
    private sidebar!: Phaser.GameObjects.Container;
    private minimap!: Phaser.GameObjects.Container;
    private fogGraphics!: Phaser.GameObjects.Graphics;
    private minimapFogGraphics!: Phaser.GameObjects.Graphics;
    private minimapUnitGraphics!: Phaser.GameObjects.Graphics;
    private minimapBuildingGraphics!: Phaser.GameObjects.Graphics;
    private unitGraphicsMap: Map<string, Phaser.GameObjects.Graphics> = new Map();
    private buildingGraphicsMap: Map<string, Phaser.GameObjects.Graphics> = new Map();
    private buildMode: boolean = false;

    // AI
    private ai: SkirmishAI | null = null;
    private aiFaction: Faction = Faction.VANGUARD;
    private aiDifficulty: 'easy' | 'medium' | 'hard' = 'easy';
    private aiCredits: number = 200;

  constructor() {
    super({ key: 'MainScene' });
  }

  init(): void {
    this.tileSize = 32;
    this.mapWidth = TerrainGenerator.getWidth();
    this.mapHeight = TerrainGenerator.getHeight();
    
    // Center the camera
    this.cameras.main.setBounds(0, 0, this.mapWidth * this.tileSize, this.mapHeight * this.tileSize);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.scrollX = (this.mapWidth * this.tileSize - this.cameras.main.width) / 2;
    this.cameras.main.scrollY = (this.mapHeight * this.tileSize - this.cameras.main.height) / 2;
    
    this.fogOfWar = new FogOfWar(this.mapWidth, this.mapHeight);
    this.titanWormManager = new TitanWormManager(this, this.units, this.buildings);
    this.volatileBloomManager = new VolatileBloomManager(this, this.units, this.buildings);
  }

  preload(): void {
    // No assets yet
  }

  create(): void {
    // Check if this is the first run (no AI units yet)
    const hasAIUnits = this.units.some(u => u.id.startsWith('ai_'));

    if (!hasAIUnits) {
      // Show faction select screen
      this.showFactionSelect();
    } else {
      // Start game directly
      this.createUI();
      this.createAI();
      this.createTerrain();
      this.createUnits();
      this.createEconomy();
      this.setupInput();

      // Initialize persistent graphics objects
      console.log('Creating graphics objects...');
      this.fogGraphics = this.add.graphics();
      this.minimapFogGraphics = this.add.graphics();
      this.minimapUnitGraphics = this.add.graphics();
      this.minimapBuildingGraphics = this.add.graphics();
      console.log('Graphics objects created:', {
        fogGraphics: this.fogGraphics,
        minimapFogGraphics: this.minimapFogGraphics,
        minimapUnitGraphics: this.minimapUnitGraphics,
        minimapBuildingGraphics: this.minimapBuildingGraphics
      });

      // Add graphics to the scene
      this.add.existing(this.fogGraphics);
      this.add.existing(this.minimapFogGraphics);
      this.add.existing(this.minimapUnitGraphics);
      this.add.existing(this.minimapBuildingGraphics);
      console.log('Graphics objects added to scene');

      this.gameState = GameState.PLAYING;
      // Note: hud is defined in main.ts, so we'll access it through the scene manager
      this.scene.get('MainScene')?.events.emit('hud-status', 'Game started!');
    }
  }

  createUI(): void {
    // Create container for UI
    this.uiContainer = this.add.container(0, 0);
    
    // Title
    const title = this.add.text(10, 10, 'Shard Dominion', {
      color: '#ffffff',
      fontSize: '20px',
      fontFamily: 'Arial'
    });
    this.uiContainer.add(title);

    // Credits display
    const creditDisplay = this.add.text(10, 30, 'Credits: 0', {
      color: '#ffff00',
      fontSize: '16px',
      fontStyle: 'bold'
    });
    this.uiContainer.add(creditDisplay);
    this.creditDisplay = creditDisplay;

    // Power display
    const powerDisplay = this.add.text(10, 50, 'Power: 0/0', {
      color: '#00ff00',
      fontSize: '16px',
      fontStyle: 'bold'
    });
    this.uiContainer.add(powerDisplay);
    this.powerDisplay = powerDisplay;

    // Production queue display
    const productionDisplay = this.add.text(10, 70, 'Production: none', {
      color: '#00ffff',
      fontSize: '16px',
      fontStyle: 'bold'
    });
    this.uiContainer.add(productionDisplay);
    this.productionDisplay = productionDisplay;

    // Tech display
    const techDisplay = this.add.text(10, 90, 'Tech: 0/3', {
      color: '#ff00ff',
      fontSize: '16px',
      fontStyle: 'bold'
    });
    this.uiContainer.add(techDisplay);
    this.techDisplay = techDisplay;

    // Instructions
    const instructions = this.add.text(10, this.mapHeight * this.tileSize - 50, 'Click: select/move | Right-click: move | Space: produce | B: build mode', {
      color: '#cccccc',
      fontSize: '14px'
    });
    this.uiContainer.add(instructions);

    // Create sidebar
    this.createSidebar();

    // Create minimap
    this.createMinimap();
  }

  createTerrain(): void {
    this.terrain = TerrainGenerator.generateTerrain();
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const color = TerrainGenerator.getTerrainColor(this.terrain[y][x]);
        const graphics = this.add.graphics();
        graphics.fillStyle(color, 1);
        graphics.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize - 1, this.tileSize - 1);
      }
    }

    // Create fog overlay using persistent graphics
    this.updateFog();
  }

  createUnits(): void {
    // No longer using class property for unit graphics

    // Create a few units
    this.units = [
      { id: 'unit1', x: 5, y: 5, type: 'infantry', selected: false, path: [], health: UNIT_TYPES['infantry'].health, currentHealth: UNIT_TYPES['infantry'].health, progress: 0, targetX: 5, targetY: 5, owner: 'player', faction: UNIT_TYPES['infantry'].faction, lastAttackTime: 0 },
      { id: 'unit2', x: 8, y: 3, type: 'scout', selected: false, path: [], health: UNIT_TYPES['scout'].health, currentHealth: UNIT_TYPES['scout'].health, progress: 0, targetX: 8, targetY: 3, owner: 'player', faction: UNIT_TYPES['scout'].faction, lastAttackTime: 0 },
      { id: 'unit3', x: 12, y: 8, type: 'tank', selected: false, path: [], health: UNIT_TYPES['tank'].health, currentHealth: UNIT_TYPES['tank'].health, progress: 0, targetX: 12, targetY: 8, owner: 'player', faction: UNIT_TYPES['tank'].faction, lastAttackTime: 0 }
    ];

    this.updateUnits();
    this.updateFog();
  }
  
  createEconomy(): void {
    // Initialize resource fields
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        if (this.terrain[y][x] === TerrainGenerator.getTerrainType('RESOURCE')) {
          this.resourceFields.push({ x, y });
        }
      }
    }

    // Add a processor and silo near the starting area
    this.processors.push({ x: 3, y: 3 });
    this.silos.push({ x: 5, y: 3 });

    // Add a repair pad
    this.repairPads.push({ x: 7, y: 3, type: 'repair', health: 150, maxHealth: 150, size: 2 });

    // Add a harvester
    this.harvesters.push({
      id: 'harvester1',
      x: 4,
      y: 4,
      type: 'harvester',
      selected: false,
      path: [],
      health: UNIT_TYPES['harvester'].health,
      currentHealth: UNIT_TYPES['harvester'].health,
      progress: 0,
      targetX: 4,
      targetY: 4,
      owner: 'player',
      faction: UNIT_TYPES['harvester'].faction,
      lastAttackTime: 0
    });

    // Add initial construction yard for player
    this.buildings.push({
      x: 3,
      y: 5,
      type: 'construction',
      health: BUILDING_TYPES['construction'].health,
      maxHealth: BUILDING_TYPES['construction'].health,
      foundation: true,
      power: BUILDING_TYPES['construction'].power || 0,
      selected: false,
      size: BUILDING_TYPES['construction'].size
    });

    // Add initial processor for player
    this.buildings.push({
      x: 4,
      y: 5,
      type: 'processor',
      health: BUILDING_TYPES['processor'].health,
      maxHealth: BUILDING_TYPES['processor'].health,
      foundation: true,
      power: BUILDING_TYPES['processor'].power || 0,
      selected: false,
      size: BUILDING_TYPES['processor'].size
    });

    // Add initial power node for player
    this.buildings.push({
      x: 5,
      y: 5,
      type: 'power',
      health: BUILDING_TYPES['power'].health,
      maxHealth: BUILDING_TYPES['power'].health,
      foundation: true,
      power: BUILDING_TYPES['power'].power || 50, // generates power
      selected: false,
      size: BUILDING_TYPES['power'].size,
      id: 'player_construction'
    });

    // Create credit display
    this.creditDisplay = this.add.text(10, 30, 'Credits: 0', {
      color: '#ffff00',
      fontSize: '16px',
      fontStyle: 'bold'
    });

    // Create power display
    this.powerDisplay = this.add.text(10, 50, 'Power: 0/0', {
      color: '#00ff00',
      fontSize: '16px',
      fontStyle: 'bold'
    });

    // Create construction queue display
    this.constructionDisplay = this.add.text(10, 70, 'Queue: 0', {
      color: '#00ffff',
      fontSize: '16px',
      fontStyle: 'bold'
    });

    this.updateCredits();
    this.updatePower();
    this.updateConstructionQueue();

    // Set initial credits
    this.credits = 200;

    // Calculate initial power
    this.calculatePower();
  }

  createSidebar(): void {
    this.sidebar = this.add.container(this.mapWidth * this.tileSize + 10, 10);
    
    // Sidebar background
    const sidebarWidth = 200;
    const sidebarHeight = this.mapHeight * this.tileSize;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x1a1a1a, 0.8);
    graphics.fillRect(0, 0, sidebarWidth, sidebarHeight);
    this.sidebar.add(graphics);
    
    // Title
    this.add.text(10, 10, 'Build Menu', {
      color: '#ffffff',
      fontSize: '16px',
      fontStyle: 'bold'
    }).setOrigin(0);
    
    // Building buttons
    let yOffset = 40;
    const buildingTypes = ['construction', 'processor', 'power', 'foundation'];
    
    for (const buildingType of buildingTypes) {
      const buildingData = BUILDING_TYPES[buildingType];
      if (buildingData) {
        // Button background
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x333333);
        buttonBg.fillRect(10, yOffset, sidebarWidth - 20, 30);
        buttonBg.setInteractive({ useHandCursor: true });
        buttonBg.on('pointerdown', () => {
          if (this.buildMode) {
            this.constructionQueue.push({ type: buildingType, progress: 0 });
            this.updateConstructionQueue();
          }
        });
        this.sidebar.add(buttonBg);
        
        // Building name and cost
        this.add.text(15, yOffset + 8, `${buildingData.name}: ${buildingData.cost}`, {
          color: '#ffffff',
          fontSize: '14px'
        }).setOrigin(0);
        
        // Hotkey
        this.add.text(sidebarWidth - 25, yOffset + 8, String.fromCharCode(65 + buildingTypes.indexOf(buildingType)), {
          color: '#ffff00',
          fontSize: '12px'
        }).setOrigin(1);
        
        yOffset += 35;
      }
    }
    
    // Add some unit buttons too
    this.add.text(10, yOffset + 20, 'Units:', {
      color: '#ffffff',
      fontSize: '16px',
      fontStyle: 'bold'
    }).setOrigin(0);
    
    yOffset += 45;
    const unitTypes = ['infantry', 'scout', 'tank'];
    
    for (const unitType of unitTypes) {
      const unitData = UNIT_TYPES[unitType];
      if (unitData) {
        // Button background
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x333333);
        buttonBg.fillRect(10, yOffset, sidebarWidth - 20, 30);
        buttonBg.setInteractive({ useHandCursor: true });
        buttonBg.on('pointerdown', () => {
          if (this.buildMode) {
            this.constructionQueue.push({ type: unitType, progress: 0 });
            this.updateConstructionQueue();
          }
        });
        this.sidebar.add(buttonBg);
        
        // Unit name and cost
        this.add.text(15, yOffset + 8, `${unitData.name}: ${unitData.cost}`, {
          color: '#ffffff',
          fontSize: '14px'
        }).setOrigin(0);
        
        // Hotkey
        this.add.text(sidebarWidth - 25, yOffset + 8, String.fromCharCode(65 + unitTypes.indexOf(unitType)), {
          color: '#ffff00',
          fontSize: '12px'
        }).setOrigin(1);
        
        yOffset += 35;
      }
    }
  }

  createMinimap(): void {
    this.minimap = this.add.container(this.mapWidth * this.tileSize + 220, 10);

    // Minimap background
    const minimapSize = 150;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x2a2a2a);
    graphics.fillRect(0, 0, minimapSize, minimapSize);
    this.minimap.add(graphics);

    // Title
    this.add.text(minimapSize / 2, 5, 'Map', {
      color: '#ffffff',
      fontSize: '12px',
      align: 'center'
    }).setOrigin(0.5);

    // Minimap will be updated in updateFog()
  }

  updateUnits(): void {
    // Clear and redraw units using persistent graphics
    for (const unit of this.units) {
      // Get or create persistent graphics for this unit
      let unitGraphics = this.unitGraphicsMap.get(unit.id);
      if (!unitGraphics) {
        unitGraphics = this.add.graphics();
        this.unitGraphicsMap.set(unit.id, unitGraphics);
        this.add.existing(unitGraphics);
      }
      
      if (unitGraphics) {
        unitGraphics.clear();
        const color = unit.selected ? 0xffcc00 : 0xffffff;
        unitGraphics.fillStyle(color, 1);
        unitGraphics.fillRect(
          unit.x * this.tileSize + 5,
          unit.y * this.tileSize + 5,
          this.tileSize - 10,
          this.tileSize - 10
        );
        
        // Draw unit type
        unitGraphics.fillStyle(0x000000, 1);
        unitGraphics.fillRect(
          unit.x * this.tileSize + this.tileSize / 2 - 6,
          unit.y * this.tileSize + this.tileSize / 2 - 6,
          12,
          12
        );
        unitGraphics.fillStyle(0xffffff, 1);
        unitGraphics.fillRect(
          unit.x * this.tileSize + this.tileSize / 2 - 4,
          unit.y * this.tileSize + this.tileSize / 2 - 4,
          8,
          8
        );
        
        // Draw health bar
        const healthPercent = unit.currentHealth / unit.health;
        const healthBarWidth = this.tileSize - 10;
        const healthBarHeight = 3;
        const healthBarY = unit.y * this.tileSize - 5;
        
        // Background
        unitGraphics.fillStyle(0x333333, 1);
        unitGraphics.fillRect(unit.x * this.tileSize + 5, healthBarY, healthBarWidth, healthBarHeight);
        
        // Health
        unitGraphics.fillStyle(0x00ff00, 1);
        unitGraphics.fillRect(unit.x * this.tileSize + 5, healthBarY, healthBarWidth * healthPercent, healthBarHeight);
      }
    }
  }
  
  updateCredits(): void {
    this.creditDisplay.setText(`Credits: ${this.credits}`);
  }

  updatePower(): void {
    this.calculatePower();
    this.powerDisplay.setText(`Power: ${this.power}/${this.powerUsage}`);
  }

  calculatePower(): void {
    // Calculate total power generated and used
    this.power = 0;
    this.powerUsage = this.buildings.length * 10; // Each building uses 10 power
    
    // Add power from power nodes
    for (const building of this.buildings) {
      if (building.type === 'power') {
        this.power += 50; // Each power node generates 50 power
      }
    }
  }

  updateConstructionQueue(): void {
      const queueCount = this.constructionQueue.length;
      this.constructionDisplay.setText(`Queue: ${queueCount}`);
    }
  
    updateProductionQueue(): void {
            // Calculate power deficit
            const powerDeficit = this.powerUsage - this.power;
            const powerMultiplier = powerDeficit > 0 ? 0.5 : 1.0; // Slow production by 50% if power deficit
        
            // Complete production units
            for (let i = this.productionQueue.length - 1; i >= 0; i--) {
              const item = this.productionQueue[i];
              item.progress += 0.01 * powerMultiplier; // Production speed affected by power
          
              if (item.progress >= 1) {
                // Complete the unit
                const unitType = item.type as keyof typeof UNIT_TYPES;
                const unitData = UNIT_TYPES[unitType];
            
                if (this.credits >= unitData.cost) {
                  this.credits -= unitData.cost;
              
                  // Find the nearest factory for this unit type
                  const factories = this.buildings.filter(b => 
                    b.type === 'construction' || 
                    b.type === 'starport' || 
                    b.type === 'forge' || 
                    b.type === 'nexus'
                  );
              
                  let nearestFactory = null;
                  let nearestDist = Infinity;
              
                  for (const factory of factories) {
                    const dist = Math.abs(factory.x - (item.spawnX ?? 2)) + Math.abs(factory.y - (item.spawnY ?? 2));
                    if (dist < nearestDist) {
                      nearestDist = dist;
                      nearestFactory = factory;
                    }
                  }
              
                  // If no factory found, spawn at starting area
                  let spawnX = 2, spawnY = 2;
                  let found = false;
              
                  for (let y = 0; y < this.mapHeight && !found; y++) {
                    for (let x = 0; x < this.mapWidth && !found; x++) {
                      if (!this.units.some(u => u.x === x && u.y === y) && 
                          !this.buildings.some(b => b.x === x && b.y === y)) {
                        spawnX = x;
                        spawnY = y;
                        found = true;
                      }
                    }
                  }
              
                  // If factory found, spawn near it
                  if (nearestFactory) {
                    for (let dy = -1; dy <= 1 && !found; dy++) {
                      for (let dx = -1; dx <= 1 && !found; dx++) {
                        const testX = nearestFactory.x + dx;
                        const testY = nearestFactory.y + dy;
                        if (testX >= 0 && testX < this.mapWidth && 
                            testY >= 0 && testY < this.mapHeight &&
                            !this.units.some(u => u.x === testX && u.y === testY) && 
                            !this.buildings.some(b => b.x === testX && b.y === testY)) {
                          spawnX = testX;
                          spawnY = testY;
                          found = true;
                        }
                      }
                    }
                  }
              
                  if (found) {
                    this.units.push({
                      id: `unit${Date.now()}`,
                      x: spawnX,
                      y: spawnY,
                      type: unitType,
                      selected: false,
                      path: [],
                      health: unitData.health,
                      currentHealth: unitData.health,
                      progress: 0,
                      targetX: spawnX,
                      targetY: spawnY,
                      owner: 'player',
                      faction: unitData.faction,
                      lastAttackTime: 0
                    });
                  }
              
                  this.productionQueue.splice(i, 1);
                }
              }
            }
        
            // Update display
            const queueCount = this.productionQueue.length;
            const powerStatus = powerDeficit > 0 ? ` (Power deficit!)` : '';
            this.productionDisplay.setText(`Production: ${queueCount} units${powerStatus}`);
          }

  updateFog(): void {
    // Clear and redraw fog using persistent graphics
    console.log('updateFog called, fogGraphics:', this.fogGraphics);
    if (this.fogGraphics) {
      this.fogGraphics.clear();

      // Reveal fog
      for (let y = 0; y < this.mapHeight; y++) {
        for (let x = 0; x < this.mapWidth; x++) {
          const alpha = this.fogOfWar.getFogAlpha(x, y);
          if (alpha > 0) {
            this.fogGraphics.fillStyle(0x000000, alpha);
            this.fogGraphics.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
          }
        }
      }
    }

    // Update threat managers - spawn visible sprites on trigger
    this.updateThreats();

    // Update minimap
    this.updateMinimap();
  }

  updateThreats(): void {
    // Spawn Titan Worms on trigger
    if (this.titanWormManager.checkSpawn()) {
      const worms = this.titanWormManager.getAllWorms();
      for (const worm of worms) {
        // Create visible sprite for the worm
        const wormGraphics = this.add.graphics();
        wormGraphics.fillStyle(0x8B4513, 1);
        wormGraphics.fillCircle(
          worm.x * this.tileSize + this.tileSize / 2,
          worm.y * this.tileSize + this.tileSize / 2,
          this.tileSize * 2
        );
        this.add.existing(wormGraphics);
        (this as any).wormGraphicsMap = (this as any).wormGraphicsMap || new Map();
        (this as any).wormGraphicsMap.set(worm.id, wormGraphics);
      }
    }

    // Spawn Volatile Blooms on trigger
    if (this.volatileBloomManager.checkSpawn()) {
      const blooms = this.volatileBloomManager.getAllBlooms();
      for (const bloom of blooms) {
        // Create visible sprite for the bloom
        const bloomGraphics = this.add.graphics();
        bloomGraphics.fillStyle(0xFF6B6B, 1);
        bloomGraphics.fillCircle(
          bloom.x * this.tileSize + this.tileSize / 2,
          bloom.y * this.tileSize + this.tileSize / 2,
          this.tileSize
        );
        this.add.existing(bloomGraphics);
        (this as any).bloomGraphicsMap = (this as any).bloomGraphicsMap || new Map();
        (this as any).bloomGraphicsMap.set(bloom.id, bloomGraphics);
      }
    }
  }

  updateMinimap(): void {
    if (!this.minimap) return;

    // Clear previous minimap content (keep background and title)
    const children = this.minimap.list.slice(); // Copy array to avoid modification during iteration
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (child instanceof Phaser.GameObjects.Graphics || child instanceof Phaser.GameObjects.Text) {
        if (child.y > 15) { // Keep title (y <= 15)
          this.minimap.remove(child);
        }
      }
    }

    const minimapSize = 150;
    const tileSize = minimapSize / Math.max(this.mapWidth, this.mapHeight);

    // Draw fog of war on minimap using persistent graphics
    if (this.minimapFogGraphics) {
      this.minimapFogGraphics.clear();
      for (let y = 0; y < this.mapHeight; y++) {
        for (let x = 0; x < this.mapWidth; x++) {
          const alpha = this.fogOfWar.getFogAlpha(x, y);
          if (alpha > 0) {
            this.minimapFogGraphics.fillStyle(0x000000, alpha);
            this.minimapFogGraphics.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          }
        }
      }
      this.minimap.add(this.minimapFogGraphics);
    }

    // Draw units on minimap using persistent graphics
    if (this.minimapUnitGraphics) {
      this.minimapUnitGraphics.clear();
      for (const unit of this.units) {
        this.minimapUnitGraphics.fillStyle(0xffffff);
        this.minimapUnitGraphics.fillRect(
          unit.x * tileSize + tileSize/4,
          unit.y * tileSize + tileSize/4,
          tileSize/2,
          tileSize/2
        );
      }
      this.minimap.add(this.minimapUnitGraphics);
    }

    // Draw buildings on minimap using persistent graphics
    if (this.minimapBuildingGraphics) {
      this.minimapBuildingGraphics.clear();
      for (const building of this.buildings) {
        this.minimapBuildingGraphics.fillStyle(0x00ff00);
        this.minimapBuildingGraphics.fillRect(
          building.x * tileSize + tileSize/3,
          building.y * tileSize + tileSize/3,
          tileSize/3,
          tileSize/3
        );
      }
      this.minimap.add(this.minimapBuildingGraphics);
    }
  }

  setupInput(): void {
    this.input.on('pointerdown', (pointer: any) => {
      if (this.gameState !== GameState.PLAYING) return;

      const worldPos = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tileX = Math.floor(worldPos.x / this.tileSize);
      const tileY = Math.floor(worldPos.y / this.tileSize);

      if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) return;

      // Check if clicking on a unit
      const clickedUnit = this.units.find(unit => unit.x === tileX && unit.y === tileY);

      if (clickedUnit) {
        // Select/deselect unit
        this.units.forEach(unit => unit.selected = false);
        clickedUnit.selected = true;
        this.selectedUnit = clickedUnit;
      } else if (this.selectedUnit) {
        // Move selected unit
        const path = PathFinder.findPathTo(
          this.selectedUnit.x,
          this.selectedUnit.y,
          tileX,
          tileY,
          this.terrain,
          this.buildings
        );
        if (path.length > 0) {
          this.selectedUnit.path = path.slice(1); // Remove starting position
        }
      }

      // Re-render the units to show selection changes
      this.updateUnits();
      this.updateFog();
    });

    // Right-click for context menus
    this.input.on('pointerup', (pointer: any) => {
      if (pointer.rightButtonDown && this.gameState === GameState.PLAYING) {
        const worldPos = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPos.x / this.tileSize);
        const tileY = Math.floor(worldPos.y / this.tileSize);

        if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) return;

        // Find unit at position
        const unitAtPos = this.units.find(unit => unit.x === tileX && unit.y === tileY);
        if (unitAtPos) {
          // Show context menu for unit
          this.showContextMenu(unitAtPos, worldPos.x, worldPos.y);
        }
      }
    });

    // Keyboard input for unit production and groups
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
        // B key for build mode toggle
        if (event.key === 'b' || event.key === 'B') {
          this.buildMode = !this.buildMode;
          this.scene.get('MainScene')?.events.emit('hud-status', this.buildMode ? 'Build mode: ON' : 'Build mode: OFF');
        }
        
        // Space for unit production
        if (event.key === ' ') {
          // Cycle through unit types and add to queue
          const unitTypes = Object.keys(UNIT_TYPES);
          const randomType = unitTypes[Math.floor(Math.random() * unitTypes.length)];
          this.productionQueue.push({ type: randomType, progress: 0 });
          this.updateProductionQueue();
        }
        
        // Ctrl+number for groups
        if (event.ctrlKey && event.key >= '1' && event.key <= '9') {
          const groupId = parseInt(event.key) - 1;
          this.selectGroup(groupId);
        }
      });
    }
  }

  update(deltaTime: number): void {
    if (this.gameState !== GameState.PLAYING) return;

    // Update threat managers
    this.titanWormManager.update(deltaTime);
    this.volatileBloomManager.update(deltaTime);

    // Move units along their paths with pixel-lerp
    for (const unit of this.units) {
      if (unit.path.length > 0) {
        const nextPos = unit.path[0];
        const targetTileX = nextPos.x;
        const targetTileY = nextPos.y;

        // Initialize target if not set
        if (unit.targetX === undefined || unit.targetY === undefined) {
          unit.targetX = targetTileX;
          unit.targetY = targetTileY;
        }

        // Get unit speed from data
        const unitData = UNIT_TYPES[unit.type];
        const speed = unitData ? unitData.speed : 1;

        // Calculate pixel distance
        const pixelX = unit.x * this.tileSize;
        const pixelY = unit.y * this.tileSize;
        const targetPixelX = targetTileX * this.tileSize;
        const targetPixelY = targetTileY * this.tileSize;

        const dx = targetPixelX - pixelX;
        const dy = targetPixelY - pixelY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Move towards target using lerp
        if (distance > 1) {
          const moveAmount = speed * 0.5; // 0.5 is lerp factor
          unit.x += (dx / distance) * moveAmount;
          unit.y += (dy / distance) * moveAmount;
        } else {
          // Arrived at tile
          unit.x = targetTileX;
          unit.y = targetTileY;
          unit.path.shift();
          unit.targetX = undefined;
          unit.targetY = undefined;
        }
      }
    }

    if (this.units.some(unit => unit.path.length > 0)) {
      this.updateUnits();
      this.updateFog();
    }

    // Update fog based on unit positions
    const unitPositions: Position[] = this.units.map(unit => ({ x: unit.x, y: unit.y }));
    this.fogOfWar.updateVision(unitPositions);
    this.updateFog();

    // Update harvester economy
    this.updateHarvesters();

    // Update construction queue
    this.updateConstructionQueue();

    // Update production queue
    this.updateProductionQueue();

    // Update power
    this.updatePower();

    // Update buildings
    this.updateBuildings();

    // Combat system
        this.updateCombat();
    
        // Projectile system
        this.updateProjectiles();
    
        // Repair system
            this.updateRepair();

            // Update AI
            this.updateAI();

            // Update threat managers
            this.titanWormManager.update(0);
            this.volatileBloomManager.update(0);

            // Update tech
            this.updateTech();
          }
  
  updateHarvesters(): void {
    for (const harvester of this.harvesters) {
      // Find nearest resource field
      let nearestResource = null;
      let nearestDist = Infinity;
      
      for (const field of this.resourceFields) {
        const dist = Math.abs(field.x - harvester.x) + Math.abs(field.y - harvester.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestResource = field;
        }
      }
      
      // Find nearest processor
      let nearestProcessor = null;
      let nearestDistProc = Infinity;
      
      for (const proc of this.processors) {
        const dist = Math.abs(proc.x - harvester.x) + Math.abs(proc.y - harvester.y);
        if (dist < nearestDistProc) {
          nearestDistProc = dist;
          nearestProcessor = proc;
        }
      }
      
      // If not carrying and near a resource, gather
      if (!harvester.path.length && nearestResource && nearestDist <= 1) {
        // Gather from resource
        harvester.x = nearestResource.x;
        harvester.y = nearestResource.y;
        this.credits += 10;
        this.updateCredits();
        // Create harvest particles
        this.createParticles(harvester.x, harvester.y, 5, 0xffff00);
      }
      // If carrying and near a processor, deliver
      else if (harvester.path.length === 0 && nearestProcessor && nearestDistProc <= 1) {
        // Deliver to processor
        harvester.x = nearestProcessor.x;
        harvester.y = nearestProcessor.y;
        this.credits += 10;
        this.updateCredits();
      }
      // Move to target
      else if (nearestResource && nearestProcessor) {
        const targetX = harvester.path.length === 0 ? nearestResource.x : nearestProcessor.x;
        const targetY = harvester.path.length === 0 ? nearestResource.y : nearestProcessor.y;
        
        const path = PathFinder.findPathTo(
          harvester.x,
          harvester.y,
          targetX,
          targetY,
          this.terrain,
          this.buildings
        );
        
        if (path.length > 0) {
          harvester.path = path.slice(1);
        }
      }
    }
    
    this.updateUnits();
  }

  tryPlaceBuilding(tileX: number, tileY: number): void {
    // Check if there's a building in the queue
    if (this.constructionQueue.length === 0) {
      return;
    }

    // Get the next building to build
    const buildingType = this.constructionQueue[0].type;

    if (!BUILDING_TYPES[buildingType]) {
      console.error(`Unknown building type: ${buildingType}`);
      return;
    }

    // Check if we have enough credits
    if (this.credits < BUILDING_TYPES[buildingType].cost) {
      console.log('Not enough credits to build');
      return;
    }

    // Check if the tile is valid for placement
    if (!this.isValidPlacement(tileX, tileY, BUILDING_TYPES[buildingType].size)) {
      console.log('Invalid placement');
      return;
    }

    // Check if there's already a building or unit on this tile
    if (this.buildings.some(b => b.x === tileX && b.y === tileY)) {
      console.log('Tile already occupied by a building');
      return;
    }

    if (this.units.some(u => u.x === tileX && u.y === tileY)) {
      console.log('Tile already occupied by a unit');
      return;
    }

    // Deduct credits
    this.credits -= BUILDING_TYPES[buildingType].cost;

    // Add the building
    this.buildings.push({
      x: tileX,
      y: tileY,
      type: buildingType,
      health: BUILDING_TYPES[buildingType].health,
      maxHealth: BUILDING_TYPES[buildingType].health,
      foundation: false,
      power: BUILDING_TYPES[buildingType].power || 0,
      selected: false,
      size: BUILDING_TYPES[buildingType].size,
      id: `building_${Date.now()}_${tileX}_${tileY}`
    });

    // Update displays
    this.updateCredits();
    this.updateBuildings();

    // Remove from queue
    this.constructionQueue.shift();
    this.updateConstructionQueue();
  }

  isValidPlacement(tileX: number, tileY: number, size: number): boolean {
    // Check bounds
    if (tileX < 0 || tileX + size > this.mapWidth || tileY < 0 || tileY + size > this.mapHeight) {
      return false;
    }

    // Check if all tiles are walkable
    for (let y = tileY; y < tileY + size; y++) {
      for (let x = tileX; x < tileX + size; x++) {
        if (this.terrain[y][x] === TerrainGenerator.getTerrainType('STONE')) {
          return false;
        }
      }
    }

    return true;
  }

  updateBuildings(): void {
    // Clear and redraw buildings using persistent graphics
    for (const building of this.buildings) {
      // Get or create persistent graphics for this building
      let buildingGraphics = this.buildingGraphicsMap.get(building.id || '');
      if (!buildingGraphics) {
        buildingGraphics = this.add.graphics();
        this.buildingGraphicsMap.set(building.id || '', buildingGraphics);
        this.add.existing(buildingGraphics);
      }
      
      if (buildingGraphics) {
        buildingGraphics.clear();
        const color = building.selected ? 0xffcc00 : 0x00ff00;
        buildingGraphics.fillStyle(color, 1);
        buildingGraphics.fillRect(
          building.x * this.tileSize,
          building.y * this.tileSize,
          this.tileSize * building.size,
          this.tileSize * building.size
        );
        
        // Draw building name
        buildingGraphics.fillStyle(0x000000, 1);
        buildingGraphics.fillRect(
          building.x * this.tileSize + (this.tileSize * building.size) / 2 - 6,
          building.y * this.tileSize + (this.tileSize * building.size) / 2 - 6,
          12,
          12
        );
        buildingGraphics.fillStyle(0xffffff, 1);
        buildingGraphics.fillRect(
          building.x * this.tileSize + (this.tileSize * building.size) / 2 - 4,
          building.y * this.tileSize + (this.tileSize * building.size) / 2 - 4,
          8,
          8
        );
      }
    }
  }

  showFactionSelect(): void {
    // Create faction select container
    const factionSelectContainer = this.add.container(0, 0);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.9);
    bg.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
    factionSelectContainer.add(bg);

    // Title
    const title = this.add.text(
      this.cameras.main.width / 2,
      100,
      'Select Your Faction',
      {
        color: '#ffffff',
        fontSize: '32px',
        fontStyle: 'bold',
        align: 'center'
      }
    ).setOrigin(0.5);
    factionSelectContainer.add(title);

    // Faction buttons
    const factions = [
      { id: 'vanguard', name: 'Vanguard', color: 0x4488ff, desc: 'Balanced, long-range, air' },
      { id: 'forge', name: 'Forge', color: 0xff4444, desc: 'Heavy, brute force' },
      { id: 'phantom', name: 'Phantom', color: 0x44ff44, desc: 'Speed, stealth, disruption' }
    ];

    const buttonWidth = 200;
    const buttonHeight = 60;
    const startY = 200;
    const gap = 20;

    factions.forEach((faction, index) => {
      const x = this.cameras.main.width / 2 - buttonWidth / 2;
      const y = startY + index * (buttonHeight + gap);

      // Button background
      const buttonBg = this.add.graphics();
      buttonBg.fillStyle(faction.color, 1);
      buttonBg.fillRect(x, y, buttonWidth, buttonHeight);
      buttonBg.setInteractive({ useHandCursor: true });
      buttonBg.on('pointerdown', () => {
        this.selectFaction(faction.id);
      });
      factionSelectContainer.add(buttonBg);

      // Faction name
      const nameText = this.add.text(
        x + buttonWidth / 2,
        y + buttonHeight / 2 - 10,
        faction.name,
        {
          color: '#ffffff',
          fontSize: '20px',
          fontStyle: 'bold',
          align: 'center'
        }
      ).setOrigin(0.5);
      factionSelectContainer.add(nameText);

      // Faction description
      const descText = this.add.text(
        x + buttonWidth / 2,
        y + buttonHeight / 2 + 15,
        faction.desc,
        {
          color: '#cccccc',
          fontSize: '14px',
          align: 'center'
        }
      ).setOrigin(0.5);
      factionSelectContainer.add(descText);
    });

    // Store the container for cleanup
    (this as any).factionSelectContainer = factionSelectContainer;
  }

  selectFaction(factionId: string): void {
    // Remove faction select screen
    if ((this as any).factionSelectContainer) {
      (this as any).factionSelectContainer.destroy();
      delete (this as any).factionSelectContainer;
    }

    // Set AI faction
    switch (factionId) {
      case 'vanguard':
        this.aiFaction = Faction.VANGUARD;
        break;
      case 'forge':
        this.aiFaction = Faction.FORGE;
        break;
      case 'phantom':
        this.aiFaction = Faction.PHANTOM;
        break;
    }

    // Start the game
    this.createUI();
    this.createAI();
    this.createTerrain();
    this.createUnits();
    this.createEconomy();
    this.setupInput();

    // Initialize persistent graphics objects
    console.log('Creating graphics objects...');
    this.fogGraphics = this.add.graphics();
    this.minimapFogGraphics = this.add.graphics();
    this.minimapUnitGraphics = this.add.graphics();
    this.minimapBuildingGraphics = this.add.graphics();
    console.log('Graphics objects created:', {
      fogGraphics: this.fogGraphics,
      minimapFogGraphics: this.minimapFogGraphics,
      minimapUnitGraphics: this.minimapUnitGraphics,
      minimapBuildingGraphics: this.minimapBuildingGraphics
    });

    // Add graphics to the scene
    this.add.existing(this.fogGraphics);
    this.add.existing(this.minimapFogGraphics);
    this.add.existing(this.minimapUnitGraphics);
    this.add.existing(this.minimapBuildingGraphics);
    console.log('Graphics objects added to scene');

    this.gameState = GameState.PLAYING;
    this.scene.get('MainScene')?.events.emit('hud-status', 'Game started!');
  }

  handleClick(_pointer: any = {}): void {
    if (this.gameState === GameState.MENU) {
      this.gameState = GameState.PLAYING;
    }
  }

  createAI(): void {
    // Initialize AI manager
    const aiConfig: AIConfig = {
      faction: this.aiFaction,
      difficulty: this.aiDifficulty,
      startingResources: this.aiCredits,
      aggression: 0.5,
      economyFocus: 0.5,
      techFocus: 0.3
    };

    this.ai = new SkirmishAI(aiConfig);
    
    // Add AI construction yard
    this.buildings.push({
      x: this.mapWidth - 8,
      y: this.mapHeight - 8,
      type: 'construction',
      health: BUILDING_TYPES['construction'].health,
      maxHealth: BUILDING_TYPES['construction'].health,
      foundation: true,
      power: BUILDING_TYPES['construction'].power || 0,
      selected: false,
      size: BUILDING_TYPES['construction'].size,
      id: 'ai_construction'
    });
    
    // Add AI processor
    this.buildings.push({
      x: this.mapWidth - 7,
      y: this.mapHeight - 8,
      type: 'processor',
      health: BUILDING_TYPES['processor'].health,
      maxHealth: BUILDING_TYPES['processor'].health,
      foundation: true,
      power: BUILDING_TYPES['processor'].power || 0,
      selected: false,
      size: BUILDING_TYPES['processor'].size
    });
    
    // Give AI some starting units
    this.units.push({
      id: 'ai_unit1',
      x: this.mapWidth - 10,
      y: this.mapHeight - 8,
      type: 'scout',
      selected: false,
      path: [],
      health: UNIT_TYPES['scout'].health,
      currentHealth: UNIT_TYPES['scout'].health,
      progress: 0,
      targetX: this.mapWidth - 10,
      targetY: this.mapHeight - 8,
      owner: 'ai',
      faction: UNIT_TYPES['scout'].faction,
      lastAttackTime: 0
    });
    
    // Give AI credits
    this.credits += 200; // Start with same resources
    this.updateCredits();
  }

  updateCombat(): void {
    // Simple combat: check if units are in range and attack
    for (let i = 0; i < this.units.length; i++) {
      const unit1 = this.units[i];
      const unitType1 = UNIT_TYPES[unit1.type];
      
      // Skip if unit is dead
      if (unit1.currentHealth <= 0) continue;
      
      // Find enemies in range
      for (let j = 0; j < this.units.length; j++) {
        if (i === j) continue; // Skip self
        
        const unit2 = this.units[j];
        if (unit1.type === unit2.type) continue; // Skip same type for now
        
        // Skip if either unit is dead
        if (unit2.currentHealth <= 0) continue;
        
        // Only attack enemies (different owner)
        if (unit1.owner === unit2.owner) continue;
        
        const distance = Math.abs(unit1.x - unit2.x) + Math.abs(unit1.y - unit2.y);
        
        // Check if in range
        if (distance <= unitType1.range) {
          // Check cooldown
          const now = Date.now();
          const cooldown = (unitType1 as any).cooldown || 1000; // Default 1 second
          if (now - unit1.lastAttackTime < cooldown) continue;

          // Create projectile
          this.createProjectile(unit1, unit2, unitType1.attack);
          // Create attack particles
          this.createParticles(unit1.x, unit1.y, 3, 0xff0000);

          // Update cooldown
          unit1.lastAttackTime = now;
        }
      }
    }
  }
  
  createProjectile(attacker: Unit, target: Unit, damage: number): void {
    // Create projectile graphics
    const projectileGraphics = this.add.graphics();
    projectileGraphics.fillStyle(0xff0000, 1);
    projectileGraphics.fillCircle(0, 0, 3);
    this.add.existing(projectileGraphics);

    // Add to projectiles array
    this.projectiles.push({
      id: `proj${Date.now()}`,
      x: attacker.x,
      y: attacker.y,
      targetX: target.x,
      targetY: target.y,
      speed: 0.5, // Speed in tiles per frame
      damage: damage,
      owner: attacker.owner,
      type: attacker.type,
      graphics: projectileGraphics
    });
  }

  // Damage flash effect
  createDamageFlash(x: number, y: number, color: number = 0xff0000): void {
    const flash = this.add.graphics();
    flash.fillStyle(color, 1);
    flash.fillCircle(x * this.tileSize + this.tileSize / 2, y * this.tileSize + this.tileSize / 2, this.tileSize / 2);
    this.add.existing(flash);

    // Animate and destroy
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: 200,
      onComplete: () => flash.destroy()
    });
  }

  // Particle effect for harvest/combat
  createParticles(x: number, y: number, count: number, color: number = 0xffff00): void {
    for (let i = 0; i < count; i++) {
      const particle = this.add.graphics();
      particle.fillStyle(color, 1);
      const size = Math.random() * 3 + 1;
      particle.fillCircle(
        x * this.tileSize + this.tileSize / 2 + (Math.random() - 0.5) * this.tileSize,
        y * this.tileSize + this.tileSize / 2 + (Math.random() - 0.5) * this.tileSize,
        size
      );
      this.add.existing(particle);

      // Animate and destroy
      this.tweens.add({
        targets: particle,
        alpha: 0,
        x: particle.x + (Math.random() - 0.5) * 20,
        y: particle.y + (Math.random() - 0.5) * 20,
        duration: 500 + Math.random() * 500,
        onComplete: () => particle.destroy()
      });
    }
  }
  
  updateProjectiles(): void {
    // Update each projectile
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      
      // Calculate direction to target
      const dx = proj.targetX - proj.x;
      const dy = proj.targetY - proj.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Check if reached target
      if (distance < 0.1) {
        // Hit! Deal damage to target
        const target = this.units.find(u => u.x === proj.targetX && u.y === proj.targetY);
        if (target && target.owner !== proj.owner) {
          target.currentHealth = Math.max(0, target.currentHealth - proj.damage);

          // Create damage flash effect
          this.createDamageFlash(target.x, target.y, 0xff0000);

          // Update display if target is visible
          if (target.currentHealth < UNIT_TYPES[target.type].health) {
            this.updateUnits();
          }

          // Check if target died
          if (target.currentHealth <= 0) {
            // Remove target unit
            const targetIndex = this.units.indexOf(target);
            if (targetIndex > -1) {
              this.units.splice(targetIndex, 1);
              
              // Destroy persistent graphics
              const targetGraphics = this.unitGraphicsMap.get(target.id);
              if (targetGraphics) {
                targetGraphics.destroy();
                this.unitGraphicsMap.delete(target.id);
              }
            }
          }
        }
        
        // Destroy projectile
        proj.graphics.destroy();
        this.projectiles.splice(i, 1);
      } else {
        // Move towards target
        const moveX = (dx / distance) * proj.speed;
        const moveY = (dy / distance) * proj.speed;
        proj.x += moveX;
        proj.y += moveY;
        
        // Update graphics position
        proj.graphics.clear();
        proj.graphics.fillStyle(0xff0000, 1);
        proj.graphics.fillCircle(
          proj.x * this.tileSize,
          proj.y * this.tileSize,
          3
        );
      }
    }
  }

  showContextMenu(unit: Unit, x: number, y: number): void {
    const menuWidth = 120;
    const menuHeight = 100;
    const menuX = Math.min(x, this.cameras.main.width - menuWidth - 10);
    const menuY = Math.min(y, this.cameras.main.height - menuHeight - 10);
    
    const menuGraphics = this.add.graphics();
    menuGraphics.fillStyle(0x333333);
    menuGraphics.lineStyle(2, 0xffffff);
    menuGraphics.strokeRect(menuX, menuY, menuWidth, menuHeight);
    menuGraphics.fillRect(menuX, menuY, menuWidth, menuHeight);
    
    const unitType = UNIT_TYPES[unit.type];
    
    // Unit name and HP
    this.add.text(menuX + 5, menuY + 5, unitType.name, {
      color: '#ffffff',
      fontSize: '14px'
    });
    
    this.add.text(menuX + 5, menuY + 25, `HP: ${unit.currentHealth}/${unit.health}`, {
      color: '#00ff00',
      fontSize: '12px'
    });
    
    // Order buttons
    const orders = ['Move', 'Attack', 'Stop'];
    let yOffset = 45;
    
    for (const order of orders) {
      // Button background
      const buttonBg = this.add.graphics();
      buttonBg.fillStyle(0x444444);
      buttonBg.fillRect(menuX + 5, menuY + yOffset, menuWidth - 10, 20);
      
      // Order text
      this.add.text(menuX + 10, menuY + yOffset + 6, order, {
        color: '#ffffff',
        fontSize: '12px'
      });
      
      yOffset += 22;
    }
    
    // Store the menu graphics for interaction
    (menuGraphics as any).orders = orders;
    (menuGraphics as any).unit = unit;
    (menuGraphics as any).menuX = menuX;
    (menuGraphics as any).menuY = menuY;
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
      menuGraphics.destroy();
    }, 4000);
  }

  updateRepair(): void {
    // Simple repair system: damaged units near repair pads get healed
    for (const unit of this.units) {
      if (unit.currentHealth < unit.health) {
        // Find nearest repair pad
        let nearestRepairPad = null;
        let nearestDist = Infinity;
        
        for (const pad of this.repairPads) {
          const dist = Math.abs(pad.x - unit.x) + Math.abs(pad.y - unit.y);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestRepairPad = pad;
          }
        }
        
        // If near repair pad, heal
        if (nearestRepairPad && nearestDist <= 1) {
          unit.currentHealth = Math.min(unit.health, unit.currentHealth + 1);
        }
      }
    }
    
    this.updateUnits(); // Redraw to show health changes
  }

  updateAI(): void {
    // Update AI if it exists
    if (this.ai) {
      const aiUnits = this.units.filter(u => u.id.startsWith('ai_')).map(u => ({
        id: u.id,
        x: u.x,
        y: u.y,
        type: u.type,
        selected: false,
        path: u.path,
        health: u.health,
        currentHealth: u.currentHealth
      }));

      const playerUnits = this.units.filter(u => !u.id.startsWith('ai_')).map(u => ({
        id: u.id,
        x: u.x,
        y: u.y,
        type: u.type,
        selected: false,
        path: u.path,
        health: u.health,
        currentHealth: u.currentHealth
      }));

      this.ai.update(this.credits, playerUnits.map(u => u.type), aiUnits.map(u => u.type));

      // Execute AI decisions
      const decision = this.ai.getDecision();

      // Simple AI execution based on decision
      if (decision === 'build_harvester' && this.ai.getResources() >= UNIT_TYPES.harvester.cost) {
        // Find nearest processor
        let nearestProcessor = null;
        let nearestDist = Infinity;
        for (const proc of this.processors) {
          const dist = Math.abs(proc.x - 8) + Math.abs(proc.y - 8);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestProcessor = proc;
          }
        }
        if (nearestProcessor) {
          this.ai.produceUnit(this, 'harvester', nearestProcessor.x, nearestProcessor.y);
        }
      } else if (decision === 'build_tank' && this.ai.getResources() >= UNIT_TYPES.tank.cost) {
        // Find nearest construction yard
        let nearestFactory = null;
        let nearestDist = Infinity;
        for (const factory of this.buildings) {
          if (factory.type === 'construction' && factory.id === 'ai_construction') {
            const dist = Math.abs(factory.x - 8) + Math.abs(factory.y - 8);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestFactory = factory;
            }
          }
        }
        if (nearestFactory) {
          this.ai.produceUnit(this, 'tank', nearestFactory.x, nearestFactory.y);
        }
      } else if (decision === 'attack' && aiUnits.length > 0) {
        let nearestTarget = null;
        let nearestDist = Infinity;
        for (const playerUnit of playerUnits) {
          const dist = Math.abs(playerUnit.x - 8) + Math.abs(playerUnit.y - 8);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestTarget = playerUnit;
          }
        }
        if (nearestTarget) {
          // Find nearest AI unit to send
          let nearestAttacker = null;
          let nearestDistAttacker = Infinity;
          for (const aiUnit of aiUnits) {
            const dist = Math.abs(aiUnit.x - 8) + Math.abs(aiUnit.y - 8);
            if (dist < nearestDistAttacker) {
              nearestDistAttacker = dist;
              nearestAttacker = aiUnit;
            }
          }
          if (nearestAttacker) {
            this.ai.attackUnit(this, nearestAttacker.id, nearestTarget.x, nearestTarget.y);
          }
        }
      }
    }

    // Check win condition
    this.checkWinCondition();
  }

  updateTech(): void {
    // Check for research labs and unlock advanced units
    const hasResearchLab = this.buildings.some(b => b.type === 'researchLab');

    if (hasResearchLab) {
      // Unlock advanced units (e.g., sonic_area, behemoth, siege)
      // This is a simple implementation - in a full game, this would be more sophisticated
      const advancedUnits = ['sonic_area', 'behemoth', 'siege'];
      for (const unitType of advancedUnits) {
        if (UNIT_TYPES[unitType]) {
          UNIT_TYPES[unitType].unlocked = true;
        }
      }
      this.techDisplay.setText('Tech: 3/3');
    } else {
      // Lock advanced units
      const advancedUnits = ['sonic_area', 'behemoth', 'siege'];
      for (const unitType of advancedUnits) {
        if (UNIT_TYPES[unitType]) {
          UNIT_TYPES[unitType].unlocked = false;
        }
      }
      this.techDisplay.setText('Tech: 0/3');
    }
  }

  checkWinCondition(): void {
    // Find all construction yards
    const playerConYards = this.buildings.filter(b => b.type === 'construction' && !b.id?.startsWith?.('ai_'));
    const aiConYards = this.buildings.filter(b => b.type === 'construction' && b.id?.startsWith?.('ai_'));

    // Check if player has no construction yards
    if (playerConYards.length === 0 && this.buildings.some(b => b.type === 'construction')) {
      console.log('AI wins!');
      this.gameState = GameState.GAME_OVER;
      this.showGameOver('AI Victory!');
      return;
    }

    // Check if AI has no construction yards
    if (aiConYards.length === 0 && this.buildings.some(b => b.type === 'construction')) {
      console.log('Player wins!');
      this.gameState = GameState.GAME_OVER;
      this.showGameOver('Player Victory!');
      return;
    }

    // Campaign objectives
    const objectives = this.getCampaignObjectives();
    for (const objective of objectives) {
      if (objective.completed) continue;

      switch (objective.type) {
        case 'destroy_ai_construction':
          if (aiConYards.length === 0) {
            objective.completed = true;
            this.showObjectiveComplete(objective);
          }
          break;
        case 'build_10_units':
          if (this.units.length >= 10) {
            objective.completed = true;
            this.showObjectiveComplete(objective);
          }
          break;
        case 'survive_5_minutes':
          if (Date.now() - this.gameStartTime > 5 * 60 * 1000) {
            objective.completed = true;
            this.showObjectiveComplete(objective);
          }
          break;
        case 'destroy_titan_worms':
          const worms = this.titanWormManager.getWorms();
          if (worms.length === 0) {
            objective.completed = true;
            this.showObjectiveComplete(objective);
          }
          break;
        case 'destroy_blooms':
          const blooms = this.volatileBloomManager.getBlooms();
          if (blooms.length === 0) {
            objective.completed = true;
            this.showObjectiveComplete(objective);
          }
          break;
      }
    }
  }

  getCampaignObjectives(): Array<{ type: string; description: string; completed: boolean }> {
    return [
      { type: 'destroy_ai_construction', description: 'Destroy AI Construction Yard', completed: false },
      { type: 'build_10_units', description: 'Build 10 Units', completed: false },
      { type: 'survive_5_minutes', description: 'Survive 5 Minutes', completed: false },
      { type: 'destroy_titan_worms', description: 'Destroy 2 Titan Worms', completed: false },
      { type: 'destroy_blooms', description: 'Destroy 5 Volatile Blooms', completed: false }
    ];
  }

  showObjectiveComplete(objective: { type: string; description: string; completed: boolean }): void {
    // Show objective complete message
    const message = `Objective Complete: ${objective.description}`;
    console.log(message);
    this.scene.get('MainScene')?.events.emit('hud-status', message);
  }

  showGameOver(message: string): void {
    // Show game over screen
    const gameOverContainer = this.add.container(0, 0);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.9);
    bg.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
    gameOverContainer.add(bg);

    // Game over text
    const gameOverText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 50,
      message,
      {
        color: '#ffffff',
        fontSize: '48px',
        fontStyle: 'bold',
        align: 'center'
      }
    ).setOrigin(0.5);
    gameOverContainer.add(gameOverText);

    // Restart button
    const restartButton = this.add.graphics();
    restartButton.fillStyle(0x4488ff, 1);
    restartButton.fillRect(
      this.cameras.main.width / 2 - 100,
      this.cameras.main.height / 2 + 50,
      200,
      50
    );
    restartButton.setInteractive({ useHandCursor: true });
    restartButton.on('pointerdown', () => {
      this.restartGame();
    });
    gameOverContainer.add(restartButton);

    const restartText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 75,
      'Restart',
      {
        color: '#ffffff',
        fontSize: '20px',
        align: 'center'
      }
    ).setOrigin(0.5);
    gameOverContainer.add(restartText);

    // Store the container for cleanup
    (this as any).gameOverContainer = gameOverContainer;
  }

  restartGame(): void {
    // Remove game over screen
    if ((this as any).gameOverContainer) {
      (this as any).gameOverContainer.destroy();
      delete (this as any).gameOverContainer;
    }

    // Reset game state
    this.gameState = GameState.MENU;
    this.units = [];
    this.buildings = [];
    this.credits = 0;
    this.power = 0;
    this.powerUsage = 0;
    this.harvesters = [];
    this.resourceFields = [];
    this.processors = [];
    this.silos = [];
    this.repairPads = [];
    this.constructionQueue = [];
    this.productionQueue = [];
    this.fogOfWar.reset();
    this.titanWormManager.reset();
    this.volatileBloomManager.reset();

    // Clear graphics
    if (this.fogGraphics) this.fogGraphics.clear();
    if (this.minimapFogGraphics) this.minimapFogGraphics.clear();
    if (this.minimapUnitGraphics) this.minimapUnitGraphics.clear();
    if (this.minimapBuildingGraphics) this.minimapBuildingGraphics.clear();
    if ((this as any).wormGraphicsMap) {
      (this as any).wormGraphicsMap.forEach((graphics: any) => graphics.destroy());
      (this as any).wormGraphicsMap.clear();
    }
    if ((this as any).bloomGraphicsMap) {
      (this as any).bloomGraphicsMap.forEach((graphics: any) => graphics.destroy());
      (this as any).bloomGraphicsMap.clear();
    }

    // Reset game start time
    this.gameStartTime = Date.now();

    // Show faction select screen
    this.showFactionSelect();
  }

  selectGroup(groupId: number): void {
    // Select units in the specified group (simple implementation)
    // For now, just select/deselect based on current selection state
    if (this.units.some(unit => unit.selected)) {
      // If any unit is selected, deselect all
      this.units.forEach(unit => unit.selected = false);
    } else {
      // If no units are selected, select all units of the same type as the first unit
      if (this.units.length > 0) {
        const firstUnitType = this.units[0].type;
        this.units.forEach(unit => {
          if (unit.type === firstUnitType) {
            unit.selected = true;
          }
        });
      }
    }
    // Store the group ID for future use
    console.log(`Selected group ${groupId + 1}`);
    this.updateUnits();
  }
}