import type { Position } from '../types';

export class FogOfWar {
  private static readonly VISION_RANGE = 5;
  private exploredTiles: boolean[][];
  private visionMap: boolean[][];

  constructor(private width: number, private height: number) {
    this.exploredTiles = Array(height).fill(null).map(() => Array(width).fill(false));
    this.visionMap = Array(height).fill(null).map(() => Array(width).fill(false));
  }

  updateVision(unitPositions: Position[]): void {
    // Reset vision map
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.visionMap[y][x] = false;
      }
    }

    // Update vision for each unit
    for (const pos of unitPositions) {
      this.updateVisionAt(pos.x, pos.y);
    }
  }

  updateVisionAt(x: number, y: number): void {
    const range = FogOfWar.VISION_RANGE;
    
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        
        if (tx >= 0 && tx < this.width && ty >= 0 && ty < this.height) {
          // Use circular vision
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= range) {
            this.visionMap[ty][tx] = true;
            this.exploredTiles[ty][tx] = true;
          }
        }
      }
    }
  }

  isExplored(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return true; // Out of bounds is always considered explored
    }
    return this.exploredTiles[y][x];
  }

  hasVision(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return true; // Out of bounds always has vision
    }
    return this.visionMap[y][x];
  }

  isVisible(x: number, y: number): boolean {
    return this.isExplored(x, y) && this.hasVision(x, y);
  }

  getFogAlpha(x: number, y: number): number {
    if (this.hasVision(x, y)) {
      return 0; // Fully visible
    } else if (this.isExplored(x, y)) {
      return 0.5; // Explored but not currently visible (grayed out)
    } else {
      return 1; // Completely hidden (black fog)
    }
  }

  reset(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.exploredTiles[y][x] = false;
        this.visionMap[y][x] = false;
      }
    }
  }

  revealAll(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.exploredTiles[y][x] = true;
        this.visionMap[y][x] = true;
      }
    }
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }
}