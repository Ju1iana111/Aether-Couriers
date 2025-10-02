import { World } from '../game/World';
// FIX: Standardized player import to use consistent casing 'player.ts' to resolve TypeScript module resolution errors.
import { Player } from '../game/player';
import { LevelData as Level, Biome, Vector2, GameObject } from '../modules/content-types';
import { PatrolState, WindParticle } from '../game/World';
import { Projectile } from '../game/Projectile';
import { VisualEffect } from '../game/scene';

const TILE_SIZE = 32;

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sprites: Map<string, ImageBitmap> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    if (!this.ctx) {
      throw new Error("Could not get 2D rendering context");
    }
  }

  public setSprites(sprites: Map<string, ImageBitmap>): void {
    this.sprites = sprites;
  }

  public render(world: World, player: Player, projectiles: Projectile[], effects: VisualEffect[]): void {
    const bgColor = world.getActiveBiome() ? world.getActiveBiome()!.palette[0] : '#0a0a1a';
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (!world.isLoaded()) {
        this.ctx.fillStyle = 'white';
        this.ctx.fillText("Loading level...", 50, 50);
        return;
    }
    
    // A simple camera that follows the player
    const cameraX = player.getPosition()[0] - this.canvas.width / 2;
    const cameraY = player.getPosition()[1] - this.canvas.height / 2;

    this.ctx.save();
    this.ctx.translate(-cameraX, -cameraY);

    this.drawWorld(world.getLevelData());
    this.drawGameObjects(world.getGameObjects());
    this.drawPatrols(world.getPatrolStates());
    this.drawPlayer(player);
    this.drawProjectiles(projectiles);
    this.drawEffects(effects);
    
    this.ctx.restore();
    
    // Draw wind particles in screen space (so they appear to move over everything)
    this.drawWind(world.getWindParticles());
  }

  private drawWorld(level: Level): void {
      for (let y = 0; y < level.tiles.length; y++) {
          for (let x = 0; x < level.tiles[y].length; x++) {
              const tile = level.tiles[y][x];
              let sprite: ImageBitmap | undefined;

              switch (tile) {
                  case '.':
                      sprite = this.sprites.get('ground');
                      break;
                  case 'X':
                      sprite = this.sprites.get('stone');
                      break;
                  case '#':
                      sprite = this.sprites.get('start');
                      break;
                  case 'O':
                      sprite = this.sprites.get('pit');
                      break;
                  case 'G': // This case may no longer be used but is kept for compatibility
                      sprite = this.sprites.get('portal');
                      break;
              }
              
              if (sprite) {
                  this.ctx.drawImage(sprite, x * TILE_SIZE, y * TILE_SIZE);
              }
          }
      }
  }

  private drawGameObjects(objects: GameObject[]): void {
    objects.forEach(obj => {
        const x = obj.pos[0] * TILE_SIZE + TILE_SIZE / 2;
        const y = obj.pos[1] * TILE_SIZE + TILE_SIZE / 2;
        this.ctx.beginPath();

        switch (obj.type) {
            case 'credit':
                this.ctx.fillStyle = '#facc15'; // yellow-400
                this.ctx.arc(x, y, TILE_SIZE / 3, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.fillStyle = '#ca8a04'; // yellow-600
                this.ctx.font = `bold ${TILE_SIZE/2}px sans-serif`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('$', x, y);
                break;
            case 'mine':
                this.ctx.fillStyle = '#b91c1c'; // red-800
                this.ctx.arc(x, y, TILE_SIZE / 3, 0, Math.PI * 2);
                this.ctx.fill();
                // Spikes
                this.ctx.strokeStyle = '#dc2626'; // red-600
                this.ctx.lineWidth = 2;
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, y);
                    this.ctx.lineTo(x + Math.cos(angle) * TILE_SIZE/2.2, y + Math.sin(angle) * TILE_SIZE/2.2);
                    this.ctx.stroke();
                }
                break;
            case 'exit':
                const gradient = this.ctx.createRadialGradient(x, y, TILE_SIZE/4, x, y, TILE_SIZE/2);
                gradient.addColorStop(0, '#a78bfa'); // violet-400
                gradient.addColorStop(1, '#5b21b6'); // violet-800
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
                break;
            case 'shard': // Weapon Power-up
                this.ctx.fillStyle = '#f59e0b'; // amber-500
                this.ctx.strokeStyle = '#d97706'; // amber-600
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
                    const outerRadius = TILE_SIZE / 2.5;
                    const innerRadius = outerRadius / 2;
                    // Outer point
                    this.ctx.lineTo(x + outerRadius * Math.cos(angle), y + outerRadius * Math.sin(angle));
                    // Inner point
                    const innerAngle = angle + Math.PI / 5;
                    this.ctx.lineTo(x + innerRadius * Math.cos(innerAngle), y + innerRadius * Math.sin(innerAngle));
                }
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
                break;
            case 'fuel': // Energy Cell
                this.ctx.fillStyle = '#22c55e'; // green-500
                this.ctx.strokeStyle = '#16a34a'; // green-600
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.rect(x - TILE_SIZE / 4, y - TILE_SIZE / 3, TILE_SIZE / 2, TILE_SIZE / 1.5);
                this.ctx.fill();
                this.ctx.stroke();
                this.ctx.fillStyle = '#bbf7d0'; // green-200
                this.ctx.font = `bold ${TILE_SIZE/2.5}px sans-serif`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('E', x, y);
                break;
            case 'overcharge': // System Overcharge
                this.ctx.fillStyle = '#3b82f6'; // blue-500
                this.ctx.strokeStyle = '#2563eb'; // blue-600
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    this.ctx.lineTo(x + (TILE_SIZE / 2.5) * Math.cos(angle), y + (TILE_SIZE / 2.5) * Math.sin(angle));
                }
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
                // Lightning Bolt
                this.ctx.strokeStyle = '#facc15'; // yellow-400
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(x + 6, y - 7);
                this.ctx.lineTo(x - 2, y);
                this.ctx.lineTo(x + 2, y);
                this.ctx.lineTo(x - 6, y + 7);
                this.ctx.stroke();
                break;
        }
    });
  }

  private drawPlayer(player: Player): void {
    const [x, y] = player.getPosition();
    const angle = player.getAngle();

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    // Glider Body (Triangle shape)
    this.ctx.fillStyle = '#eab308';
    this.ctx.strokeStyle = '#fde047';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(12, 0);
    this.ctx.lineTo(-8, -8);
    this.ctx.lineTo(-8, 8);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
  }
  
  private drawPatrols(patrols: PatrolState[]): void {
    patrols.forEach(state => {
        const [x, y] = state.currentPosition;
        
        // --- Determine color based on AI state ---
        let bodyColor = '#ef4444'; // red-500 default (patrolling)
        let glowColor = '#f87171'; // red-400
        
        if (state.aiState === 'chasing') {
            bodyColor = '#f97316'; // orange-500
            glowColor = '#fb923c'; // orange-400
        } else if (state.aiState === 'returning') {
            bodyColor = '#3b82f6'; // blue-500
            glowColor = '#60a5fa'; // blue-400
        }

        this.ctx.fillStyle = bodyColor;
        this.ctx.strokeStyle = glowColor;
        this.ctx.lineWidth = 2;

        // Pulsating effect
        const pulse = Math.abs(Math.sin(performance.now() / 200));
        const radius = TILE_SIZE / 3 + pulse * 2;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.globalAlpha = 0.5 + pulse * 0.5;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    });
  }

  private drawWind(particles: WindParticle[]): void {
    this.ctx.strokeStyle = 'rgba(200, 220, 255, 0.4)';
    this.ctx.lineWidth = 1.5;
    particles.forEach(p => {
        this.ctx.beginPath();
        this.ctx.moveTo(p.pos[0], p.pos[1]);
        this.ctx.lineTo(p.pos[0] - p.velocity[0], p.pos[1] - p.velocity[1]);
        this.ctx.stroke();
    });
  }

  private drawProjectiles(projectiles: Projectile[]): void {
    this.ctx.fillStyle = '#7dd3fc'; // sky-300
    this.ctx.strokeStyle = '#e0f2fe'; // sky-100
    this.ctx.lineWidth = 1;

    projectiles.forEach(p => {
        this.ctx.beginPath();
        this.ctx.arc(p.pos[0], p.pos[1], 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
    });
  }

  private drawEffects(effects: VisualEffect[]): void {
      effects.forEach(effect => {
          const progress = 1 - (effect.timer / effect.maxTime);
          
          if (effect.type === 'explosion') {
              const radius = progress * 40;
              const alpha = 1 - progress;
              this.ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.8})`; // amber-400
              this.ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`; // amber-500
              this.ctx.lineWidth = 3;
              this.ctx.beginPath();
              this.ctx.arc(effect.pos[0], effect.pos[1], radius, 0, Math.PI * 2);
              this.ctx.fill();
              this.ctx.stroke();
          } else if (effect.type === 'spark') {
              const size = (1 - progress) * 10;
              this.ctx.fillStyle = '#f8fafc'; // slate-50
              this.ctx.beginPath();
              this.ctx.arc(effect.pos[0], effect.pos[1], size, 0, Math.PI * 2);
              this.ctx.fill();
          }
      });
  }
}