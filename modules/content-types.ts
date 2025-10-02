// --- Manifest ---
export interface Manifest {
  version: string;
  assets: {
    tutorial: string;
    level: string;
    gadgets: string;
    challenges: string;
    events: string;
    glider: string;
    physics: string;
    biomes: string;
    player_progress: string;
    melody: string;
    // New part assets
    chassis: string;
    wings: string;
    engines: string;
  };
}

// --- Generic ---
export type Vector2 = [number, number];

// --- Audio ---
export interface Note {
    note: string;
    time: number;
    duration: number;
}
export interface MelodyTrack {
    instrument: OscillatorType;
    gain: number;
    notes: Note[];
}
export interface Melody {
    loopDuration: number;
    [trackName: string]: any; // Allows for named tracks like 'pad', 'arp', etc.
}
export function isMelody(obj: any): obj is Melody {
    return obj && typeof obj.loopDuration === 'number';
}

// --- Game Objects ---
export interface GameObjectBase {
  id: string;
  pos: Vector2; // Note: this is TILE position, not world position.
}

export interface CreditPickup extends GameObjectBase {
  type: "credit";
  value: number;
}

export interface MineHazard extends GameObjectBase {
  type: "mine";
  damage: number;
}

export interface ExitPortal extends GameObjectBase {
  type: "exit";
  target: string; // e.g., "isle-007"
}

export type ResourceType = "shard" | "fuel" | "overcharge";
export interface ResourcePickup extends GameObjectBase {
  type: ResourceType;
}

// Union type for all interactive objects
export type GameObject = CreditPickup | MineHazard | ExitPortal | ResourcePickup;


// --- Level Data ---
export interface Patrol {
  path: Vector2[];
  speed: number;
  type: "drone";
}

export interface LevelData {
  id:string;
  seed: number;
  width: number;
  height: number;
  wind: {
    amp: number;
    scale: number;
    gusts: number[];
  };
  tiles: string[][];
  patrols: Patrol[];
  gameObjects: GameObject[];
}

export function isLevelData(obj: any): obj is LevelData {
  return obj && typeof obj.id === 'string' && Array.isArray(obj.tiles);
}

// --- Gadget ---
export interface Gadget {
  id: string;
  cooldown: number;
  energy_cost: number;
  duration?: number;
  impulse?: number;
  range?: number;
}

export function isGadgetArray(obj: any): obj is Gadget[] {
    return Array.isArray(obj) && obj.every(g => g && typeof g.id === 'string' && typeof g.cooldown === 'number');
}

// --- Story Event ---
export interface StoryEvent {
  id: string;
  title: string;
  description: string;
  choices: { text: string; outcome: string }[];
}

export function isStoryEventArray(obj: any): obj is StoryEvent[] {
    return Array.isArray(obj) && obj.every(e => e && typeof e.id === 'string' && typeof e.title === 'string');
}


// --- Challenge ---
export interface Challenge {
  id: string;
  name: string;
  objective: {
    ru: string;
    en: string;
  };
  reward: string;
  time_limit?: number; // Optional
}

export function isChallengeArray(obj: any): obj is Challenge[] {
    return Array.isArray(obj) && obj.every(c => c && typeof c.id === 'string' && typeof c.name === 'string');
}

// --- Glider & Physics ---
export type ThrusterSlot = "aft" | "left" | "right";

export interface Thruster {
  slot: ThrusterSlot;
  impulse: number;
  cooldown: number;
}

export type GadgetIdentifier = "grapple" | "shield" | "microjet" | "fuel" | "boost";

export interface Glider {
  name: string;
  wings: {
    area: number;
    stiffness: number;
  };
  thrusters: Thruster[];
  gadgets: GadgetIdentifier[];
}

export interface GliderPhysics {
  rotation_speed: number;
  boost_impulse: number;
  cooldown: number;
  stabilization: number;
  drag: number;
}

// --- Modular Glider Parts ---
export interface GliderPart {
    id: string;
    name: string;
    description: string;
    cost: number;
}

export interface GliderChassis extends GliderPart {
    baseHealth: number;
    baseEnergy: number;
    gadgetSlots: number;
    dragModifier: number; // e.g., 1.0 is standard, 0.9 is better, 1.1 is worse
}

export interface GliderWings extends GliderPart {
    rotationSpeedModifier: number;
    stabilizationModifier: number;
}

export interface GliderEngine extends GliderPart {
    thrustModifier: number;
    boostImpulseModifier: number;
    energyRegenModifier: number;
}

export function isChassisArray(obj: any): obj is GliderChassis[] {
    return Array.isArray(obj) && obj.every(p => p && typeof p.id === 'string' && typeof p.baseHealth === 'number');
}
export function isWingsArray(obj: any): obj is GliderWings[] {
    return Array.isArray(obj) && obj.every(p => p && typeof p.id === 'string' && typeof p.rotationSpeedModifier === 'number');
}
export function isEngineArray(obj: any): obj is GliderEngine[] {
    return Array.isArray(obj) && obj.every(p => p && typeof p.id === 'string' && typeof p.thrustModifier === 'number');
}


// --- Final Player and Profile Types ---
export interface PlayerProfile {
  id: string;
  currency: number;
  purchasedParts: string[]; // List of part IDs
  equippedChassis: string;
  equippedWings: string;
  equippedEngine: string;
  pilotLevel: number;
  experience: number;
}

export function isGlider(obj: any): obj is Glider {
    return obj && typeof obj.name === 'string' && obj.wings && Array.isArray(obj.thrusters);
}

export function isGliderPhysics(obj: any): obj is GliderPhysics {
    return obj && typeof obj.rotation_speed === 'number' && typeof obj.drag === 'number';
}

// --- World / Environment ---
export interface Biome {
    id: string;
    name: string;
    palette: string[];
    hazards: string[];
    description: { ru: string, en: string };
}

export function isBiomeArray(obj: any): obj is Biome[] {
    return Array.isArray(obj) && obj.every(b => b && typeof b.id === 'string');
}

// --- Player Progression ---
export interface PlayerProgress {
  pilot_level: number;
  experience: number;
  next_level_exp: number;
  currency: number;
  unlocks: {
    gadgets: string[];
    cosmetics: string[];
    buffs: string[];
  };
}

export function isPlayerProgressArray(obj: any): obj is PlayerProgress[] {
    return Array.isArray(obj) && obj.every(p => p && typeof p.pilot_level === 'number' && typeof p.currency === 'number');
}