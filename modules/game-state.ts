import { LevelData, Gadget, StoryEvent, Challenge, Glider, GliderPhysics, Biome, PlayerProgress, Melody, GadgetIdentifier, GliderChassis, GliderWings, GliderEngine } from './content-types';
// FIX: Standardized player import to use consistent casing 'player.ts' to resolve TypeScript module resolution errors.
import { Player } from '../game/player';
import { Storage } from '../engine/Storage';
import { PlayerProfile } from './content-types';

export const storage = new Storage('AetherCouriersDB');

export interface CalculatedGliderStats {
    physics: GliderPhysics;
    maxHealth: number;
    maxEnergy: number;
    energyRegen: number;
    gadgetSlots: number;
}

/**
 * Calculates the final stats of a glider based on equipped parts.
 * @returns A composite object with final physics and player stats.
 */
export function calculateGliderStats(
    chassisId: string,
    wingsId: string,
    engineId: string
): CalculatedGliderStats {
    const basePhysics = gameState.physics!;

    const chassis = gameState.allChassis.find(c => c.id === chassisId)!;
    const wings = gameState.allWings.find(w => w.id === wingsId)!;
    const engine = gameState.allEngines.find(e => e.id === engineId)!;

    const modifiedPhysics: GliderPhysics = {
        ...basePhysics,
        rotation_speed: basePhysics.rotation_speed * wings.rotationSpeedModifier,
        stabilization: basePhysics.stabilization * wings.stabilizationModifier,
        drag: basePhysics.drag * chassis.dragModifier,
        boost_impulse: basePhysics.boost_impulse * engine.boostImpulseModifier,
    };
    
    // Note: thrust is handled inside Player.ts, using the modifier directly

    return {
        physics: modifiedPhysics,
        maxHealth: chassis.baseHealth,
        maxEnergy: chassis.baseEnergy,
        energyRegen: 1.0 * engine.energyRegenModifier, // Base regen rate * modifier
        gadgetSlots: chassis.gadgetSlots,
    };
}


class GameState {
  // Loaded Content
  public level: LevelData | null = null;
  public allGadgets: Gadget[] = [];
  public allEvents: StoryEvent[] = [];
  public allChallenges: Challenge[] = [];
  public tutorialMarkdown: string = '';
  public glider: Glider | null = null; // Base template glider
  public physics: GliderPhysics | null = null; // Base physics template
  public allBiomes: Biome[] = [];
  public playerProgress: PlayerProgress[] = [];
  public melody: Melody | null = null;
  
  // New modular parts content
  public allChassis: GliderChassis[] = [];
  public allWings: GliderWings[] = [];
  public allEngines: GliderEngine[] = [];
  
  // Meta-progression State
  public playerProfile: PlayerProfile | null = null;

  // Player State
  public playerCurrency: number = 0;
  public playerLevel: number = 1;
  public playerExperience: number = 0;
  public nextLevelExp: number = 1000;
  public levelDepth: number = 1;
  
  // Game Flow State
  public running: boolean = false;
  
  // Current Run Statistics
  public creditsCollectedThisRun: number = 0;
  public dronesDestroyedThisRun: number = 0;
  public timeSurvivedThisRun: number = 0;

  public setContent(content: {
    level: LevelData,
    gadgets: Gadget[],
    events: StoryEvent[],
    challenges: Challenge[],
    tutorial: string,
    glider: Glider,
    physics: GliderPhysics,
    biomes: Biome[],
    playerProgress: PlayerProgress[],
    melody: Melody,
    chassis: GliderChassis[],
    wings: GliderWings[],
    engines: GliderEngine[]
  }, profile: PlayerProfile) {
    this.level = content.level;
    this.allGadgets = content.gadgets;
    this.allEvents = content.events;
    this.allChallenges = content.challenges;
    this.tutorialMarkdown = content.tutorial;
    this.glider = content.glider;
    this.physics = content.physics;
    this.allBiomes = content.biomes;
    this.playerProgress = content.playerProgress;
    this.melody = content.melody;
    this.allChassis = content.chassis;
    this.allWings = content.wings;
    this.allEngines = content.engines;
    
    this.playerProfile = profile;
    this.playerCurrency = profile.currency;
    this.playerLevel = profile.pilotLevel;
    this.playerExperience = profile.experience;

    // Determine next level XP
    const progressData = this.playerProgress.find(p => p.pilot_level === this.playerLevel) 
        || { next_level_exp: 1000 * Math.pow(1.5, this.playerLevel - 1) };
    this.nextLevelExp = progressData.next_level_exp;
  }
  
  public addExperience(amount: number): void {
    if (this.running) {
        this.playerExperience += amount;
    }
  }

  public checkForLevelUp(player: Player): void {
    while(this.playerExperience >= this.nextLevelExp) {
        this.playerExperience -= this.nextLevelExp;
        this.playerLevel++;
        this.nextLevelExp = Math.floor(this.nextLevelExp * 1.5); // Increase XP requirement for next level
        
        console.log(`LEVEL UP! Reached level ${this.playerLevel}. Next level at ${this.nextLevelExp} XP.`);
        
        player.recalculateStats();
    }
  }

  public async saveProfile() {
    if (this.playerProfile) {
        this.playerProfile.currency = this.playerCurrency;
        this.playerProfile.pilotLevel = this.playerLevel;
        this.playerProfile.experience = this.playerExperience;
        await storage.savePlayerProfile(this.playerProfile);
        console.log("Player profile saved.", this.playerProfile);
    }
  }

  public resetRunStats(): void {
    this.creditsCollectedThisRun = 0;
    this.dronesDestroyedThisRun = 0;
    this.timeSurvivedThisRun = 0;
  }

  public updateHUD(player?: Player): void {
    if (!this.level) return;

    const levelNameEl = document.getElementById('level-name');
    if (levelNameEl) levelNameEl.textContent = this.level.id;
    
    const pilotLevelEl = document.getElementById('pilot-level');
    if (pilotLevelEl) pilotLevelEl.textContent = `LVL ${this.playerLevel}`;
    
    const expBar = document.getElementById('exp-bar');
    if (expBar) {
        const expPercent = (this.playerExperience / this.nextLevelExp) * 100;
        expBar.style.width = `${Math.min(100, expPercent)}%`;
    }

    const creditsValueEl = document.getElementById('credits-value');
    if (creditsValueEl) creditsValueEl.textContent = this.playerCurrency.toString();

    if (player) {
        const energyBar = document.getElementById('energy-bar');
        if (energyBar) {
            const energyPercent = (player.getEnergy() / player.getMaxEnergy()) * 100;
            energyBar.style.width = `${energyPercent}%`;
        }
        const healthBar = document.getElementById('health-bar');
        if (healthBar) {
            const healthPercent = (player.getHealth() / player.getMaxHealth()) * 100;
            healthBar.style.width = `${healthPercent}%`;
        }

        const gadgetContainer = document.getElementById('hud-gadgets');
        if (gadgetContainer) {
            const equipped: GadgetIdentifier[] = player.getEquippedGadgets();
            const cooldowns = player.getGadgetCooldowns();
            const keys = ['Q', 'E', 'R'];

            let html = '';
            for (let i = 0; i < equipped.length; i++) {
                const gadgetId = equipped[i];
                const cooldown = cooldowns[i];
                const key = keys[i];

                const isOnCooldown = cooldown > 0;
                const cooldownText = isOnCooldown ? cooldown.toFixed(1) : '';
                html += `
                    <div class="gadget-display ${isOnCooldown ? 'on-cooldown' : ''}" aria-label="Gadget ${i+1}: ${gadgetId}">
                        <span class="key">${key}</span>
                        <span class="cooldown-text">${cooldownText}</span>
                    </div>
                `;
            }
            gadgetContainer.innerHTML = html;
        }

        const buffsContainer = document.getElementById('hud-buffs');
        if (buffsContainer) {
            const activeBuffs = player.getActiveBuffs();
            let buffsHtml = '';
            for (const buff of activeBuffs) {
                let icon = '';
                switch (buff.type) {
                    case 'shield': icon = '🛡️'; break;
                    case 'weapon_boost': icon = '⚔️'; break;
                    case 'overcharge': icon = '⚡'; break;
                }
                buffsHtml += `
                    <div class="buff-display" aria-label="${buff.type} active">
                        <span class="buff-icon">${icon}</span>
                        <span class="buff-timer">${buff.timer.toFixed(1)}</span>
                    </div>
                `;
            }
            buffsContainer.innerHTML = buffsHtml;
        }
    }
  }
}

export const gameState = new GameState();