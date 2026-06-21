import { Scene } from 'phaser';

export interface TitanWorm {
  id: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  damage: number;
  range: number;
  speed: number;
  targetX: number;
  targetY: number;
  state: 'idle' | 'moving' | 'attacking' | 'dying';
  sprite: Phaser.GameObjects.Sprite | null;
  graphics: Phaser.GameObjects.Graphics | null;
}

export class TitanWormManager {
  private worms: TitanWorm[] = [];
  private scene: Scene;
  private units: any[]; // Units array
  private buildings: any[]; // Buildings array
  private readonly WORM_SPAWN_INTERVAL = 30000; // 30 seconds
  private lastSpawnTime: number = 0;
  private readonly WORM_DAMAGE = 50;
  private readonly WORM_RANGE = 3;

  constructor(scene: Scene, units: any[], buildings: any[]) {
    this.scene = scene;
    this.units = units;
    this.buildings = buildings;
  }

  update(delta: number): void {
    // Spawn new worms periodically
    const now = this.scene.time.now;
    if (now - this.lastSpawnTime > this.WORM_SPAWN_INTERVAL) {
      this.spawnWorm();
      this.lastSpawnTime = now;
    }

    // Update all worms
    for (const worm of this.worms) {
      this.updateWorm(worm, delta);
    }
  }

  private spawnWorm(): void {
    // Find a random location on the map
    const x = Math.floor(Math.random() * 20) + 5;
    const y = Math.floor(Math.random() * 15) + 5;

    const worm: TitanWorm = {
      id: `titan_worm_${Date.now()}`,
      x,
      y,
      health: 200,
      maxHealth: 200,
      damage: this.WORM_DAMAGE,
      range: this.WORM_RANGE,
      speed: 0.5,
      targetX: x,
      targetY: y,
      state: 'idle',
      sprite: null,
      graphics: null,
    };

    this.worms.push(worm);
    this.createWormGraphics(worm);
  }

  private createWormGraphics(worm: TitanWorm): void {
    // Create a large sprite for the worm
    const sprite = this.scene.add.sprite(
      worm.x * 32,
      worm.y * 32,
      'titan_worm'
    );
    sprite.setScale(2);
    worm.sprite = sprite;

    // Create a health bar
    const graphics = this.scene.add.graphics();
    this.drawHealthBar(graphics, worm);
    worm.graphics = graphics;
  }

  private drawHealthBar(graphics: Phaser.GameObjects.Graphics, worm: TitanWorm): void {
    graphics.clear();
    const barWidth = 64;
    const barHeight = 8;
    const x = worm.x * 32 - barWidth / 2;
    const y = worm.y * 32 - 20;

    // Background
    graphics.fillStyle(0x333333, 1);
    graphics.fillRect(x, y, barWidth, barHeight);

    // Health
    const healthPercent = worm.health / worm.maxHealth;
    const healthColor = healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000;
    graphics.fillStyle(healthColor, 1);
    graphics.fillRect(x, y, barWidth * healthPercent, barHeight);
  }

  private updateWorm(worm: TitanWorm, _delta: number): void {
    if (worm.state === 'dying') return;

    // Find nearest target (player unit or building)
    const targets = this.units.filter(
      (u: any) => u.owner === 'player' && u.currentHealth > 0
    );
    const buildings = this.buildings.filter(
      (b: any) => b.type !== 'construction' && b.type !== 'processor' && b.type !== 'silo' && b.type !== 'power' && b.type !== 'repair' && b.health > 0
    );

    const allTargets = [...targets, ...buildings];
    if (allTargets.length === 0) return;

    let nearestTarget = null;
    let nearestDist = Infinity;
    for (const target of allTargets) {
      const dist = Math.abs(worm.x - target.x) + Math.abs(worm.y - target.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestTarget = target;
      }
    }

    if (nearestTarget) {
      // Check if in range
      if (nearestDist <= worm.range) {
        // Attack
        worm.state = 'attacking';
        nearestTarget.currentHealth -= worm.damage;
        if (nearestTarget.currentHealth <= 0) {
          // Remove target
          const index = this.units.findIndex((u: any) => u.id === nearestTarget.id);
          if (index !== -1) {
            this.units.splice(index, 1);
          }
        }
      } else {
        // Move towards target
        worm.state = 'moving';
        const dx = nearestTarget.x - worm.x;
        const dy = nearestTarget.y - worm.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          worm.x += (dx / dist) * 0.5;
          worm.y += (dy / dist) * 0.5;
        }
      }
    }

    // Update sprite position
    if (worm.sprite) {
      worm.sprite.x = worm.x * 32;
      worm.sprite.y = worm.y * 32;
    }

    // Update health bar
    if (worm.graphics) {
      this.drawHealthBar(worm.graphics, worm);
    }

    // Check if worm is dead
    if (worm.health <= 0) {
      worm.state = 'dying';
      if (worm.sprite) {
        worm.sprite.destroy();
      }
      if (worm.graphics) {
        worm.graphics.destroy();
      }
      const index = this.worms.indexOf(worm);
      if (index !== -1) {
        this.worms.splice(index, 1);
      }
    }
  }

  getWorms(): TitanWorm[] {
    return this.worms;
  }

  checkSpawn(): boolean {
    // Check if any new worms have spawned
    return this.worms.length > 0;
  }

  getAllWorms(): TitanWorm[] {
    return this.worms;
  }

  reset(): void {
    this.destroy();
    this.worms = [];
    this.lastSpawnTime = 0;
  }

  destroy(): void {
    for (const worm of this.worms) {
      if (worm.sprite) {
        worm.sprite.destroy();
      }
      if (worm.graphics) {
        worm.graphics.destroy();
      }
    }
    this.worms = [];
  }
}