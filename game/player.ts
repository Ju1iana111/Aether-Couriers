// FIX: Moved Player class implementation here from game/Player.ts to resolve a module casing conflict.
import { Glider, Vector2, GadgetIdentifier, GliderEngine } from '../modules/content-types';
import { InputHandler } from '../engine/InputHandler';
import { World } from './World';
import { Scene } from './scene';
import { gameState, CalculatedGliderStats } from '../modules/game-state';
import { soundManager } from '../modules/sound-manager';

const TILE_SIZE = 32;
const BOOST_ENERGY_COST = 25;
const THRUST_ENERGY_COST_PER_SECOND = 15;
const TURN_ENERGY_COST_PER_SECOND = 5;
const AFTERBURNER_FORCE = 150;
const AFTERBURNER_COST_PER_SECOND = 30;
const PATROL_DAMAGE_PASSIVE = 10;
const PATROL_DAMAGE_ACTIVE = 35;
const FIRE_RATE = 5;
const WEAPON_ENERGY_COST = 2;
const RESOURCE_EXP_GAIN = 15;


export class Player {
  private gliderTemplate: Glider;
  private stats: CalculatedGliderStats;
  private input: InputHandler;
  
  private pos: Vector2 = [0, 0];
  private vel: Vector2 = [0, 0];
  private angle: number = -Math.PI / 2;
  private boostCooldown: number = 0;
  private fireCooldown: number = 0;
  
  private health: number = 100;
  private energy: number = 100;

  private overchargeTimer: number = 0;
  private weaponBoostTimer: number = 0;
  private shieldTimer: number = 0;
  private equippedGadgets: GadgetIdentifier[] = [];
  private gadgetCooldowns: number[] = [];
  
  private thrustForce: number = 350;

  constructor(gliderTemplate: Glider, initialStats: CalculatedGliderStats, input: InputHandler) {
    this.gliderTemplate = gliderTemplate;
    this.stats = initialStats;
    this.input = input;
    this.updateStats(initialStats);
  }

  public updateStats(newStats: CalculatedGliderStats) {
      this.stats = newStats;
      const engine = gameState.allEngines.find(e => e.id === gameState.playerProfile?.equippedEngine)!;
      this.thrustForce = 350 * engine.thrustModifier;
      this.equippedGadgets = this.gliderTemplate.gadgets.slice(0, this.stats.gadgetSlots);
      this.gadgetCooldowns = new Array(this.equippedGadgets.length).fill(0);
      this.recalculateStats();
  }

  public recalculateStats(): void {
    const level = gameState.playerLevel;
    const oldMaxHealth = this.getMaxHealth();
    const oldMaxEnergy = this.getMaxEnergy();

    // Base stats come from parts, then modified by pilot level
    const baseHealth = this.stats.maxHealth;
    const baseEnergy = this.stats.maxEnergy;
    const healthPerLevel = 5;
    const energyPerLevel = 3;

    const newMaxHealth = baseHealth + (level - 1) * healthPerLevel;
    const newMaxEnergy = baseEnergy + (level - 1) * energyPerLevel;
    
    // If stats increased, add the difference to current health/energy
    if (newMaxHealth > oldMaxHealth) {
        this.health += newMaxHealth - oldMaxHealth;
    }
    if (newMaxEnergy > oldMaxEnergy) {
        this.energy += newMaxEnergy - oldMaxEnergy;
    }
    
    // Ensure we don't exceed the new max
    this.health = Math.min(this.health, newMaxHealth);
    this.energy = Math.min(this.energy, newMaxEnergy);

    console.log(`Stats recalculated for Level ${level}: HP=${newMaxHealth}, EN=${newMaxEnergy}`);
  }

  public update(deltaTime: number, world: World, scene: Scene): void {
    if (this.health <= 0) return;

    this.boostCooldown = Math.max(0, this.boostCooldown - deltaTime);
    this.fireCooldown = Math.max(0, this.fireCooldown - deltaTime);
    this.overchargeTimer = Math.max(0, this.overchargeTimer - deltaTime);
    this.weaponBoostTimer = Math.max(0, this.weaponBoostTimer - deltaTime);
    this.shieldTimer = Math.max(0, this.shieldTimer - deltaTime);
    for (let i = 0; i < this.gadgetCooldowns.length; i++) {
        this.gadgetCooldowns[i] = Math.max(0, this.gadgetCooldowns[i] - deltaTime);
    }
    
    const currentRegenRate = this.overchargeTimer > 0 ? this.stats.energyRegen * 3 : this.stats.energyRegen;
    this.energy = Math.min(this.getMaxEnergy(), this.energy + currentRegenRate * deltaTime);
    
    if ((this.input.isPressed('w') || this.input.isPressed('ц')) && this.energy > 0) {
      this.vel[0] += Math.cos(this.angle) * this.thrustForce * deltaTime;
      this.vel[1] += Math.sin(this.angle) * this.thrustForce * deltaTime;
      this.energy = Math.max(0, this.energy - THRUST_ENERGY_COST_PER_SECOND * deltaTime);
    }
    if ((this.input.isPressed('a') || this.input.isPressed('ф')) && this.energy > 0) {
      this.angle -= this.stats.physics.rotation_speed * deltaTime;
      this.energy = Math.max(0, this.energy - TURN_ENERGY_COST_PER_SECOND * deltaTime);
    }
    if ((this.input.isPressed('d') || this.input.isPressed('в')) && this.energy > 0) {
      this.angle += this.stats.physics.rotation_speed * deltaTime;
      this.energy = Math.max(0, this.energy - TURN_ENERGY_COST_PER_SECOND * deltaTime);
    }
    if (this.input.isPressed(' ') && this.boostCooldown === 0 && this.energy >= BOOST_ENERGY_COST) {
        this.energy -= BOOST_ENERGY_COST;
        this.vel[0] += Math.cos(this.angle) * this.stats.physics.boost_impulse;
        this.vel[1] += Math.sin(this.angle) * this.stats.physics.boost_impulse;
        this.boostCooldown = this.stats.physics.cooldown;
        soundManager.playSoundEffect('boost');
    }
    if ((this.input.isPressed('shift') || this.input.isPressed('с')) && this.energy > 0) {
        this.vel[0] += Math.cos(this.angle) * AFTERBURNER_FORCE * deltaTime;
        this.vel[1] += Math.sin(this.angle) * AFTERBURNER_FORCE * deltaTime;
        this.energy = Math.max(0, this.energy - AFTERBURNER_COST_PER_SECOND * deltaTime);
    }
    
    if (this.input.isPressed('q') || this.input.isPressed('й')) { this.tryActivateGadget(0); }
    if (this.input.isPressed('e') || this.input.isPressed('у')) { this.tryActivateGadget(1); }
    if (this.input.isPressed('r') || this.input.isPressed('к')) { this.tryActivateGadget(2); }

    const currentFireRate = this.weaponBoostTimer > 0 ? FIRE_RATE * 2 : FIRE_RATE;
    const currentWeaponCost = this.weaponBoostTimer > 0 ? WEAPON_ENERGY_COST / 2 : WEAPON_ENERGY_COST;
    if (this.input.isMousePressed() && this.fireCooldown === 0 && this.energy >= currentWeaponCost) {
        this.energy -= currentWeaponCost;
        this.fireCooldown = 1 / currentFireRate;
        scene.spawnProjectile(this.pos, this.angle);
        soundManager.playSoundEffect('laser');
    }

    const powerlessDrag = 0.92;
    const currentDrag = this.energy > 0 ? this.stats.physics.drag : powerlessDrag;

    if (world.isLoaded()) {
        const wind = world.getWind();
        const windForceMultiplier = 12;
        this.vel[0] += wind.direction[0] * wind.strength * windForceMultiplier * deltaTime;
        this.vel[1] += wind.direction[1] * wind.strength * windForceMultiplier * deltaTime;
    }

    const rightVector: Vector2 = [-Math.sin(this.angle), Math.cos(this.angle)];
    const sidewaysSpeed = this.vel[0] * rightVector[0] + this.vel[1] * rightVector[1];
    this.vel[0] -= rightVector[0] * sidewaysSpeed * this.stats.physics.stabilization;
    this.vel[1] -= rightVector[1] * sidewaysSpeed * this.stats.physics.stabilization;

    this.vel[0] *= Math.pow(currentDrag, deltaTime * 60);
    this.vel[1] *= Math.pow(currentDrag, deltaTime * 60);
    
    this.pos[0] += this.vel[0] * deltaTime;
    this.pos[1] += this.vel[1] * deltaTime;
    
    this.handleCollision(world, deltaTime);
    this.handleObjectInteractions(world, scene);
    this.handlePatrolCollision(world, scene);
    this.checkTileHazards(world, scene);
    this.checkMapBounds(world, scene);
  }
  
  private tryActivateGadget(slotIndex: number): void {
    if (slotIndex >= this.equippedGadgets.length || this.gadgetCooldowns[slotIndex] > 0) {
        return;
    }

    const gadgetId = this.equippedGadgets[slotIndex];
    const gadgetDef = gameState.allGadgets.find(g => g.id === gadgetId);

    if (gadgetDef && this.energy >= gadgetDef.energy_cost) {
        this.energy -= gadgetDef.energy_cost;
        this.gadgetCooldowns[slotIndex] = gadgetDef.cooldown;
        
        switch(gadgetDef.id) {
            case 'shield':
                this.shieldTimer = gadgetDef.duration || 2;
                break;
            case 'microjet':
            case 'boost':
                const impulse = (gadgetDef.impulse || 2.5) * 100;
                this.vel[0] += Math.cos(this.angle) * impulse;
                this.vel[1] += Math.sin(this.angle) * impulse;
                soundManager.playSoundEffect('boost');
                break;
            case 'grapple':
                const grappleImpulse = 250;
                this.vel[0] += Math.cos(this.angle) * grappleImpulse;
                this.vel[1] += Math.sin(this.angle) * grappleImpulse;
                soundManager.playSoundEffect('boost');
                break;
            case 'fuel':
                this.energy = Math.min(this.getMaxEnergy(), this.energy + 50);
                soundManager.playSoundEffect('pickup');
                break;
        }
    }
  }

  private handleCollision(world: World, deltaTime: number): void {
      if (!world.isLoaded()) return;
      const level = world.getLevelData();
      if (!level.tiles) return;

      const playerTileX = Math.floor(this.pos[0] / TILE_SIZE);
      const playerTileY = Math.floor(this.pos[1] / TILE_SIZE);
      
      if (level.tiles[playerTileY] && level.tiles[playerTileY][playerTileX]) {
          const tile = level.tiles[playerTileY][playerTileX];
          if (tile === 'X') {
              this.pos[0] -= this.vel[0] * deltaTime; 
              this.pos[1] -= this.vel[1] * deltaTime;
              this.vel[0] *= -0.5;
              this.vel[1] *= -0.5;
          }
      }
  }
  
  private handleObjectInteractions(world: World, scene: Scene): void {
    if (!world.isLoaded()) return;

    const objects = world.getGameObjects();
    const objectsToRemove: string[] = [];

    for (const obj of objects) {
        const objWorldX = obj.pos[0] * TILE_SIZE + TILE_SIZE / 2;
        const objWorldY = obj.pos[1] * TILE_SIZE + TILE_SIZE / 2;
        
        const dx = this.pos[0] - objWorldX;
        const dy = this.pos[1] - objWorldY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < TILE_SIZE * 0.75) {
            switch (obj.type) {
                case 'credit':
                    gameState.playerCurrency += obj.value;
                    gameState.creditsCollectedThisRun += obj.value;
                    gameState.addExperience(obj.value / 10);
                    objectsToRemove.push(obj.id);
                    soundManager.playSoundEffect('pickup');
                    break;
                case 'mine':
                    this.takeDamage(obj.damage, scene);
                    this.vel = [this.vel[0] * 0.1, this.vel[1] * 0.1];
                    objectsToRemove.push(obj.id);
                    soundManager.playSoundEffect('explosion');
                    break;
                case 'exit':
                    soundManager.playSoundEffect('portal');
                    scene.loadNextLevel();
                    break;
                case 'shard':
                    this.weaponBoostTimer = 8;
                    objectsToRemove.push(obj.id);
                    soundManager.playSoundEffect('pickup');
                    gameState.addExperience(RESOURCE_EXP_GAIN);
                    break;
                case 'fuel':
                    this.energy = Math.min(this.getMaxEnergy(), this.energy + 50);
                    objectsToRemove.push(obj.id);
                    soundManager.playSoundEffect('pickup');
                    gameState.addExperience(RESOURCE_EXP_GAIN);
                    break;
                case 'overcharge':
                    this.overchargeTimer = 10;
                    objectsToRemove.push(obj.id);
                    soundManager.playSoundEffect('pickup');
                    gameState.addExperience(RESOURCE_EXP_GAIN);
                    break;
            }
        }
    }

    if (objectsToRemove.length > 0) {
        objectsToRemove.forEach(id => world.removeGameObject(id));
    }
  }

  private handlePatrolCollision(world: World, scene: Scene): void {
      if (!world.isLoaded()) return;

      const patrols = world.getPatrolStates();
      for (const patrol of patrols) {
          const dx = this.pos[0] - patrol.currentPosition[0];
          const dy = this.pos[1] - patrol.currentPosition[1];
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < TILE_SIZE * 0.75) {
              const damage = patrol.aiState === 'chasing' ? PATROL_DAMAGE_ACTIVE : PATROL_DAMAGE_PASSIVE;
              this.takeDamage(damage, scene);

              const knockbackStrength = patrol.aiState === 'chasing' ? 200 : 100;
              const angle = Math.atan2(dy, dx);
              this.vel[0] = Math.cos(angle) * knockbackStrength;
              this.vel[1] = Math.sin(angle) * knockbackStrength;
          }
      }
  }

  private checkTileHazards(world: World, scene: Scene): void {
      if (this.health <= 0 || !world.isLoaded()) return;
      
      const level = world.getLevelData();
      const playerTileX = Math.floor(this.pos[0] / TILE_SIZE);
      const playerTileY = Math.floor(this.pos[1] / TILE_SIZE);

      if (playerTileY >= 0 && playerTileY < level.height && playerTileX >= 0 && playerTileX < level.width) {
          const tile = level.tiles[playerTileY][playerTileX];
          if (tile === 'O') {
              this.health = 0;
              scene.handlePlayerDeath("Fell into a void pit");
          }
      }
  }

  private checkMapBounds(world: World, scene: Scene): void {
      if (this.health <= 0 || !world.isLoaded()) return;
      
      const level = world.getLevelData();
      const MAP_WIDTH_PX = level.width * TILE_SIZE;
      const MAP_HEIGHT_PX = level.height * TILE_SIZE;

      if (this.pos[0] < 0 || this.pos[0] > MAP_WIDTH_PX || this.pos[1] < 0 || this.pos[1] > MAP_HEIGHT_PX) {
          this.health = 0;
          scene.handlePlayerDeath("Fell out of the world");
      }
  }

  public takeDamage(amount: number, scene: Scene): void {
      if (this.health <= 0 || this.shieldTimer > 0) return;

      this.health = Math.max(0, this.health - amount);
      console.log(`Took ${amount} damage. Health is now ${this.health}`);
      soundManager.playSoundEffect('damage');
      
      const overlay = document.getElementById('damage-overlay');
      if (overlay) {
          overlay.classList.add('active');
          setTimeout(() => overlay.classList.remove('active'), 150);
      }

      if (this.health <= 0) {
          scene.handlePlayerDeath("Health depleted");
      }
  }

  public reset(): void {
    this.recalculateStats();
    this.health = this.getMaxHealth();
    this.energy = this.getMaxEnergy();
    this.vel = [0, 0];
    this.overchargeTimer = 0;
    this.weaponBoostTimer = 0;
    this.shieldTimer = 0;
    this.gadgetCooldowns.fill(0);
  }
  
  public replenishEnergy(): void {
    this.energy = this.getMaxEnergy();
  }

  public resetVelocity(): void {
      this.vel = [0, 0];
  }

  public getPosition(): Vector2 {
    return this.pos;
  }

  public getAngle(): number {
    return this.angle;
  }
  
  public getEnergy(): number {
      return this.energy;
  }

  public getMaxEnergy(): number {
      const base = this.stats.maxEnergy;
      return base + (gameState.playerLevel - 1) * 3;
  }
  
  public getHealth(): number {
    return this.health;
  }

  public getMaxHealth(): number {
    const base = this.stats.maxHealth;
    return base + (gameState.playerLevel - 1) * 5;
  }

  public setPosition(pos: Vector2): void {
    this.pos = pos;
  }
  
  public getEquippedGadgets(): GadgetIdentifier[] {
    return this.equippedGadgets;
  }

  public getGadgetCooldowns(): number[] {
      return this.gadgetCooldowns;
  }
    
  public getActiveBuffs(): { type: 'shield' | 'weapon_boost' | 'overcharge', timer: number }[] {
    const active = [];
    if (this.shieldTimer > 0) {
        active.push({ type: 'shield', timer: this.shieldTimer });
    }
    if (this.weaponBoostTimer > 0) {
        active.push({ type: 'weapon_boost', timer: this.weaponBoostTimer });
    }
    if (this.overchargeTimer > 0) {
        active.push({ type: 'overcharge', timer: this.overchargeTimer });
    }
    return active;
  }
}