import { Scene } from 'phaser';
import type { Position } from '../types';
import { GameState } from '../types';
import { TerrainGenerator } from '../utils/terrain';
import { PathFinder } from '../utils/pathfinding';
import { FogOfWar } from '../utils/fog';
import { UNIT_TYPES, BUILDING_TYPES } from '../data';

interface Unit {
  id: string;
  x: number;
  y: number;
  type: keyof typeof UNIT_TYPES;
  selected: boolean;
  path: { x: number; y: number }[];
  health: number;
  currentHealth: number;
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
  
  // Economy
  private credits: number = 0;
  private harvesters: Unit[] = [];
  private resourceFields: { x: number; y: number }[] = [];
  private processors: { x: number; y: number }[] = [];
  private silos: { x: number; y: number }[] = [];
  private creditDisplay!: any;

  // Base Building
  private buildings: { x: number; y: number; type: string; health: number; maxHealth: number; foundation: boolean; power: number; selected: boolean; size: number }[] = [];
  private power: number = 0;
  private powerUsage: number = 0;
  private powerDisplay!: any;
  private constructionQueue: { type: string; progress: number }[] = [];
  private productionQueue: { type: string; progress: number }[] = [];
  private constructionDisplay!: any;
  private productionDisplay!: any;

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
  }

  preload(): void {
    // No assets yet
  }

  create(): void {
    this.createUI();
    this.createTerrain();
    this.createUnits();
    this.createEconomy();
    this.setupInput();
    
    this.gameState = GameState.PLAYING;
    // Note: hud is defined in main.ts, so we'll access it through the scene manager
    this.scene.get('GameScene')?.events.emit('hud-status', 'Game started!');
  }

  createUI(): void {
    // Title
    this.add.text(10, 10, 'Shard Dominion', {
      color: '#ffffff',
      fontSize: '20px'
    });

    // Credits display
    this.creditDisplay = this.add.text(10, 30, 'Credits: 0', {
      color: '#ffff00',
      fontSize: '16px',
      fontStyle: 'bold'
    });

    // Instructions
    this.add.text(10, this.mapHeight * this.tileSize - 30, 'Click units to select, right-click to move, space to build', {
      color: '#cccccc',
      fontSize: '14px'
    });

    // Production queue display
    this.productionDisplay = this.add.text(10, 50, 'Production: infantry (50)', {
      color: '#00ffff',
      fontSize: '16px',
      fontStyle: 'bold'
    });
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

    // Create fog overlay
    this.updateFog();
  }

  createUnits(): void {
    // No longer using class property for unit graphics
    
    // Create a few units
    this.units = [
      { id: 'unit1', x: 5, y: 5, type: 'infantry', selected: false, path: [], health: UNIT_TYPES['infantry'].health, currentHealth: UNIT_TYPES['infantry'].health },
      { id: 'unit2', x: 8, y: 3, type: 'scout', selected: false, path: [], health: UNIT_TYPES['scout'].health, currentHealth: UNIT_TYPES['scout'].health },
      { id: 'unit3', x: 12, y: 8, type: 'tank', selected: false, path: [], health: UNIT_TYPES['tank'].health, currentHealth: UNIT_TYPES['tank'].health }
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

    // Add a harvester
    this.harvesters.push({ 
      id: 'harvester1', 
      x: 4, 
      y: 4, 
      type: 'harvester', 
      selected: false, 
      path: [], 
      health: UNIT_TYPES['harvester'].health, 
      currentHealth: UNIT_TYPES['harvester'].health 
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
  }

  updateUnits(): void {
    // Clear and redraw units
    for (const unit of this.units) {
      const color = unit.selected ? 0xffcc00 : 0xffffff;
      const graphics = this.add.graphics();
      graphics.clear();
      graphics.fillStyle(color, 1);
      graphics.fillRect(
        unit.x * this.tileSize + 5,
        unit.y * this.tileSize + 5,
        this.tileSize - 10,
        this.tileSize - 10
      );
      
      // Draw unit type
      const unitType = UNIT_TYPES[unit.type];
      this.add.text(
        unit.x * this.tileSize + this.tileSize / 2,
        unit.y * this.tileSize + this.tileSize / 2,
        unitType.name.charAt(0),
        { color: '#000000', fontSize: '12px', align: 'center' }
      ).setOrigin(0.5);
      
      // Draw health bar
      const healthPercent = unit.currentHealth / unit.health;
      const healthBarWidth = this.tileSize - 10;
      const healthBarHeight = 3;
      const healthBarY = unit.y * this.tileSize - 5;
      
      // Background
      graphics.fillStyle(0x333333, 1);
      graphics.fillRect(unit.x * this.tileSize + 5, healthBarY, healthBarWidth, healthBarHeight);
      
      // Health
      graphics.fillStyle(0x00ff00, 1);
      graphics.fillRect(unit.x * this.tileSize + 5, healthBarY, healthBarWidth * healthPercent, healthBarHeight);
    }
  }
  
  updateCredits(): void {
    this.creditDisplay.setText(`Credits: ${this.credits}`);
  }

  updatePower(): void {
    this.powerDisplay.setText(`Power: ${this.power}/${this.powerUsage}`);
  }

  updateConstructionQueue(): void {
    const queueCount = this.constructionQueue.length;
    this.constructionDisplay.setText(`Queue: ${queueCount}`);
  }

  updateProductionQueue(): void {
    // Complete production units
    for (let i = this.productionQueue.length - 1; i >= 0; i--) {
      const item = this.productionQueue[i];
      item.progress += 0.01; // Production speed
      
      if (item.progress >= 1) {
        // Complete the unit
        const unitType = item.type as keyof typeof UNIT_TYPES;
        const unitData = UNIT_TYPES[unitType];
        
        if (this.credits >= unitData.cost) {
          this.credits -= unitData.cost;
          
          // Find a free spot near the starting area
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
          
          if (found) {
            this.units.push({
              id: `unit${Date.now()}`,
              x: spawnX,
              y: spawnY,
              type: unitType,
              selected: false,
              path: [],
              health: unitData.health,
              currentHealth: unitData.health
            });
          }
          
          this.productionQueue.splice(i, 1);
        }
      }
    }
    
    // Update display
    const queueCount = this.productionQueue.length;
    this.productionDisplay.setText(`Production: ${queueCount} units`);
  }

  updateFog(): void {
    const fogGraphics = this.add.graphics();
    fogGraphics.clear();
    
    // Reveal fog
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const alpha = this.fogOfWar.getFogAlpha(x, y);
        if (alpha > 0) {
          fogGraphics.fillStyle(0x000000, alpha);
          fogGraphics.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        }
      }
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
          this.terrain
        );

        if (path.length > 0) {
          this.selectedUnit.path = path.slice(1); // Remove starting position
        }
      }

      // Re-render the units to show selection changes
      this.updateUnits();
      this.updateFog();
    });

    // Building placement input
    this.input.on('pointerup', (pointer: any) => {
      if (this.gameState !== GameState.PLAYING) return;

      const worldPos = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tileX = Math.floor(worldPos.x / this.tileSize);
      const tileY = Math.floor(worldPos.y / this.tileSize);

      if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) return;

      // Check if clicking on a building
      const clickedBuilding = this.buildings.find(b => b.x === tileX && b.y === tileY);

      if (clickedBuilding) {
        // Select/deselect building
        this.buildings.forEach(b => b.selected = false);
        clickedBuilding.selected = true;
      } else {
        // Try to place a building
        this.tryPlaceBuilding(tileX, tileY);
      }
    });

    // Keyboard input for unit production
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
        if (event.key === ' ') {
          // Cycle through unit types and add to queue
          const unitTypes = Object.keys(UNIT_TYPES);
          const randomType = unitTypes[Math.floor(Math.random() * unitTypes.length)];
          this.productionQueue.push({ type: randomType, progress: 0 });
          this.updateProductionQueue();
        }
      });
    }
  }

  update(): void {
    if (this.gameState !== GameState.PLAYING) return;

    // Move units along their paths
    for (const unit of this.units) {
      if (unit.path.length > 0) {
        const nextPos = unit.path[0];
        unit.x = nextPos.x;
        unit.y = nextPos.y;
        unit.path.shift();
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
          this.terrain
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
    const buildingData = BUILDING_TYPES[buildingType];

    if (!buildingData) {
      console.error(`Unknown building type: ${buildingType}`);
      return;
    }

    // Check if we have enough credits
    if (this.credits < buildingData.cost) {
      console.log('Not enough credits to build');
      return;
    }

    // Check if the tile is valid for placement
    if (!this.isValidPlacement(tileX, tileY, buildingData.size)) {
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
    this.credits -= buildingData.cost;

    // Add the building
    this.buildings.push({
      x: tileX,
      y: tileY,
      type: buildingType,
      health: buildingData.health,
      maxHealth: buildingData.health,
      foundation: false,
      power: buildingData.power || 0,
      selected: false,
      size: buildingData.size
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
    // Clear and redraw buildings
    for (const building of this.buildings) {
      const color = building.selected ? 0xffcc00 : 0x00ff00;
      const graphics = this.add.graphics();
      graphics.clear();
      graphics.fillStyle(color, 1);
      graphics.fillRect(
        building.x * this.tileSize,
        building.y * this.tileSize,
        this.tileSize * building.size,
        this.tileSize * building.size
      );

      // Draw building name
      const buildingType = BUILDING_TYPES[building.type];
      this.add.text(
        building.x * this.tileSize + (this.tileSize * building.size) / 2,
        building.y * this.tileSize + (this.tileSize * building.size) / 2,
        buildingType.name.charAt(0),
        { color: '#000000', fontSize: '12px', align: 'center' }
      ).setOrigin(0.5);
    }
  }

  handleClick(_pointer: any = {}): void {
    if (this.gameState === GameState.MENU) {
      this.gameState = GameState.PLAYING;
    }
  }

  updateCombat(): void {
    // Simple combat: check if units are in range and attack
    for (let i = 0; i < this.units.length; i++) {
      const unit1 = this.units[i];
      const unitType1 = UNIT_TYPES[unit1.type];
      
      // Find enemies in range
      for (let j = 0; j < this.units.length; j++) {
        if (i === j) continue; // Skip self
        
        const unit2 = this.units[j];
        if (unit1.type === unit2.type) continue; // Skip same type for now
        
        const unitType2 = UNIT_TYPES[unit2.type];
        const distance = Math.abs(unit1.x - unit2.x) + Math.abs(unit1.y - unit2.y);
        
        // Check if in range
        if (distance <= unitType1.range) {
          // Attack!
          const damage = Math.max(1, unitType1.attack - unitType2.armor);
          unit2.currentHealth = Math.max(0, unit2.currentHealth - damage);
          
          // Show damage briefly
          if (unit2.currentHealth < unitType2.health) {
            this.updateUnits(); // Redraw to show health changes
          }
          
          // Check if unit died
          if (unit2.currentHealth <= 0) {
            this.units.splice(j, 1);
            j--; // Adjust index since we removed an element
          }
        }
      }
    }
  }
}