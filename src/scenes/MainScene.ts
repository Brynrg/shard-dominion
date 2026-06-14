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
  private repairPads: { x: number; y: number; type: string; health: number; maxHealth: number; size: number }[] = [];
  private power: number = 0;
  private powerUsage: number = 0;
  private powerDisplay!: any;
  private constructionQueue: { type: string; progress: number }[] = [];
  private productionQueue: { type: string; progress: number }[] = [];
  private constructionDisplay!: any;
  private productionDisplay!: any;
  private uiContainer!: Phaser.GameObjects.Container;
  private sidebar!: Phaser.GameObjects.Container;
  private minimap!: Phaser.GameObjects.Container;

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

    // Update minimap
    this.updateMinimap();
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

    // Draw fog of war on minimap
    const fogGraphics = this.add.graphics();
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const alpha = this.fogOfWar.getFogAlpha(x, y);
        if (alpha > 0) {
          fogGraphics.fillStyle(0x000000, alpha);
          fogGraphics.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
    }
    this.minimap.add(fogGraphics);

    // Draw units on minimap
    const unitGraphics = this.add.graphics();
    for (const unit of this.units) {
      unitGraphics.fillStyle(0xffffff);
      unitGraphics.fillRect(
        unit.x * tileSize + tileSize/4,
        unit.y * tileSize + tileSize/4,
        tileSize/2,
        tileSize/2
      );
    }
    this.minimap.add(unitGraphics);

    // Draw buildings on minimap
    const buildingGraphics = this.add.graphics();
    for (const building of this.buildings) {
      buildingGraphics.fillStyle(0x00ff00);
      buildingGraphics.fillRect(
        building.x * tileSize + tileSize/3,
        building.y * tileSize + tileSize/3,
        tileSize/3,
        tileSize/3
      );
    }
    this.minimap.add(buildingGraphics);
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

    // Repair system
    this.updateRepair();
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