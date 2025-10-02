import { LevelData, Biome, Patrol, Vector2, GameObject } from '../modules/content-types';
// FIX: Standardized player import to use consistent casing 'player.ts' to resolve TypeScript module resolution errors.
import { Player } from './player';

const TILE_SIZE = 32;
const NUM_WIND_PARTICLES = 150;
const DETECTION_RADIUS = 250; // pixels
const CHASE_RADIUS = 400; // pixels, drone gives up if player is further than this
const CHASE_SPEED_MULTIPLIER = 1.5;

type AIState = 'patrolling' | 'chasing' | 'returning';

export interface PatrolState {
    patrolData: Patrol;
    id: number;
    currentPosition: Vector2;
    targetWaypointIndex: number;
    aiState: AIState;
    health: number;
    maxHealth: number;
}

export interface WindParticle {
    pos: Vector2;
    velocity: Vector2;
}

export class World {
  private levelData: LevelData | null = null;
  private biomes: Biome[] = [];
  private activeBiome: Biome | null = null;
  private patrolStates: PatrolState[] = [];
  private windParticles: WindParticle[] = [];
  private gameObjects: GameObject[] = [];
  private loaded: boolean = false;
  
  // New properties for dynamic wind
  private windDirection: Vector2 = [1, 0];
  private windChangeInterval: number = 15; // seconds
  private windChangeTimer: number = this.windChangeInterval;

  public loadLevelFromData(levelData: LevelData, biomesData: Biome[]): void {
    try {
      this.levelData = levelData;
      this.biomes = biomesData;
      this.activeBiome = this.biomes[0] || null;
      this.gameObjects = this.levelData.gameObjects ? [...this.levelData.gameObjects] : [];
      
      this.initializePatrols();
      this.initializeWindParticles();
      
      // Reset wind direction for new level
      this.windChangeTimer = this.windChangeInterval;
      const initialAngle = Math.random() * Math.PI * 2;
      this.windDirection = [Math.cos(initialAngle), Math.sin(initialAngle)];

      this.loaded = true;
      if (this.levelData && this.activeBiome) {
        console.log(`Level "${this.levelData.id}" loaded with biome "${this.activeBiome.name}".`);
      }
    } catch (error) {
      console.error(`Failed to process level or biomes`, error);
      this.loaded = false;
    }
  }

  public findSafeSpawnPoint(): Vector2 | null {
    if (!this.levelData) return null;

    // Find the '#' tile which is now placed at a good spot by the generator
    for (let y = 0; y < this.levelData.height; y++) {
      for (let x = 0; x < this.levelData.width; x++) {
        if (this.levelData.tiles[y][x] === '#') {
           return [
             x * TILE_SIZE + TILE_SIZE / 2,
             y * TILE_SIZE + TILE_SIZE / 2
           ];
        }
      }
    }
    
    console.warn("No safe spawn point ('#') found in the level. Defaulting.");
    return null;
  }

  private initializePatrols(): void {
      if (!this.levelData) return;
      this.patrolStates = this.levelData.patrols.map((p, index) => ({
          patrolData: p,
          id: index,
          currentPosition: [p.path[0][0] * TILE_SIZE, p.path[0][1] * TILE_SIZE],
          targetWaypointIndex: 1,
          aiState: 'patrolling',
          health: 100,
          maxHealth: 100
      }));
  }

  private initializeWindParticles(): void {
      this.windParticles = [];
      for (let i = 0; i < NUM_WIND_PARTICLES; i++) {
          this.windParticles.push({
              pos: [Math.random() * 1024, Math.random() * 640],
              velocity: [0, 0]
          });
      }
  }

  public update(deltaTime: number, player: Player): void {
    if (!this.loaded || !this.levelData) return;

    // Update wind direction periodically
    this.windChangeTimer -= deltaTime;
    if (this.windChangeTimer <= 0) {
        const randomAngle = Math.random() * Math.PI * 2;
        this.windDirection = [Math.cos(randomAngle), Math.sin(randomAngle)];
        this.windChangeTimer = this.windChangeInterval;
    }
    
    this.updatePatrols(deltaTime, player);
    this.updateWind(deltaTime);
  }

  private findClosestWaypoint(position: Vector2, path: Vector2[]): number {
    let closestIndex = 0;
    let minDistance = Infinity;

    path.forEach((waypoint, index) => {
        const waypointPos: Vector2 = [waypoint[0] * TILE_SIZE, waypoint[1] * TILE_SIZE];
        const distance = Math.sqrt(Math.pow(waypointPos[0] - position[0], 2) + Math.pow(waypointPos[1] - position[1], 2));
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
        }
    });

    return closestIndex;
  }

  private updatePatrols(deltaTime: number, player: Player): void {
      const playerPos = player.getPosition();

      this.patrolStates.forEach(state => {
          const dx = playerPos[0] - state.currentPosition[0];
          const dy = playerPos[1] - state.currentPosition[1];
          const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

          // --- State Transitions ---
          switch (state.aiState) {
              case 'patrolling':
                  if (distanceToPlayer < DETECTION_RADIUS) {
                      state.aiState = 'chasing';
                  }
                  break;
              case 'chasing':
                  if (distanceToPlayer > CHASE_RADIUS) {
                      state.aiState = 'returning';
                  }
                  break;
              case 'returning':
                  const closestWaypointIndex = this.findClosestWaypoint(state.currentPosition, state.patrolData.path);
                  state.targetWaypointIndex = closestWaypointIndex;
                  const targetNode = state.patrolData.path[state.targetWaypointIndex];
                  const targetPos: Vector2 = [targetNode[0] * TILE_SIZE, targetNode[1] * TILE_SIZE];
                  const distToWaypoint = Math.sqrt(Math.pow(targetPos[0] - state.currentPosition[0], 2) + Math.pow(targetPos[1] - state.currentPosition[1], 2));

                  if (distToWaypoint < 10) { // Close enough to path
                      state.aiState = 'patrolling';
                  }
                  break;
          }

          // --- State Actions ---
          let targetPos: Vector2;
          let speedMultiplier = 1.0;

          switch (state.aiState) {
              case 'chasing':
                  targetPos = playerPos;
                  speedMultiplier = CHASE_SPEED_MULTIPLIER;
                  break;
              case 'returning':
                  const returnNode = state.patrolData.path[state.targetWaypointIndex];
                  targetPos = [returnNode[0] * TILE_SIZE, returnNode[1] * TILE_SIZE];
                  break;
              case 'patrolling':
              default:
                  const patrolNode = state.patrolData.path[state.targetWaypointIndex];
                  targetPos = [patrolNode[0] * TILE_SIZE, patrolNode[1] * TILE_SIZE];
                  const distToPatrolTarget = Math.sqrt(Math.pow(targetPos[0] - state.currentPosition[0], 2) + Math.pow(targetPos[1] - state.currentPosition[1], 2));
                  if (distToPatrolTarget < 5) {
                      state.targetWaypointIndex = (state.targetWaypointIndex + 1) % state.patrolData.path.length;
                  }
                  break;
          }
          
          // Move towards target
          const moveDx = targetPos[0] - state.currentPosition[0];
          const moveDy = targetPos[1] - state.currentPosition[1];
          const moveDistance = Math.sqrt(moveDx*moveDx + moveDy*moveDy);

          if (moveDistance > 1) { // To avoid jittering
               const moveSpeed = state.patrolData.speed * TILE_SIZE * 0.5 * speedMultiplier;
               state.currentPosition[0] += (moveDx / moveDistance) * moveSpeed * deltaTime;
               state.currentPosition[1] += (moveDy / moveDistance) * moveSpeed * deltaTime;
          }
      });
  }

  private updateWind(deltaTime: number): void {
      if (!this.levelData) return;
      const wind = this.levelData.wind;
      this.windParticles.forEach(p => {
          const windVelocityX = wind.amp * 5;
          // FIX: Access Vector2 by index, not by property 'y'.
          const windVelocityY = Math.sin(p.pos[1] * wind.scale * 0.1) * wind.gusts[0] * 1.5;

          p.velocity[0] = windVelocityX;
          p.velocity[1] = windVelocityY;
          
          p.pos[0] += p.velocity[0] * deltaTime;
          p.pos[1] += p.velocity[1] * deltaTime;

          if (p.pos[0] > 1024) p.pos[0] = 0;
          if (p.pos[0] < 0) p.pos[0] = 1024;
          if (p.pos[1] > 640) p.pos[1] = 0;
          if (p.pos[1] < 0) p.pos[1] = 640;
      });
  }

  public damagePatrol(patrolId: number, damage: number): boolean { // returns true if destroyed
    const patrol = this.patrolStates.find(p => p.id === patrolId);
    if (patrol && patrol.health > 0) {
        patrol.health = Math.max(0, patrol.health - damage);
        if (patrol.health === 0) {
            this.destroyPatrol(patrolId);
            return true;
        }
    }
    return false;
  }

  private destroyPatrol(patrolId: number): void {
    const index = this.patrolStates.findIndex(p => p.id === patrolId);
    if (index !== -1) {
      this.patrolStates.splice(index, 1);
    }
  }

  public getLevelData(): LevelData {
    if (!this.levelData) {
      throw new Error("Attempted to access level data before it was loaded.");
    }
    return this.levelData;
  }
  
  public getActiveBiome(): Biome | null {
      return this.activeBiome;
  }

  public getPatrolStates(): PatrolState[] {
      return this.patrolStates;
  }

  public getWindParticles(): WindParticle[] {
      return this.windParticles;
  }

  public getWind(): { direction: Vector2; strength: number } {
    if (!this.levelData) {
        return { direction: [0, 0], strength: 0 };
    }
    return {
        direction: this.windDirection,
        strength: this.levelData.wind.amp
    };
  }
    
  public getGameObjects(): GameObject[] {
      return this.gameObjects;
  }

  public removeGameObject(id: string): void {
      this.gameObjects = this.gameObjects.filter(obj => obj.id !== id);
  }

  public isLoaded(): boolean {
    return this.loaded;
  }
}