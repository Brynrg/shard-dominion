import { Faction } from '../types';

export interface VolatileBloom {
  id: string;
  name: string;
  faction: Faction;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  damage: number;
  range: number;
  radius: number;
  cooldown: number;
  lastAttack: number;
  state: 'idle' | 'growing' | 'exploding' | 'recharging';
  growthTime: number;
  currentGrowth: number;
}

export const VOLATILE_BLOOM_TYPES: Record<string, VolatileBloom> = {
  // Vanguard Volatile Bloom
  vanguard_bloom: {
    id: 'vanguard_bloom',
    name: 'Volatile Bloom',
    faction: Faction.VANGUARD,
    x: 0,
    y: 0,
    health: 100,
    maxHealth: 100,
    damage: 50,
    range: 2,
    radius: 3,
    cooldown: 60,
    lastAttack: 0,
    state: 'idle',
    growthTime: 30,
    currentGrowth: 0
  },

  // Forge Volatile Bloom
  forge_bloom: {
    id: 'forge_bloom',
    name: 'Volatile Bloom',
    faction: Faction.FORGE,
    x: 0,
    y: 0,
    health: 150,
    maxHealth: 150,
    damage: 70,
    range: 2,
    radius: 3,
    cooldown: 60,
    lastAttack: 0,
    state: 'idle',
    growthTime: 30,
    currentGrowth: 0
  },

  // Phantom Volatile Bloom
  phantom_bloom: {
    id: 'phantom_bloom',
    name: 'Volatile Bloom',
    faction: Faction.PHANTOM,
    x: 0,
    y: 0,
    health: 80,
    maxHealth: 80,
    damage: 40,
    range: 2,
    radius: 3,
    cooldown: 60,
    lastAttack: 0,
    state: 'idle',
    growthTime: 30,
    currentGrowth: 0
  }
};

export const VOLATILE_BLOOM_CONFIG = {
  spawnChance: 0.01, // 1% chance per tick
  growthRate: 0.1,
  explosionDamage: 50,
  explosionRadius: 3,
  rechargeTime: 30
};

export class VolatileBloomManager {
  private blooms: Map<string, VolatileBloom> = new Map();

  addBloom(bloom: VolatileBloom): void {
    this.blooms.set(bloom.id, bloom);
  }

  removeBloom(bloomId: string): void {
    this.blooms.delete(bloomId);
  }

  getBloom(bloomId: string): VolatileBloom | undefined {
    return this.blooms.get(bloomId);
  }

  getAllBlooms(): VolatileBloom[] {
    return Array.from(this.blooms.values());
  }

  update(): void {
    for (const bloom of this.blooms.values()) {
      this.updateBloom(bloom);
    }
  }

  private updateBloom(bloom: VolatileBloom): void {
    const now = Date.now();

    // State machine
    switch (bloom.state) {
      case 'idle':
        // Start growing
        bloom.state = 'growing';
        break;

      case 'growing':
        // Grow the bloom
        bloom.currentGrowth += VOLATILE_BLOOM_CONFIG.growthRate;

        if (bloom.currentGrowth >= bloom.growthTime) {
          // Bloom is ready to explode
          bloom.state = 'exploding';
          bloom.currentGrowth = 0;
        }
        break;

      case 'exploding':
        // Deal damage to nearby units and buildings
        if (now - bloom.lastAttack >= bloom.cooldown * 1000) {
          bloom.lastAttack = now;
          // Deal damage to nearby units and buildings
        }

        // After explosion, start recharging
        bloom.state = 'recharging';
        break;

      case 'recharging':
        // Recharge
        if (now - bloom.lastAttack >= VOLATILE_BLOOM_CONFIG.rechargeTime * 1000) {
          bloom.state = 'idle';
        }
        break;
    }
  }

  checkSpawn(): boolean {
    // Randomly spawn a volatile bloom
    if (Math.random() < VOLATILE_BLOOM_CONFIG.spawnChance) {
      const bloomId = `volatile_bloom_${Date.now()}`;
      const bloom: VolatileBloom = {
        id: bloomId,
        name: 'Volatile Bloom',
        faction: Faction.NEUTRAL,
        x: Math.floor(Math.random() * 100),
        y: Math.floor(Math.random() * 100),
        health: 100,
        maxHealth: 100,
        damage: 50,
        range: 2,
        radius: 3,
        cooldown: 60,
        lastAttack: 0,
        state: 'idle',
        growthTime: 30,
        currentGrowth: 0
      };

      this.addBloom(bloom);
      return true;
    }

    return false;
  }

  explode(bloomId: string): void {
    const bloom = this.blooms.get(bloomId);
    if (!bloom) return;

    // Deal damage to nearby units and buildings
    // This would be called from the game scene
    bloom.state = 'recharging';
  }
}