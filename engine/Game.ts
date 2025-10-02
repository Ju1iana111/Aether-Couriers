import { Renderer } from './Renderer';
import { InputHandler } from './InputHandler';
import { World } from '../game/World';
// FIX: Standardized player import to use consistent casing 'player.ts' to resolve TypeScript module resolution errors.
import { Player } from '../game/player';
import { AssetLoader } from './AssetLoader';
// FIX: Use types from content-types to align with World and Player classes.
// FIX: Add Vector2 for spawnProjectile and Projectile/VisualEffect for rendering
import { Biome, Glider, GliderPhysics, LevelData, Vector2 } from '../modules/content-types';
import { Storage } from './Storage';
import { generateTileCache } from './ProceduralTiles';
import { generateLevel } from '../services/levelGenerator';
import { Scene, VisualEffect } from '../game/scene';
import { Projectile } from '../game/Projectile';
import { CalculatedGliderStats } from '../modules/game-state';

export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private input: InputHandler;
  private storage: Storage;
  
  private world: World | null = null;
  private player: Player | null = null;
  // FIX: Add projectiles and effects to be managed by the Game class
  private projectiles: Projectile[] = [];
  private effects: VisualEffect[] = [];
  
  private lastTime: number = 0;
  private isRunning: boolean = false;

  private biomesData: Biome[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new InputHandler();
    this.storage = new Storage('AetherCouriersDB');
  }

  public async start(): Promise<void> {
    this.input.init();

    // Load assets
    const gliderData = await AssetLoader.loadJSON<Glider>('/assets/gliders/aero-dart-500.json');
    const physicsData = await AssetLoader.loadJSON<GliderPhysics>('/assets/configs/glider_physics.json');
    // FIX: Load level and biome data to pass to world.loadLevelFromData
    const levelData = await AssetLoader.loadJSON<LevelData>('/assets/levels/isle-137.json');
    this.biomesData = await AssetLoader.loadJSON<Biome[]>('/assets/biomes/biomes.json');
    
    // Generate sprites procedurally instead of loading from files
    const sprites = await generateTileCache();
    this.renderer.setSprites(sprites);

    // FIX: The Player constructor requires a CalculatedGliderStats object.
    // This is constructed here with default values as this file is likely deprecated
    // and does not use the modular parts system.
    const initialStats: CalculatedGliderStats = {
      physics: physicsData,
      maxHealth: 100,
      maxEnergy: 100,
      energyRegen: 1.0,
      gadgetSlots: gliderData.gadgets.length,
    };

    this.player = new Player(gliderData, initialStats, this.input);
    this.world = new World();

    // FIX: Call the correct method `loadLevelFromData` instead of the non-existent `loadLevel`.
    this.world.loadLevelFromData(levelData, this.biomesData);
    
    // Load saved game state if available
    const savedState = await this.storage.loadGameState();
    if (savedState && savedState.playerPosition) {
      this.player.setPosition(savedState.playerPosition);
    } else {
      this.player.setPosition([100, 100]); // Default start
    }
    
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));

    // Autosave every 10 seconds
    setInterval(() => {
        this.saveGame();
    }, 10000);
  }

  public stop(): void {
    this.isRunning = false;
    this.input.destroy();
    this.saveGame();
  }

  public loadNextLevel(): void {
    if (!this.world || !this.player) return;

    console.log("Entering portal, loading next level...");
    const newLevel = generateLevel();
    this.world.loadLevelFromData(newLevel, this.biomesData);
    this.player.setPosition([100, 100]);
    this.player.resetVelocity();
  }

  // FIX: Added to allow player to fire projectiles
  public spawnProjectile(startPos: Vector2, angle: number): void {
    this.projectiles.push(new Projectile(startPos, angle));
  }

  private gameLoop(currentTime: number): void {
    if (!this.isRunning) return;

    const deltaTime = (currentTime - this.lastTime) / 1000; // Delta time in seconds
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private update(deltaTime: number): void {
    if (this.player && this.world) {
      // FIX: The third argument `scene` is required for player update.
      // We pass `this` (the Game instance) and cast it, since we've added
      // the required `loadNextLevel` method to this class.
      this.player.update(deltaTime, this.world, this as unknown as Scene);
      // FIX: The `update` method on `World` requires the `player` object to handle interactions and AI behavior.
      this.world.update(deltaTime, this.player);
      // FIX: Update projectiles and effects
      this.updateProjectiles(deltaTime);
      this.updateEffects(deltaTime);
    }
  }

  private updateProjectiles(deltaTime: number): void {
    if (!this.world) return;
    const patrols = this.world.getPatrolStates();
    const TILE_SIZE = 32;
    
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const proj = this.projectiles[i];
        proj.update(deltaTime);

        let hit = false;
        for (const patrol of patrols) {
            const dx = proj.pos[0] - patrol.currentPosition[0];
            const dy = proj.pos[1] - patrol.currentPosition[1];
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < TILE_SIZE / 2) { // Simple collision check
                const wasDestroyed = this.world.damagePatrol(patrol.id, proj.damage);
                if (wasDestroyed) {
                    this.effects.push({ 
                        pos: [...patrol.currentPosition], 
                        type: 'explosion', 
                        timer: 0.4, 
                        maxTime: 0.4 
                    });
                } else {
                    this.effects.push({ 
                        pos: [...proj.pos], 
                        type: 'spark', 
                        timer: 0.1, 
                        maxTime: 0.1 
                    });
                }
                hit = true;
                break; 
            }
        }

        if (hit || proj.isDead()) {
            this.projectiles.splice(i, 1);
        }
    }
  }

  private updateEffects(deltaTime: number): void {
      for (let i = this.effects.length - 1; i >= 0; i--) {
          this.effects[i].timer -= deltaTime;
          if (this.effects[i].timer <= 0) {
              this.effects.splice(i, 1);
          }
      }
  }

  private render(): void {
    if (this.world && this.player) {
      // FIX: Pass projectiles and effects to the renderer.
      this.renderer.render(this.world, this.player, this.projectiles, this.effects);
    }
  }

  private async saveGame(): Promise<void> {
      if (!this.player) return;
      console.log('Autosaving game state...');
      await this.storage.saveGameState({
          currentLevel: '/assets/levels/isle-137.json',
          playerPosition: this.player.getPosition()
      });
  }
}