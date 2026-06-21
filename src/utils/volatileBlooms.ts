import { Scene } from 'phaser';

export interface VolatileBloom {
  id: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  damage: number;
  range: number;
  explosionRadius: number;
  state: 'idle' | 'exploding' | 'dying';
  sprite: Phaser.GameObjects.Sprite | null;
  graphics: Phaser.GameObjects.Graphics | null;
}

export class VolatileBloomManager {
  private blooms: VolatileBloom[] = [];
  private scene: Scene;
  private units: any[]; // Units array
  private buildings: any[]; // Buildings array
  private readonly BLOOM_SPAWN_INTERVAL = 25000; // 25 seconds
  private lastSpawnTime: number = 0;
  private readonly BLOOM_DAMAGE = 30;
  private readonly BLOOM_RANGE = 2;
  private readonly BLOOM_EXPLOSION_RADIUS = 3;

  constructor(scene: Scene, units: any[], buildings: any[]) {
    this.scene = scene;
    this.units = units;
    this.buildings = buildings;
  }

  update(delta: number): void {
    // Spawn new blooms periodically
    const now = this.scene.time.now;
    if (now - this.lastSpawnTime > this.BLOOM_SPAWN_INTERVAL) {
      this.spawnBloom();
      this.lastSpawnTime = now;
    }

    // Update all blooms
    for (const bloom of this.blooms) {
      this.updateBloom(bloom, delta);
    }
  }

  private spawnBloom(): void {
    // Find a random location on the map
    const x = Math.floor(Math.random() * 20) + 5;
    const y = Math.floor(Math.random() * 15) + 5;

    const bloom: VolatileBloom = {
      id: `volatile_bloom_${Date.now()}`,
      x,
      y,
      health: 100,
      maxHealth: 100,
      damage: this.BLOOM_DAMAGE,
      range: this.BLOOM_RANGE,
      explosionRadius: this.BLOOM_EXPLOSION_RADIUS,
      state: 'idle',
      sprite: null,
      graphics: null,
    };

    this.blooms.push(bloom);
    this.createBloomGraphics(bloom);
  }

  private createBloomGraphics(bloom: VolatileBloom): void {
    // Create a sprite for the bloom
    const sprite = this.scene.add.sprite(
      bloom.x * 32,
      bloom.y * 32,
      'volatile_bloom'
    );
    sprite.setScale(1.5);
    bloom.sprite = sprite;

    // Create a health bar
    const graphics = this.scene.add.graphics();
    this.drawHealthBar(graphics, bloom);
    bloom.graphics = graphics;
  }

  private drawHealthBar(graphics: Phaser.GameObjects.Graphics, bloom: VolatileBloom): void {
    graphics.clear();
    const barWidth = 64;
    const barHeight = 8;
    const x = bloom.x * 32 - barWidth / 2;
    const y = bloom.y * 32 - 20;

    // Background
    graphics.fillStyle(0x333333, 1);
    graphics.fillRect(x, y, barWidth, barHeight);

    // Health
    const healthPercent = bloom.health / bloom.maxHealth;
    const healthColor = healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000;
    graphics.fillStyle(healthColor, 1);
    graphics.fillRect(x, y, barWidth * healthPercent, barHeight);
  }

  private updateBloom(bloom: VolatileBloom, _delta: number): void {
    if (bloom.state === 'dying') return;

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
      const dist = Math.abs(bloom.x - target.x) + Math.abs(bloom.y - target.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestTarget = target;
      }
    }

    if (nearestTarget) {
      // Check if in range
      if (nearestDist <= bloom.range) {
        // Attack
        bloom.state = 'exploding';
        nearestTarget.currentHealth -= bloom.damage;
        if (nearestTarget.currentHealth <= 0) {
          // Remove target
          const index = this.units.findIndex((u: any) => u.id === nearestTarget.id);
          if (index !== -1) {
            this.units.splice(index, 1);
          }
        }
      } else {
        // Move towards target
        bloom.state = 'idle';
        const dx = nearestTarget.x - bloom.x;
        const dy = nearestTarget.y - bloom.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          bloom.x += (dx / dist) * 0.3;
          bloom.y += (dy / dist) * 0.3;
        }
      }
    }

    // Update sprite position
    if (bloom.sprite) {
      bloom.sprite.x = bloom.x * 32;
      bloom.sprite.y = bloom.y * 32;
    }

    // Update health bar
    if (bloom.graphics) {
      this.drawHealthBar(bloom.graphics, bloom);
    }

    // Check if bloom is dead
    if (bloom.health <= 0) {
      bloom.state = 'dying';
      if (bloom.sprite) {
        bloom.sprite.destroy();
      }
      if (bloom.graphics) {
        bloom.graphics.destroy();
      }
      const index = this.blooms.indexOf(bloom);
      if (index !== -1) {
        this.blooms.splice(index, 1);
      }
    }
  }

  getBlooms(): VolatileBloom[] {
    return this.blooms;
  }

  checkSpawn(): boolean {
    // Check if any new blooms have spawned
    return this.blooms.length > 0;
  }

  getAllBlooms(): VolatileBloom[] {
    return this.blooms;
  }

  reset(): void {
    this.destroy();
    this.blooms = [];
    this.lastSpawnTime = 0;
  }

  destroy(): void {
    for (const bloom of this.blooms) {
      if (bloom.sprite) {
        bloom.sprite.destroy();
      }
      if (bloom.graphics) {
        bloom.graphics.destroy();
      }
    }
    this.blooms = [];
  }
}