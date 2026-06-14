import type { Faction } from '../types';

export interface Building {
  x: number;
  y: number;
  type: string;
  health: number;
  maxHealth: number;
  foundation: boolean;
  power: number;
  selected: boolean;
  size: number;
}

export interface Unit {
  id: string;
  x: number;
  y: number;
  type: string;
  selected: boolean;
  path: { x: number; y: number }[];
  health: number;
  currentHealth: number;
}

export interface AIConfig {
  faction: Faction;
  difficulty: 'easy' | 'medium' | 'hard';
  startingResources: number;
  personality: {
    economyWeight: number; // 0-1, focus on economy vs military
    aggressionWeight: number; // 0-1, how aggressive the AI is
    techWeight: number; // 0-1, focus on research vs immediate units
  };
}

export class AIManager {
  private config: AIConfig;
  private playerUnits: Unit[] = [];
  private playerBuildings: Building[] = [];
  private aiUnits: Unit[] = [];
  private credits: number = 0;
  private gameState: 'early' | 'mid' | 'late' = 'early';
  
  constructor(config: AIConfig) {
    this.config = config;
    this.credits = config.startingResources;
  }
  
  update(playerUnits: Unit[], playerBuildings: Building[], aiUnits: Unit[], credits: number): void {
    this.playerUnits = playerUnits;
    this.playerBuildings = playerBuildings;
    this.aiUnits = aiUnits;
    this.credits = credits;
    
    // Determine game phase
    const totalUnits = playerUnits.length + aiUnits.length;
    if (totalUnits < 10) {
      this.gameState = 'early';
    } else if (totalUnits < 30) {
      this.gameState = 'mid';
    } else {
      this.gameState = 'late';
    }
    
    this.executeAI();
  }
  
  private executeAI(): void {
    // AI strategy: economy first → scout → harass → tech → attack
    const actions: AIAction[] = [];
    
    // Economy priority
    if (this.shouldFocusOnEconomy()) {
      actions.push(AIAction.BUILD_ECONOMY);
    }
    
    // Scout if early game
    if (this.gameState === 'early' && this.playerUnits.length < 3) {
      actions.push(AIAction.SCOUT);
    }
    
    // Harass if mid game
    if (this.gameState === 'mid') {
      actions.push(AIAction.HARASS);
    }
    
    // Tech focus if personality prefers it
    if (this.config.personality.techWeight > 0.6) {
      actions.push(AIAction.BUILD_TECH);
    }
    
    // Attack if late game or personality is aggressive
    if (this.gameState === 'late' || this.config.personality.aggressionWeight > 0.7) {
      actions.push(AIAction.ATTACK);
    }
    
    // Execute actions based on personality weights
    this.executeActions(actions);
  }
  
  private shouldFocusOnEconomy(): boolean {
    // Focus on economy if early game or personality prefers economy
    return this.gameState === 'early' || this.config.personality.economyWeight > 0.6;
  }
  
  private executeActions(actions: AIAction[]): void {
    // Execute actions based on personality weights and current state
    for (const action of actions) {
      switch (action) {
        case AIAction.BUILD_ECONOMY:
          this.buildEconomy();
          break;
        case AIAction.SCOUT:
          this.createScout();
          break;
        case AIAction.HARASS:
          this.harassPlayer();
          break;
        case AIAction.BUILD_TECH:
          this.buildTech();
          break;
        case AIAction.ATTACK:
          this.attackPlayer();
          break;
      }
    }
  }
  
  private buildEconomy(): void {
    // Build harvester or processor if not enough
    const harvesters = this.aiUnits.filter(u => u.type === 'harvester').length;
    if (harvesters < 2 && this.credits >= 100) {
      this.produceUnit('harvester');
    }
  }
  
  private createScout(): void {
    // Create a scout unit
    if (this.credits >= 75) {
      this.produceUnit('scout');
    }
  }
  
  private harassPlayer(): void {
    // Find player units and attack them
    if (this.aiUnits.length > 0) {
      // Move closest unit to player units
      const closestUnit = this.findClosestUnitToPlayer();
      if (closestUnit) {
        // Move towards player units
        this.moveUnitTowardsPlayer(closestUnit);
      }
    }
  }
  
  private buildTech(): void {
    // Build advanced buildings if possible
    // Simple implementation for now
  }
  
  private attackPlayer(): void {
    // Attack player's construction yard if possible
    const constructionYard = this.playerBuildings.find(b => b.type === 'construction');
    if (constructionYard && this.aiUnits.length > 0) {
      this.moveUnitsToTarget(constructionYard);
    }
  }
  
  private produceUnit(unitType: string): void {
    // This will be called by the main scene
    console.log(`AI producing ${unitType}`);
  }
  
  private findClosestUnitToPlayer(): Unit | null {
    if (this.aiUnits.length === 0) return null;
    
    let closestUnit = this.aiUnits[0];
    let closestDistance = Infinity;
    
    for (const unit of this.aiUnits) {
      // Find distance to nearest player unit
      let minDist = Infinity;
      for (const playerUnit of this.playerUnits) {
        const dist = Math.abs(unit.x - playerUnit.x) + Math.abs(unit.y - playerUnit.y);
        minDist = Math.min(minDist, dist);
      }
      
      if (minDist < closestDistance) {
        closestDistance = minDist;
        closestUnit = unit;
      }
    }
    
    return closestUnit;
  }
  
  private moveUnitTowardsPlayer(unit: Unit): void {
    if (this.playerUnits.length === 0) return;
    
    // Find nearest player unit
    let nearestPlayerUnit = this.playerUnits[0];
    let minDist = Infinity;
    
    for (const playerUnit of this.playerUnits) {
      const dist = Math.abs(unit.x - playerUnit.x) + Math.abs(unit.y - playerUnit.y);
      if (dist < minDist) {
        minDist = dist;
        nearestPlayerUnit = playerUnit;
      }
    }
    
    // Move towards that unit
    unit.path = [{ x: nearestPlayerUnit.x, y: nearestPlayerUnit.y }];
  }
  
  private moveUnitsToTarget(target: Building): void {
    for (const unit of this.aiUnits) {
      if (unit.path.length === 0) {
        unit.path = [{ x: target.x, y: target.y }];
      }
    }
  }
}

export enum AIAction {
  BUILD_ECONOMY,
  SCOUT,
  HARASS,
  BUILD_TECH,
  ATTACK
}