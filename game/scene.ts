import { Renderer } from '../engine/Renderer';
import { InputHandler } from '../engine/InputHandler';
import { World } from './World';
// FIX: Standardized player import to use consistent casing 'player.ts' to resolve TypeScript module resolution errors.
import { Player } from './player';
import { gameState } from '../modules/game-state';
import { generateTileCache } from '../engine/ProceduralTiles';
import { generateLevel } from '../services/levelGenerator';
import { Vector2 } from '../modules/content-types';
import { Projectile } from './Projectile';
import { soundManager } from '../modules/sound-manager';
import { CalculatedGliderStats } from '../modules/game-state';

export type VisualEffect = {
    pos: Vector2;
    type: 'explosion' | 'spark';
    timer: number;
    maxTime: number;
}

export class Scene {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private input: InputHandler;
  
  private world: World;
  private player: Player;
  
  private lastTime: number = 0;
  private animationFrameId: number | null = null;
  private projectiles: Projectile[] = [];
  private effects: VisualEffect[] = [];

  constructor(canvas: HTMLCanvasElement, initialStats: CalculatedGliderStats) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new InputHandler();
    this.world = new World();
    
    if(!gameState.glider) {
        throw new Error("Glider data not loaded in gameState!");
    }
    this.player = new Player(gameState.glider, initialStats, this.input);
  }

  public async init(): Promise<void> {
    this.input.init();

    const sprites = await generateTileCache();
    this.renderer.setSprites(sprites);

    if(!gameState.level || !gameState.allBiomes) {
        throw new Error("Level or Biome data not loaded in gameState!");
    }
    
    this.world.loadLevelFromData(gameState.level, gameState.allBiomes);
    
    const spawnPoint = this.world.findSafeSpawnPoint();
    this.player.setPosition(spawnPoint || [100, 100]);
    this.player.reset();
  }
  
  public updatePlayerStats(newStats: CalculatedGliderStats) {
      this.player.updateStats(newStats);
  }

  public start(): void {
    if (gameState.running) return;
    
    gameState.running = true;
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
    console.log("Game loop started.");
  }

  public pause(): void {
    if (!gameState.running) return;
    
    gameState.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    console.log("Game loop paused.");
  }

  public spawnProjectile(startPos: Vector2, angle: number): void {
    this.projectiles.push(new Projectile(startPos, angle));
  }
    
  public loadNextLevel(): void {
    console.log("Entering portal, loading next level...");
    
    gameState.levelDepth++;
    gameState.addExperience(200); 
    console.log(`Advancing to difficulty level: ${gameState.levelDepth}`);

    const newLevel = generateLevel(gameState.levelDepth);
    gameState.level = newLevel;
    this.world.loadLevelFromData(newLevel, gameState.allBiomes);

    const spawnPoint = this.world.findSafeSpawnPoint();
    this.player.setPosition(spawnPoint || [100, 100]);
    
    this.player.resetVelocity();
    this.player.replenishEnergy();
    gameState.updateHUD(this.player);
    gameState.saveProfile();
  }
  
  public handlePlayerDeath(reason: string): void {
      if (!gameState.running) return;

      console.log(`Player death: ${reason}`);
      this.pause();
      soundManager.playSoundEffect('explosion');
      gameState.saveProfile();

      const screen = document.getElementById('game-over-screen');
      if (screen) {
          document.getElementById('stat-time')!.textContent = `${gameState.timeSurvivedThisRun.toFixed(1)}s`;
          document.getElementById('stat-credits')!.textContent = gameState.creditsCollectedThisRun.toString();
          document.getElementById('stat-drones')!.textContent = gameState.dronesDestroyedThisRun.toString();
          document.getElementById('stat-levels')!.textContent = (gameState.levelDepth - 1).toString();
          
          screen.classList.add('visible');
      }
  }

  public restartGame(): void {
      console.log("Restarting game from level 1.");

      gameState.levelDepth = 1;
      gameState.resetRunStats();

      const newLevel = generateLevel(gameState.levelDepth);
      gameState.level = newLevel;
      this.world.loadLevelFromData(newLevel, gameState.allBiomes);

      this.player.reset();
      const spawnPoint = this.world.findSafeSpawnPoint();
      this.player.setPosition(spawnPoint || [100, 100]);
      this.player.resetVelocity();
      
      this.projectiles = [];
      this.effects = [];

      gameState.updateHUD(this.player);

      this.start();
  }

  private gameLoop(currentTime: number): void {
    if (!gameState.running) return;

    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();
    this.updateHUD();

    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  private update(deltaTime: number): void {
    this.player.update(deltaTime, this.world, this);
    this.world.update(deltaTime, this.player);
    this.updateProjectiles(deltaTime);
    this.updateEffects(deltaTime);
    gameState.timeSurvivedThisRun += deltaTime;
    gameState.checkForLevelUp(this.player);
  }
  
  private updateHUD(): void {
      gameState.updateHUD(this.player);
  }

  private updateProjectiles(deltaTime: number): void {
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

            if (distance < TILE_SIZE / 2) {
                const wasDestroyed = this.world.damagePatrol(patrol.id, proj.damage);
                if (wasDestroyed) {
                    this.effects.push({ 
                        pos: [...patrol.currentPosition], 
                        type: 'explosion', 
                        timer: 0.4, 
                        maxTime: 0.4 
                    });
                    soundManager.playSoundEffect('explosion');
                    gameState.playerCurrency += 50;
                    gameState.dronesDestroyedThisRun++;
                    gameState.addExperience(50);
                } else {
                    this.effects.push({ 
                        pos: [...proj.pos], 
                        type: 'spark', 
                        timer: 0.1, 
                        maxTime: 0.1 
                    });
                    soundManager.playSoundEffect('hit');
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
    this.renderer.render(this.world, this.player, this.projectiles, this.effects);
  }
}