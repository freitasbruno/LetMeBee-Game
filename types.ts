export enum Faction {
  BEES = 'BEES',
  WASPS = 'WASPS',
  NEUTRAL = 'NEUTRAL'
}

export enum HexType {
  EMPTY = 'EMPTY',
  HIVE_BEE = 'HIVE_BEE',
  NEST_WASP = 'NEST_WASP',
  FLOWER = 'FLOWER',
  OBSTACLE = 'OBSTACLE'
}

export enum UnitType {
  BEE_WORKER = 'BEE_WORKER',
  BEE_GUARD = 'BEE_GUARD',
  BEE_QUEEN = 'BEE_QUEEN',
  WASP_RAIDER = 'WASP_RAIDER',
  WASP_SCOUT = 'WASP_SCOUT',
  WASP_QUEEN = 'WASP_QUEEN'
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export interface Point {
  x: number;
  y: number;
}

export interface HexCoord {
  q: number;
  r: number;
}

export interface HexData {
  q: number;
  r: number;
  type: HexType;
  pollen: number; // For flowers
  honey: number; // For hives (stored)
  maxResource: number;
}

export interface Unit {
  id: string;
  faction: Faction;
  type: UnitType;
  q: number; // Logical Grid Position
  r: number;
  x: number; // Visual Pixel Position
  y: number;
  targetHex: HexCoord | null; // Moving towards
  targetUnitId: string | null; // Attacking/following
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  carryLoad: number; // Current Pollen/Honey
  maxCarry: number;
  state: 'IDLE' | 'MOVING' | 'GATHERING' | 'ATTACKING' | 'RETURNING' | 'BUILDING';
  cooldown: number; // Attack/Action cooldown
}

export interface GameStats {
  beeHoney: number;
  beeHexes: number;
  waspHoney: number; // Or biomass
  waspHexes: number;
  beePopulation: number;
  waspPopulation: number;
  gameOver: boolean;
  winner: Faction | null;
}