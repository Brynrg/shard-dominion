import { Scene } from 'phaser';
import type { UnitType, BuildingType } from '../types';

export class AnimationManager {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  // Create unit movement animation
  createUnitMoveAnimation(unit: UnitType, fromX: number, fromY: number, toX: number, toY: number): void {
    const sprite = this.scene.add.sprite(fromX, fromY, unit.name);
    sprite.setAlpha(0.7);

    this.scene.tweens.add({
      targets: sprite,
      x: toX,
      y: toY,
      duration: 500,
      ease: 'Linear',
      onComplete: () => {
        sprite.destroy();
      }
    });
  }

  // Create unit attack animation
  createUnitAttackAnimation(unit: UnitType, targetX: number, targetY: number): void {
    const sprite = this.scene.add.sprite(targetX, targetY, unit.name);
    sprite.setAlpha(0.7);

    this.scene.tweens.add({
      targets: sprite,
      scale: 1.5,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        sprite.destroy();
      }
    });
  }

  // Create building construction animation
  createBuildingConstructionAnimation(building: BuildingType, x: number, y: number): void {
    const sprite = this.scene.add.sprite(x, y, building.name);
    sprite.setAlpha(0.3);
    sprite.setScale(0.5);

    this.scene.tweens.add({
      targets: sprite,
      scale: 1,
      alpha: 1,
      duration: 1000,
      ease: 'Back.easeOut',
      onComplete: () => {
        sprite.destroy();
      }
    });
  }

  // Create explosion particle effect
  createExplosion(x: number, y: number): void {
    const particles = this.scene.add.particles(x, y, 'explosion', {
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      blendMode: 'ADD',
      lifespan: 500,
      quantity: 20,
      tint: 0xff6600
    });

    this.scene.tweens.add({
      targets: particles,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        particles.destroy();
      }
    });
  }

  // Create damage flash effect
  createDamageFlash(x: number, y: number, size: number = 30): void {
    const flash = this.scene.add.graphics();
    flash.fillStyle(0xff0000, 0.5);
    flash.fillCircle(x, y, size);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        flash.destroy();
      }
    });
  }

  // Create selection ring animation
  createSelectionRing(x: number, y: number, size: number = 40): void {
    const ring = this.scene.add.graphics();
    ring.lineStyle(2, 0x00ff00, 1);
    ring.strokeCircle(x, y, size);

    this.scene.tweens.add({
      targets: ring,
      scale: 1.2,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        ring.destroy();
      }
    });
  }

  // Create unit death animation
  createUnitDeathAnimation(unit: UnitType, x: number, y: number): void {
    const sprite = this.scene.add.sprite(x, y, unit.name);
    sprite.setAlpha(0.7);

    this.scene.tweens.add({
      targets: sprite,
      scale: 0,
      alpha: 0,
      duration: 500,
      ease: 'Back.easeIn',
      onComplete: () => {
        sprite.destroy();
      }
    });
  }

  // Create building destruction animation
  createBuildingDestructionAnimation(building: BuildingType, x: number, y: number): void {
    const sprite = this.scene.add.sprite(x, y, building.name);
    sprite.setAlpha(0.7);

    this.scene.tweens.add({
      targets: sprite,
      scale: 0,
      alpha: 0,
      duration: 800,
      ease: 'Back.easeIn',
      onComplete: () => {
        sprite.destroy();
        this.createExplosion(x, y);
      }
    });
  }
}