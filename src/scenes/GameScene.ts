import { Scene } from 'phaser';
// import { MainScene } from './MainScene'; // Not used yet

export class GameScene extends Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(): void {
    // config is declared but not used yet
  }

  preload(): void {
    // Placeholder assets
    this.add.text(10, 50, 'Loading assets...', { color: '#ffffff' });
  }

  create(): void {
    // Note: MainScene will be added to the parent
    // this.events.emit('scene-ready');
  }
}