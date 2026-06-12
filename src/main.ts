// Entry point. Wires the canvas, the game loop, the timer, and the HUD.
//
// This file implements a simple Phaser + speedrungames-sdk integration.
// REPLACE the gameplay section below with your game.

import { Game, AUTO } from "phaser";
import { SpeedrunTimer } from "speedrungames-sdk/timer";
import { createHUD } from "speedrungames-sdk/hud";
import { createStorage } from "speedrungames-sdk/storage";
import { MainScene } from "./scenes/MainScene";
import "./styles.css";

// Must match game.manifest.json#slug. `pnpm new:game` substitutes this.
const SLUG: string = "__SLUG__";
const UNSET_SLUG = "__SLUG__";

const root = document.getElementById("app");
if (!root) throw new Error("#app element missing in index.html");

const hud = createHUD(root);
const timer = new SpeedrunTimer();
const storage = createStorage(SLUG === UNSET_SLUG ? "template-demo" : SLUG);

const pb = storage.getPB();
hud.setPB(pb?.ms ?? null);
hud.setStatus("Loading Shard Dominion...");

timer.subscribe((ms, state) => hud.setTime(ms, state));

// ─── Gameplay (replace this section) ────────────────────────────────────────

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // AUTO chooses WebGL if available, falls back to Canvas
  width: 800,
  height: 600,
  backgroundColor: 0x0b0b10,
  parent: "app",
  render: {
    pixelArt: true, // Pixel art style
    antialias: false, // Disable antialiasing for sharper pixel art
  },
  scene: [{
    key: 'GameScene',
    preload: function() {
      this.add.text(400, 300, "Loading...", { color: "#ffffff", fontSize: "24px" }).setOrigin(0.5);
    },
    create: function() {
      this.add.text(400, 300, "Shard Dominion", { color: "#ffffff", fontSize: "32px" }).setOrigin(0.5);
      this.add.text(400, 400, "Click to start", { color: "#888888", fontSize: "16px" }).setOrigin(0.5);
      
      // Add MainScene
      this.scene.add('MainScene', new MainScene(), true);
    },
    update: function() {
      // Game loop
    }
  }]
};

const game = new Game(config);

// Handle clicks
game.canvas.addEventListener("pointerdown", () => {
  if (timer.getState() === "idle") {
    timer.start();
    hud.setStatus("Game started!");
  } else if (timer.getState() === "finished") {
    timer.start();
    hud.setStatus("Game started!");
  }
});

// ─── End gameplay ────────────────────────────────────────────────────────────

// Start the game
