export class TerrainGenerator {
  private static readonly TILE_SIZE = 32;
  private static readonly MAP_WIDTH = 25;
  private static readonly MAP_HEIGHT = 19;
  
  private static readonly TERRAIN_TYPES = {
      GRASS: { color: 0x228b22, walkable: true, cost: 1 },
      SAND: { color: 0xdaa520, walkable: true, cost: 1.5 },
      STONE: { color: 0x808080, walkable: true, cost: 2 },
      WATER: { color: 0x4682b4, walkable: false, cost: Infinity },
      MOUNTAIN: { color: 0x696969, walkable: false, cost: Infinity },
      RESOURCE: { color: 0x4169e1, walkable: true, cost: 1 } // Shard field
    };
  
  static generateTerrain(): number[][] {
    const terrain: number[][] = [];
    
    for (let y = 0; y < this.MAP_HEIGHT; y++) {
      terrain[y] = [];
      for (let x = 0; x < this.MAP_WIDTH; x++) {
        const noise = Math.sin(x * 0.3) + Math.cos(y * 0.3);
        
        if (noise > 0.5) {
          terrain[y][x] = this.getTerrainType('GRASS');
        } else if (noise > 0) {
          terrain[y][x] = this.getTerrainType('SAND');
        } else if (noise > -0.3) {
          terrain[y][x] = this.getTerrainType('STONE');
        } else {
          terrain[y][x] = this.getTerrainType('WATER');
        }
      }
    }
    
    // Add some specific features
    this.addMountainRange(terrain);
    this.addWaterBodies(terrain);
    this.addResourceFields(terrain);
    
    return terrain;
  }
  
  static getTerrainType(type: keyof typeof this.TERRAIN_TYPES): number {
      const terrainTypes = Object.keys(this.TERRAIN_TYPES);
      return terrainTypes.indexOf(type);
    }

  private static addMountainRange(terrain: number[][]): void {
    const startX = 5;
    const startY = Math.floor(this.MAP_HEIGHT / 2);
    
    for (let i = 0; i < 15; i++) {
      const x = startX + i;
      const y = startY + Math.floor(Math.sin(i * 0.5) * 3);
      
      if (x < this.MAP_WIDTH && y >= 0 && y < this.MAP_HEIGHT) {
        terrain[y][x] = this.getTerrainType('MOUNTAIN');
        terrain[y - 1][x] = this.getTerrainType('MOUNTAIN');
        terrain[y + 1][x] = this.getTerrainType('MOUNTAIN');
      }
    }
  }

  private static addWaterBodies(terrain: number[][]): void {
    // Add a lake in the lower left
    for (let y = this.MAP_HEIGHT - 5; y < this.MAP_HEIGHT; y++) {
      for (let x = 0; x < 8; x++) {
        if (y >= 0 && x < this.MAP_WIDTH) {
          terrain[y][x] = this.getTerrainType('WATER');
        }
      }
    }
    
    // Add a pond in the upper right
    for (let y = 2; y < 6; y++) {
      for (let x = this.MAP_WIDTH - 6; x < this.MAP_WIDTH; x++) {
        if (y >= 0 && x < this.MAP_WIDTH) {
          terrain[y][x] = this.getTerrainType('WATER');
        }
      }
    }
  }
  
  private static addResourceFields(terrain: number[][]): void {
    // Add shard fields in scattered locations
    const resourceCount = 8;
    for (let i = 0; i < resourceCount; i++) {
      const x = Math.floor(Math.random() * (this.MAP_WIDTH - 4)) + 2;
      const y = Math.floor(Math.random() * (this.MAP_HEIGHT - 4)) + 2;
      
      // Create a 2x2 resource field
      if (x + 1 < this.MAP_WIDTH && y + 1 < this.MAP_HEIGHT) {
        terrain[y][x] = this.getTerrainType('RESOURCE');
        terrain[y][x + 1] = this.getTerrainType('RESOURCE');
        terrain[y + 1][x] = this.getTerrainType('RESOURCE');
        terrain[y + 1][x + 1] = this.getTerrainType('RESOURCE');
      }
    }
  }

  static getTerrainColor(terrainId: number): number {
    const types = Object.keys(this.TERRAIN_TYPES);
    const typeName = types[terrainId] as keyof typeof this.TERRAIN_TYPES;
    return this.TERRAIN_TYPES[typeName].color;
  }

  static isWalkable(terrainId: number): boolean {
    const types = Object.keys(this.TERRAIN_TYPES);
    const typeName = types[terrainId] as keyof typeof this.TERRAIN_TYPES;
    return this.TERRAIN_TYPES[typeName].walkable;
  }

  static getTileCost(terrainId: number): number {
    const types = Object.keys(this.TERRAIN_TYPES);
    const typeName = types[terrainId] as keyof typeof this.TERRAIN_TYPES;
    return this.TERRAIN_TYPES[typeName].cost;
  }

  static getWidth(): number {
    return this.MAP_WIDTH;
  }

  static getHeight(): number {
    return this.MAP_HEIGHT;
  }

  static getTileSize(): number {
    return this.TILE_SIZE;
  }
}