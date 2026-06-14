import { Faction } from '../types';

export interface TitanWorm {
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
  state: 'idle' | 'wandering' | 'attacking' | 'lured';
  target: { x: number; y: number } | null;
  thumper: { id: string; x: number; y: number } | null;
}

export interface Thumper {
  id: string;
  name: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  damage: number;
  range: number;
  cooldown: number;
  lastAttack: number;
  state: 'idle' | 'deployed' | 'recharging';
}

export const TITAN_WORM_TYPES: Record<string, TitanWorm> = {
  // Vanguard Titan Worm
  vanguard_titan_worm: {
    id: 'vanguard_titan_worm',
    name: 'Titan Worm',
    faction: Faction.VANGUARD,
    x: 0,
    y: 0,
    health: 600,
    maxHealth: 600,
    damage: 80,
    range: 2,
    radius: 3,
    cooldown: 60,
    lastAttack: 0,
    state: 'idle',
    target: null,
    thumper: null
  },

  // Forge Titan Worm
  forge_titan_worm: {
    id: 'forge_titan_worm',
    name: 'Titan Worm',
    faction: Faction.FORGE,
    x: 0,
    y: 0,
    health: 800,
    maxHealth: 800,
    damage: 100,
    range: 2,
    radius: 3,
    cooldown: 60,
    lastAttack: 0,
    state: 'idle',
    target: null,
    thumper: null
  },

  // Phantom Titan Worm
  phantom_titan_worm: {
    id: 'phantom_titan_worm',
    name: 'Titan Worm',
    faction: Faction.PHANTOM,
    x: 0,
    y: 0,
    health: 500,
    maxHealth: 500,
    damage: 60,
    range: 2,
    radius: 3,
    cooldown: 60,
    lastAttack: 0,
    state: 'idle',
    target: null,
    thumper: null
  }
};

export const THUMPER_TYPES: Record<string, Thumper> = {
  // Vanguard Thumper
  vanguard_thumper: {
    id: 'vanguard_thumper',
    name: 'Thumper',
    x: 0,
    y: 0,
    health: 150,
    maxHealth: 150,
    damage: 30,
    range: 3,
    cooldown: 30,
    lastAttack: 0,
    state: 'idle'
  },

  // Forge Thumper
  forge_thumper: {
    id: 'forge_thumper',
    name: 'Thumper',
    x: 0,
    y: 0,
    health: 200,
    maxHealth: 200,
    damage: 40,
    range: 3,
    cooldown: 30,
    lastAttack: 0,
    state: 'idle'
  },

  // Phantom Thumper
  phantom_thumper: {
    id: 'phantom_thumper',
    name: 'Thumper',
    x: 0,
    y: 0,
    health: 120,
    maxHealth: 120,
    damage: 25,
    range: 3,
    cooldown: 30,
    lastAttack: 0,
    state: 'idle'
  }
};

export const TITAN_WORM_CONFIG = {
  spawnChance: 0.02, // 2% chance per tick
  wanderSpeed: 0.5,
  attackRange: 2,
  aggroRange: 5,
  luredRange: 8,
  thumperDamage: 50,
  thumperCooldown: 120
};

export const THUMPER_CONFIG = {
  deployCost: 100,
  rechargeTime: 30,
  damage: 30,
  range: 3,
  cooldown: 30
};

export class TitanWormManager {
  private worms: Map<string, TitanWorm> = new Map();
  private thumpers: Map<string, Thumper> = new Map();
  private mapWidth: number;
  private mapHeight: number;

  constructor(mapWidth: number, mapHeight: number) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
  }

  addWorm(worm: TitanWorm): void {
    this.worms.set(worm.id, worm);
  }

  addThumper(thumper: Thumper): void {
    this.thumpers.set(thumper.id, thumper);
  }

  removeWorm(wormId: string): void {
    this.worms.delete(wormId);
  }

  removeThumper(thumperId: string): void {
    this.thumpers.delete(thumperId);
  }

  getWorm(wormId: string): TitanWorm | undefined {
    return this.worms.get(wormId);
  }

  getThumper(thumperId: string): Thumper | undefined {
    return this.thumpers.get(thumperId);
  }

  getAllWorms(): TitanWorm[] {
    return Array.from(this.worms.values());
  }

  getAllThumpers(): Thumper[] {
    return Array.from(this.thumpers.values());
  }

  update(): void {
    // Update worms
    for (const worm of this.worms.values()) {
      this.updateWorm(worm);
    }

    // Update thumpers
    for (const thumper of this.thumpers.values()) {
      this.updateThumper(thumper);
    }
  }

  private updateWorm(worm: TitanWorm): void {
    const now = Date.now();

    // Check if thumper is deployed
    if (worm.thumper) {
      const thumper = this.thumpers.get(worm.thumper.id);
      if (thumper && thumper.state === 'recharging') {
        // Check if thumper is ready
        if (now - thumper.lastAttack >= thumper.cooldown * 1000) {
          thumper.state = 'deployed';
        }
      }
    }

    // State machine
    switch (worm.state) {
      case 'idle':
        // Wander randomly
        if (Math.random() < 0.01) {
          worm.target = {
            x: Math.floor(Math.random() * this.mapWidth),
            y: Math.floor(Math.random() * this.mapHeight)
          };
          worm.state = 'wandering';
        }
        break;

      case 'wandering':
        // Move towards target
        if (worm.target) {
          const dx = worm.target.x - worm.x;
          const dy = worm.target.y - worm.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 0.5) {
            worm.state = 'idle';
            worm.target = null;
          } else {
            worm.x += (dx / distance) * TITAN_WORM_CONFIG.wanderSpeed;
            worm.y += (dy / distance) * TITAN_WORM_CONFIG.wanderSpeed;
          }
        }
        break;

      case 'attacking':
        // Attack target
        if (worm.target) {
          const distance = Math.abs(worm.x - worm.target.x) + Math.abs(worm.y - worm.target.y);

          if (distance <= worm.range) {
            // Attack!
            if (now - worm.lastAttack >= worm.cooldown * 1000) {
              worm.lastAttack = now;
              // Deal damage to target
            }
          } else {
            // Move towards target
            const dx = worm.target.x - worm.x;
            const dy = worm.target.y - worm.y;
            const moveDistance = Math.sqrt(dx * dx + dy * dy);

            if (moveDistance > 0) {
              worm.x += (dx / moveDistance) * TITAN_WORM_CONFIG.wanderSpeed;
              worm.y += (dy / moveDistance) * TITAN_WORM_CONFIG.wanderSpeed;
            }
          }
        }
        break;

      case 'lured':
        // Move towards thumper
        if (worm.thumper) {
          const thumper = this.thumpers.get(worm.thumper.id);
          if (thumper) {
            const dx = thumper.x - worm.x;
            const dy = thumper.y - worm.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= worm.range) {
              // Attack thumper
              if (now - worm.lastAttack >= worm.cooldown * 1000) {
                worm.lastAttack = now;
                thumper.health -= worm.damage;
                if (thumper.health <= 0) {
                  this.removeThumper(thumper.id);
                  worm.thumper = null;
                  worm.state = 'idle';
                }
              }
            } else {
              // Move towards thumper
              worm.x += (dx / distance) * TITAN_WORM_CONFIG.wanderSpeed;
              worm.y += (dy / distance) * TITAN_WORM_CONFIG.wanderSpeed;
            }
          }
        }
        break;
    }
  }

  private updateThumper(thumper: Thumper): void {
    const now = Date.now();

    // State machine
    switch (thumper.state) {
      case 'idle':
        // Check if thumper is deployed
        if (thumper.health <= 0) {
          thumper.state = 'recharging';
        }
        break;

      case 'deployed':
        // Check if thumper is ready to recharge
        if (now - thumper.lastAttack >= thumper.cooldown * 1000) {
          thumper.state = 'recharging';
        }
        break;

      case 'recharging':
        // Recharge
        if (now - thumper.lastAttack >= THUMPER_CONFIG.rechargeTime * 1000) {
          thumper.state = 'deployed';
        }
        break;
    }
  }

  deployThumper(thumperId: string, x: number, y: number): boolean {
    const thumper = this.thumpers.get(thumperId);
    if (!thumper) return false;

    thumper.x = x;
    thumper.y = y;
    thumper.state = 'deployed';
    thumper.lastAttack = Date.now();

    return true;
  }

  lureWorm(wormId: string, thumperId: string): boolean {
    const worm = this.worms.get(wormId);
    const thumper = this.thumpers.get(thumperId);

    if (!worm || !thumper) return false;

    worm.thumper = { id: thumperId, x: thumper.x, y: thumper.y };
    worm.state = 'lured';

    return true;
  }

  checkSpawn(): boolean {
    // Randomly spawn a titan worm
    if (Math.random() < TITAN_WORM_CONFIG.spawnChance) {
      const wormId = `titan_worm_${Date.now()}`;
      const worm: TitanWorm = {
        id: wormId,
        name: 'Titan Worm',
        faction: Faction.NEUTRAL,
        x: Math.floor(Math.random() * this.mapWidth),
        y: Math.floor(Math.random() * this.mapHeight),
        health: 600,
        maxHealth: 600,
        damage: 80,
        range: 2,
        radius: 3,
        cooldown: 60,
        lastAttack: 0,
        state: 'idle',
        target: null,
        thumper: null
      };

      this.addWorm(worm);
      return true;
    }

    return false;
  }
}