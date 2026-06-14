import type { Mission, MissionObjective, Faction } from '../types';
import { Faction as FactionEnum } from '../types';
import { getMission } from '../data/missions';

export interface CampaignState {
  currentMissionId: string | null;
  completedMissionIds: string[];
  unlockedMissionIds: string[];
  currentFaction: Faction;
  currentResources: number;
  currentUnits: string[];
  currentBuildings: string[];
  currentObjectives: MissionObjective[];
  missionStartTime: number;
  missionTimeRemaining: number | null;
  victory: boolean;
  defeat: boolean;
}

export class CampaignManager {
  private state: CampaignState;

  constructor() {
    this.state = {
      currentMissionId: null,
      completedMissionIds: [],
      unlockedMissionIds: ['tutorial'],
      currentFaction: FactionEnum.VANGUARD,
      currentResources: 1000,
      currentUnits: [],
      currentBuildings: [],
      currentObjectives: [],
      missionStartTime: 0,
      missionTimeRemaining: null,
      victory: false,
      defeat: false,
    };
  }

  loadMission(missionId: string): boolean {
    const mission = getMission(missionId);
    if (!mission) {
      console.error(`Mission ${missionId} not found`);
      return false;
    }

    // Check prerequisites
    if (mission.prerequisites) {
      const allPrereqsMet = mission.prerequisites.every(
        (prereq) => this.state.completedMissionIds.includes(prereq)
      );
      if (!allPrereqsMet) {
        console.error(`Mission ${missionId} prerequisites not met`);
        return false;
      }
    }

    // Check if mission is unlocked
    if (!this.state.unlockedMissionIds.includes(missionId)) {
      console.error(`Mission ${missionId} not unlocked`);
      return false;
    }

    // Initialize mission state
    this.state.currentMissionId = missionId;
    this.state.currentFaction = mission.briefing.startingFaction;
    this.state.currentResources = mission.briefing.startingResources;
    this.state.currentUnits = [...mission.briefing.startingUnits];
    this.state.currentBuildings = [...mission.briefing.startingBuildings];
    this.state.currentObjectives = mission.briefing.objectives.map((obj) => ({
      ...obj,
      current: 0,
      completed: false,
    }));
    this.state.missionStartTime = Date.now();
    this.state.missionTimeRemaining = mission.briefing.timeLimit || null;
    this.state.victory = false;
    this.state.defeat = false;

    console.log(`Loaded mission: ${mission.name}`);
    console.log(`Faction: ${this.state.currentFaction}`);
    console.log(`Resources: ${this.state.currentResources}`);
    console.log(`Units: ${this.state.currentUnits.join(', ')}`);
    console.log(`Buildings: ${this.state.currentBuildings.join(', ')}`);
    console.log(`Objectives: ${this.state.currentObjectives.length}`);

    return true;
  }

  updateMissionProgress(objectiveId: string, progress: number): void {
    const objective = this.state.currentObjectives.find((obj) => obj.id === objectiveId);
    if (objective) {
      objective.current = Math.min(objective.current + progress, objective.required);
      if (objective.current >= objective.required) {
        objective.completed = true;
      }
    }
  }

  checkMissionComplete(): boolean {
    const allObjectivesComplete = this.state.currentObjectives.every((obj) => obj.completed);
    if (allObjectivesComplete) {
      this.state.victory = true;
      console.log('Mission complete!');
      return true;
    }
    return false;
  }

  checkMissionDefeat(): boolean {
    // Check if player has no construction yards
    const playerConYards = this.state.currentBuildings.filter(
      (b) => b === 'construction'
    );
    if (playerConYards.length === 0) {
      this.state.defeat = true;
      console.log('Mission defeat: No construction yards left');
      return true;
    }
    return false;
  }

  checkTimeLimit(): boolean {
    if (!this.state.missionTimeRemaining) return false;

    const elapsed = (Date.now() - this.state.missionStartTime) / 1000;
    const remaining = this.state.missionTimeRemaining - elapsed;

    if (remaining <= 0) {
      this.state.defeat = true;
      console.log('Mission defeat: Time limit exceeded');
      return true;
    }

    this.state.missionTimeRemaining = Math.max(0, remaining);
    return false;
  }

  completeMission(): void {
    if (this.state.currentMissionId) {
      this.state.completedMissionIds.push(this.state.currentMissionId);
      console.log(`Completed mission: ${this.state.currentMissionId}`);

      // Unlock next missions
      const mission = getMission(this.state.currentMissionId);
      if (mission && mission.unlocks) {
        mission.unlocks.forEach((unlockedId) => {
          if (!this.state.unlockedMissionIds.includes(unlockedId)) {
            this.state.unlockedMissionIds.push(unlockedId);
            console.log(`Unlocked mission: ${unlockedId}`);
          }
        });
      }
    }
  }

  getCurrentMission(): Mission | null {
    if (!this.state.currentMissionId) return null;
    const mission = getMission(this.state.currentMissionId);
    return mission as Mission | null;
  }

  getState(): CampaignState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      currentMissionId: null,
      completedMissionIds: [],
      unlockedMissionIds: ['tutorial'],
      currentFaction: FactionEnum.VANGUARD,
      currentResources: 1000,
      currentUnits: [],
      currentBuildings: [],
      currentObjectives: [],
      missionStartTime: 0,
      missionTimeRemaining: null,
      victory: false,
      defeat: false,
    };
  }
}