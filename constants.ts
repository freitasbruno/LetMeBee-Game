import { HexType, UnitType } from './types';

export const HEX_SIZE = 30;
export const MAP_RADIUS = 12;

export const COLORS = {
  [HexType.EMPTY]: '#334155', // Slate 700
  [HexType.HIVE_BEE]: '#d97706', // Amber 600
  [HexType.NEST_WASP]: '#4b5563', // Gray 600 (Darker for Wasps)
  [HexType.FLOWER]: '#db2777', // Pink 600
  [HexType.OBSTACLE]: '#0f172a', // Slate 900
  GRID_LINE: '#475569',
  HIGHLIGHT: 'rgba(255, 255, 255, 0.3)',
  SELECTION: 'rgba(59, 130, 246, 0.5)', // Blue selection
};

export const UNIT_CONFIG = {
  // Balance Update: 
  // - Bee Guards are now stronger and faster to defend effectively.
  // - Wasp Raiders are weaker and deal less damage to prevent early game wipes.
  
  [UnitType.BEE_WORKER]: { maxHp: 20, damage: 2, speed: 0.7, maxCarry: 10, color: '#fcd34d' }, 
  [UnitType.BEE_GUARD]: { maxHp: 50, damage: 18, speed: 0.9, maxCarry: 0, color: '#f59e0b' },
  [UnitType.BEE_QUEEN]: { maxHp: 200, damage: 0, speed: 0, maxCarry: 0, color: '#fffbeb' },
  
  [UnitType.WASP_RAIDER]: { maxHp: 30, damage: 6, speed: 0.9, maxCarry: 15, color: '#facc15' },
  // Wasp Scouts now gather pollen, so increased carry capacity
  [UnitType.WASP_SCOUT]: { maxHp: 15, damage: 4, speed: 1.2, maxCarry: 10, color: '#fef08a' },
  [UnitType.WASP_QUEEN]: { maxHp: 200, damage: 0, speed: 0, maxCarry: 0, color: '#a16207' },
};

export const BUILD_COST = 50; // Honey to build a hive
export const PLANT_COST = 30; // Honey to plant a flower
export const SPAWN_COST = {
  WORKER: 20,
  GUARD: 40,
  RAIDER: 30,
  SCOUT: 20,
};

export const POLLEN_REGEN_RATE = 0.05;
export const FLOWER_MAX_POLLEN = 50;