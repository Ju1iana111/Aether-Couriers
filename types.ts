// --- Generic ---
export type Vector2 = [number, number];

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

export type ResourceType = "shard" | "fuel" | "shield";
export interface ResourcePickup extends GameObjectBase {
  type: ResourceType;
}

// Union type for all interactive objects
export type GameObject = CreditPickup | MineHazard | ExitPortal | ResourcePickup;


// --- Level ---
export interface Patrol {
  path: Vector2[];
  speed: number;
  type: "drone";
}

export interface Level {
  id: string;
  seed: number;
  wind: {
    amp: number;
    scale: number;
    gusts: number[];
  };
  tiles: string[][];
  patrols: Patrol[];
  gameObjects: GameObject[];
}

// --- Glider ---
export type ThrusterSlot = "aft" | "left" | "right";

export interface Thruster {
  slot: ThrusterSlot;
  impulse: number;
  cooldown: number;
}

export type GadgetIdentifier = "grapple" | "shield" | "microjet" | "fuel" | "boost";

export interface GadgetDefinition {
  id: GadgetIdentifier;
  cooldown: number;
  energy_cost: number;
  duration?: number;
  impulse?: number;
  range?: number;
}

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

// --- World / Environment ---
export interface Biome {
    name: string;
    palette: string[];
}

// --- Player Progression ---
export interface PlayerProgress {
  pilot_level: number;
  experience: number;
  next_level_exp: number;
  currency: number;
  unlocks: {
    gadgets: GadgetIdentifier[];
    cosmetics: string[];
    buffs: string[];
  };
}

// --- Meta Progression ---
export interface PlayerProfile {
  id: string; // for IndexedDB keyPath
  currency: number;
  purchasedUpgrades: string[]; // array of upgrade IDs
  pilotLevel: number;
  experience: number;
}


// --- Challenges ---
export interface Challenge {
  id: string;
  name: string;
  objective: {
    ru: string;
    en: string;
  };
  reward: string;
  time_limit: number;
}

// --- Upgrades ---
export interface Upgrade {
  id: string;
  name: string;
  description: {
    ru: string;
    en: string;
  };
  effect: {
    parameter: keyof GliderPhysics;
    multiplier: number;
  };
  cost: number;
}

// --- Single Player Biomes ---
export interface SinglePlayerBiome {
  id: string;
  name: string;
  difficulty: number;
  hazards: string[];
  reward: {
    currency: number;
    exp: number;
  };
  description: {
    ru: string;
    en: string;
  };
}