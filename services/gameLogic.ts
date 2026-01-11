import { Faction, GameStats, HexData, HexType, Unit, UnitType, HexCoord, Difficulty } from '../types';
import { HEX_SIZE, MAP_RADIUS, UNIT_CONFIG, BUILD_COST, PLANT_COST, SPAWN_COST, FLOWER_MAX_POLLEN, POLLEN_REGEN_RATE } from '../constants';
import { getHexKey, hexToPixel, getNeighbors, getDistance, pixelToHex } from '../utils/hexUtils';
import { v4 as uuidv4 } from 'uuid';
import { AudioManager } from './audioManager';

export class GameEngine {
  hexMap: Map<string, HexData>;
  units: Map<string, Unit>;
  stats: GameStats;
  difficulty: Difficulty;
  audioManager: AudioManager;
  
  private lastUpdate: number;
  private isDemoMode: boolean = false;

  constructor() {
    this.hexMap = new Map();
    this.units = new Map();
    this.stats = {
      beeHoney: 150,
      beeHexes: 0,
      waspHoney: 150,
      waspHexes: 0,
      beePopulation: 0,
      waspPopulation: 0,
      gameOver: false,
      winner: null
    };
    this.difficulty = Difficulty.MEDIUM;
    this.audioManager = new AudioManager();
    this.lastUpdate = performance.now();
    this.initializeWorld();
  }

  public setDifficulty(d: Difficulty) {
    this.difficulty = d;
  }

  public initAudio() {
    this.audioManager.init();
  }

  private initializeWorld() {
    // Generate Hex Grid
    for (let q = -MAP_RADIUS; q <= MAP_RADIUS; q++) {
      const r1 = Math.max(-MAP_RADIUS, -q - MAP_RADIUS);
      const r2 = Math.min(MAP_RADIUS, -q + MAP_RADIUS);
      for (let r = r1; r <= r2; r++) {
        const hex: HexData = {
          q, r,
          type: HexType.EMPTY,
          pollen: 0,
          honey: 0,
          maxResource: 100
        };
        
        // Random Flowers
        if (Math.random() < 0.15 && getDistance({q:0, r:0}, {q, r}) > 3) {
          hex.type = HexType.FLOWER;
          hex.pollen = FLOWER_MAX_POLLEN;
        }

        this.hexMap.set(getHexKey({ q, r }), hex);
      }
    }

    // Spawn Bases
    this.spawnBase(Faction.BEES, -8, 4);
    this.spawnBase(Faction.WASPS, 8, -4);
  }

  private spawnBase(faction: Faction, q: number, r: number) {
    const centerKey = getHexKey({ q, r });
    const centerHex = this.hexMap.get(centerKey);
    if (!centerHex) return;

    // Set Main Hive/Nest
    centerHex.type = faction === Faction.BEES ? HexType.HIVE_BEE : HexType.NEST_WASP;
    centerHex.honey = 50;

    // Spawn Queen
    const queenType = faction === Faction.BEES ? UnitType.BEE_QUEEN : UnitType.WASP_QUEEN;
    this.spawnUnit(faction, queenType, q, r, true, true); // Ignore limits for initial spawn

    // Initial Workers
    if (faction === Faction.BEES) {
        this.spawnUnit(faction, UnitType.BEE_WORKER, q, r + 1, true, true);
        this.spawnUnit(faction, UnitType.BEE_WORKER, q + 1, r - 1, true, true);
        this.spawnUnit(faction, UnitType.BEE_WORKER, q - 1, r, true, true);
        this.spawnUnit(faction, UnitType.BEE_WORKER, q + 1, r, true, true);
    } else {
        this.spawnUnit(faction, UnitType.WASP_SCOUT, q, r + 1, true, true);
        this.spawnUnit(faction, UnitType.WASP_SCOUT, q + 1, r - 1, true, true);
    }
    
    // Set immediate neighbors to faction territory
    getNeighbors({q, r}).forEach(n => {
        const h = this.hexMap.get(getHexKey(n));
        if (h && h.type === HexType.EMPTY) {
            h.type = faction === Faction.BEES ? HexType.HIVE_BEE : HexType.NEST_WASP;
        }
    });
  }

  public spawnUnit(faction: Faction, type: UnitType, q: number, r: number, silent: boolean = false, ignoreLimit: boolean = false): Unit | null {
    // Population Limit Check
    if (!ignoreLimit && faction === Faction.BEES) {
        // Count current population
        let currentPop = 0;
        for (const u of this.units.values()) {
            if (u.faction === Faction.BEES) currentPop++;
        }

        // Count current hives (Supply)
        let hiveCount = 0;
        for (const h of this.hexMap.values()) {
            if (h.type === HexType.HIVE_BEE) hiveCount++;
        }

        // Rule: 1 Hexagon = 4 Bees
        const maxPop = hiveCount * 4;

        if (currentPop >= maxPop) {
            // Supply Blocked
            return null;
        }
    }

    const config = UNIT_CONFIG[type];
    const pos = hexToPixel({ q, r });
    const unit: Unit = {
      id: uuidv4(),
      faction,
      type,
      q, r,
      x: pos.x, y: pos.y,
      targetHex: null,
      targetUnitId: null,
      hp: config.maxHp,
      maxHp: config.maxHp,
      damage: config.damage,
      speed: config.speed,
      carryLoad: 0,
      maxCarry: config.maxCarry,
      state: 'IDLE',
      cooldown: 0
    };
    this.units.set(unit.id, unit);
    if (!silent) this.audioManager.playSFX('SPAWN');
    return unit;
  }

  public toggleDemoMode(enabled: boolean) {
    this.isDemoMode = enabled;
  }

  public update(now: number) {
    const deltaTime = (now - this.lastUpdate) / 1000; // seconds
    this.lastUpdate = now;

    if (this.stats.gameOver) return;

    // 1. Update Resources (Flowers regen)
    this.hexMap.forEach(hex => {
      if (hex.type === HexType.FLOWER && hex.pollen < FLOWER_MAX_POLLEN) {
        hex.pollen = Math.min(hex.pollen + POLLEN_REGEN_RATE, FLOWER_MAX_POLLEN);
      }
    });

    // 2. AI Decision Making
    this.units.forEach(unit => {
      const isPlayerUnit = unit.faction === Faction.BEES;
      const aiControl = this.isDemoMode || (!isPlayerUnit); 

      if (aiControl) {
        this.runAI(unit);
      }
    });

    // 3. Update Units
    const deadUnits: string[] = [];
    let beeCount = 0;
    let waspCount = 0;
    let beeQueenAlive = false;
    let waspQueenAlive = false;

    this.units.forEach(unit => {
      // Stats counting
      if (unit.faction === Faction.BEES) { beeCount++; if (unit.type === UnitType.BEE_QUEEN) beeQueenAlive = true; }
      if (unit.faction === Faction.WASPS) { waspCount++; if (unit.type === UnitType.WASP_QUEEN) waspQueenAlive = true; }

      // Cooldown
      if (unit.cooldown > 0) unit.cooldown -= deltaTime;

      // Logic
      this.updateUnitPhysics(unit, deltaTime);
      this.handleUnitInteractions(unit, deltaTime);

      if (unit.hp <= 0) {
        deadUnits.push(unit.id);
        this.audioManager.playSFX('DEATH');
      }
    });

    // Cleanup dead units
    deadUnits.forEach(id => this.units.delete(id));

    // Update Stats
    let beeHexes = 0;
    let waspHexes = 0;
    this.hexMap.forEach(h => {
      if (h.type === HexType.HIVE_BEE) beeHexes++;
      if (h.type === HexType.NEST_WASP) waspHexes++;
    });

    this.stats = {
      ...this.stats,
      beePopulation: beeCount,
      waspPopulation: waspCount,
      beeHexes,
      waspHexes,
      gameOver: !beeQueenAlive || !waspQueenAlive,
      winner: !beeQueenAlive ? Faction.WASPS : (!waspQueenAlive ? Faction.BEES : null)
    };
  }

  private updateUnitPhysics(unit: Unit, dt: number) {
    if (unit.targetUnitId) {
      const target = this.units.get(unit.targetUnitId);
      if (target) {
        unit.targetHex = { q: target.q, r: target.r };
      } else {
        unit.targetUnitId = null; // Target died/lost
        unit.state = 'IDLE';
      }
    }

    if (!unit.targetHex) return;

    const currentPos = { x: unit.x, y: unit.y };
    const targetPos = hexToPixel(unit.targetHex);
    const dist = Math.sqrt(Math.pow(targetPos.x - currentPos.x, 2) + Math.pow(targetPos.y - currentPos.y, 2));

    // Calculate move step
    const moveSpeed = unit.speed * (HEX_SIZE * 2); 
    const step = moveSpeed * dt;

    // Use step or distance, whichever is smaller (prevents overshoot)
    if (dist <= step || dist < 2) {
      unit.x = targetPos.x;
      unit.y = targetPos.y;
      unit.q = unit.targetHex.q;
      unit.r = unit.targetHex.r;
      
      // Stop moving if we have arrived
      // Only clear target if NOT following a unit (if following, we stick to them)
      if (!unit.targetUnitId) {
        unit.targetHex = null;
        
        // Reset purely moving states to IDLE, but preserve 'task' states like GATHERING/BUILDING
        if (unit.state === 'MOVING') {
            unit.state = 'IDLE';
        }
      }
    } else {
      const dx = targetPos.x - currentPos.x;
      const dy = targetPos.y - currentPos.y;
      const angle = Math.atan2(dy, dx);
      
      unit.x += Math.cos(angle) * step;
      unit.y += Math.sin(angle) * step;
      
      const gridPos = pixelToHex(unit.x, unit.y);
      unit.q = gridPos.q;
      unit.r = gridPos.r;
    }
  }

  private handleUnitInteractions(unit: Unit, dt: number) {
    if (unit.cooldown > 0) return;

    const currentHexKey = getHexKey({ q: unit.q, r: unit.r });
    const currentHex = this.hexMap.get(currentHexKey);

    // Auto-Build Trail (Adjusted to 3% each for balanced expansion)
    if (unit.faction === Faction.BEES && unit.type === UnitType.BEE_WORKER && currentHex?.type === HexType.EMPTY) {
        const roll = Math.random();
        
        // 3% chance to build Hive
        if (roll < 0.03 && this.stats.beeHoney >= BUILD_COST) {
             this.stats.beeHoney -= BUILD_COST;
             currentHex.type = HexType.HIVE_BEE;
             currentHex.maxResource = 100;
             this.audioManager.playSFX('BUILD');
        } 
        // 3% chance to plant Flower
        else if (roll >= 0.03 && roll < 0.06 && this.stats.beeHoney >= PLANT_COST) {
             this.stats.beeHoney -= PLANT_COST;
             currentHex.type = HexType.FLOWER;
             currentHex.pollen = 10;
             this.audioManager.playSFX('BUILD');
        }
    }

    // Gathering Logic
    if (unit.state === 'GATHERING') {
        if (currentHex?.type === HexType.FLOWER && currentHex.pollen > 0) {
            if (unit.carryLoad < unit.maxCarry) {
                 const amount = Math.min(1, currentHex.pollen, unit.maxCarry - unit.carryLoad);
                 currentHex.pollen -= amount;
                 unit.carryLoad += amount;
                 unit.cooldown = 0.5; 
                 this.audioManager.playSFX('GATHER');
            } else {
                 unit.state = 'RETURNING';
            }
        } else {
            if (!unit.targetHex) {
                 unit.state = 'IDLE';
            }
        }
    }

    // Building Logic
    if (unit.state === 'BUILDING') {
         if (currentHex?.type === HexType.EMPTY) {
             const buildCost = BUILD_COST;
             if (unit.faction === Faction.BEES && this.stats.beeHoney >= buildCost) {
                 this.stats.beeHoney -= buildCost;
                 currentHex.type = HexType.HIVE_BEE;
                 this.audioManager.playSFX('BUILD');
                 unit.state = 'IDLE';
             } else if (unit.faction === Faction.WASPS && this.stats.waspHoney >= buildCost) {
                 this.stats.waspHoney -= buildCost;
                 currentHex.type = HexType.NEST_WASP;
                 this.audioManager.playSFX('BUILD');
                 unit.state = 'IDLE';
             } else {
                 unit.state = 'IDLE';
             }
         } else {
             unit.state = 'IDLE';
         }
    }

    // Depositing Logic
    if (unit.state === 'RETURNING') {
        if (unit.faction === Faction.BEES && currentHex?.type === HexType.HIVE_BEE) {
            this.stats.beeHoney += unit.carryLoad;
            unit.carryLoad = 0;
            unit.state = 'IDLE';
        } 
        else if (unit.faction === Faction.WASPS && currentHex?.type === HexType.NEST_WASP) {
            this.stats.waspHoney += unit.carryLoad;
            unit.carryLoad = 0;
            unit.state = 'IDLE';
        }
    }
    
    // Wasp Pillaging
    if (unit.faction === Faction.WASPS && currentHex?.type === HexType.HIVE_BEE) {
        if (this.stats.beeHoney > 0) {
            const steal = Math.min(5, this.stats.beeHoney);
            this.stats.beeHoney -= steal;
            this.stats.waspHoney += steal;
            unit.cooldown = 1;
            this.audioManager.playSFX('PILLAGE');
        }
    }

    // Combat
    if (unit.targetUnitId) {
        const target = this.units.get(unit.targetUnitId);
        if (target && getDistance(unit, target) <= 1.5) { 
             target.hp -= unit.damage;
             unit.cooldown = 1;
             this.audioManager.playSFX('ATTACK');

             if (unit.faction === Faction.BEES && Math.random() < 0.5) {
                 unit.hp = 0; 
             }
        }
    }
  }

  private runAI(unit: Unit) {
    if (unit.targetHex) return;
    if (unit.state === 'GATHERING' || unit.state === 'BUILDING') return;
    
    if (unit.faction === Faction.BEES) {
        this.runBeeAI(unit);
    } 
    else if (unit.faction === Faction.WASPS) {
        this.runWaspAI(unit);
    }
  }

  private runBeeAI(unit: Unit) {
      if (unit.type === UnitType.BEE_WORKER) {
          if (this.stats.beeHoney > 80 && unit.carryLoad === 0 && Math.random() < 0.05) {
              const expansionHex = this.findExpansionSpot(unit, HexType.HIVE_BEE);
              if (expansionHex) {
                  this.commandMove(unit, expansionHex);
                  unit.state = 'BUILDING';
                  return;
              }
          }

          if (unit.carryLoad < unit.maxCarry) {
              const flower = this.findBestResourceHex(unit, HexType.FLOWER);
              if (flower) {
                this.commandMove(unit, flower);
                unit.state = 'GATHERING';
              }
          } else {
            const hive = this.findNearestHex(unit, HexType.HIVE_BEE);
            if (hive) {
              this.commandMove(unit, hive);
              unit.state = 'RETURNING';
            }
          }
      } 
      else if (unit.type === UnitType.BEE_GUARD) {
          const enemy = this.findNearestEnemy(unit);
          if (enemy) {
              unit.targetUnitId = enemy.id;
              unit.state = 'ATTACKING';
          }
      }
  }

  private runWaspAI(unit: Unit) {
      // 1. Spawning Decision (Toned down spawn rate)
      if (unit.type === UnitType.WASP_QUEEN) {
          let spawnThreshold = 50;
          let spawnChance = 0.008;

          if (this.difficulty === Difficulty.EASY) { spawnThreshold = 60; spawnChance = 0.003; }
          if (this.difficulty === Difficulty.MEDIUM) { spawnThreshold = 50; spawnChance = 0.008; }
          if (this.difficulty === Difficulty.HARD) { spawnThreshold = 40; spawnChance = 0.015; }

          if (this.stats.waspHoney > spawnThreshold && Math.random() < spawnChance) {
               const typeToSpawn = Math.random() < 0.6 ? UnitType.WASP_SCOUT : UnitType.WASP_RAIDER;
               const cost = typeToSpawn === UnitType.WASP_SCOUT ? SPAWN_COST.SCOUT : SPAWN_COST.RAIDER;
               
               if (this.stats.waspHoney >= cost) {
                   this.stats.waspHoney -= cost;
                   this.spawnUnit(Faction.WASPS, typeToSpawn, unit.q, unit.r);
               }
          }
          return;
      }

      // 2. Expansion Check
      if ((unit.type === UnitType.WASP_SCOUT || unit.type === UnitType.WASP_RAIDER) 
          && this.stats.waspHoney > 100 && unit.carryLoad === 0 && Math.random() < 0.03) {
          const expansionHex = this.findExpansionSpot(unit, HexType.NEST_WASP);
          if (expansionHex) {
              this.commandMove(unit, expansionHex);
              unit.state = 'BUILDING';
              return;
          }
      }

      // 3. Unit Behavior
      if (unit.type === UnitType.WASP_SCOUT) {
          if (unit.carryLoad < unit.maxCarry) {
              const flower = this.findBestResourceHex(unit, HexType.FLOWER);
              if (flower) {
                  this.commandMove(unit, flower);
                  unit.state = 'GATHERING';
              } else {
                  const r = this.getRandomNeighbor(unit);
                  if (r) this.commandMove(unit, r);
              }
          } else {
              const nest = this.findNearestHex(unit, HexType.NEST_WASP);
              if (nest) {
                  this.commandMove(unit, nest);
                  unit.state = 'RETURNING';
              }
          }
          return;
      }

      if (unit.type === UnitType.WASP_RAIDER) {
          const enemy = this.findNearestEnemy(unit);
          
          if (enemy) {
               if (enemy.type === UnitType.BEE_WORKER) {
                   unit.targetUnitId = enemy.id;
                   unit.state = 'ATTACKING';
               } 
               else if (getDistance(unit, enemy) < 4) {
                   unit.targetUnitId = enemy.id;
                   unit.state = 'ATTACKING';
               }
          } else {
               const flower = this.findNearestHex(unit, HexType.FLOWER);
               if (flower && Math.random() > 0.5) {
                   this.commandMove(unit, flower);
               }
          }
      }
  }

  // Helpers
  private getRandomNeighbor(unit: Unit): HexCoord | null {
      const neighbors = getNeighbors(unit);
      return neighbors[Math.floor(Math.random() * neighbors.length)] || null;
  }

  private findExpansionSpot(unit: Unit, territoryType: HexType): HexCoord | null {
      let bestHex: HexCoord | null = null;
      let minDist = Infinity;

      for (const hex of this.hexMap.values()) {
          if (hex.type === HexType.EMPTY) {
              const neighbors = getNeighbors(hex);
              const hasTerritoryNeighbor = neighbors.some(n => {
                  const nh = this.hexMap.get(getHexKey(n));
                  return nh && nh.type === territoryType;
              });

              if (hasTerritoryNeighbor) {
                  const dist = getDistance(unit, hex);
                  if (dist < minDist && Math.random() > 0.3) {
                      minDist = dist;
                      bestHex = hex;
                  }
              }
          }
      }
      return bestHex;
  }

  private findBestResourceHex(unit: Unit, type: HexType): HexCoord | null {
    let bestHex: HexCoord | null = null;
    let maxScore = -Infinity;

    const targetCounts = new Map<string, number>();
    for (const u of this.units.values()) {
        if (u.targetHex) {
            const k = getHexKey(u.targetHex);
            targetCounts.set(k, (targetCounts.get(k) || 0) + 1);
        }
    }

    for (const hex of this.hexMap.values()) {
        if (hex.type === type && hex.pollen > 0) {
            const dist = getDistance(unit, hex);
            const key = getHexKey(hex);
            const unitsTargeting = targetCounts.get(key) || 0;
            const score = (hex.pollen * 2) - (dist * 3) - (unitsTargeting * 50);

            if (score > maxScore) {
                maxScore = score;
                bestHex = hex;
            }
        }
    }
    return bestHex;
  }

  private findNearestHex(unit: Unit, type: HexType, predicate?: (h: HexData) => boolean): HexCoord | null {
    let nearest: HexCoord | null = null;
    let minDist = Infinity;
    for (const hex of this.hexMap.values()) {
        if (hex.type === type && (!predicate || predicate(hex))) {
            const d = getDistance(unit, hex);
            if (d < minDist) {
                minDist = d;
                nearest = hex;
            }
        }
    }
    return nearest;
  }

  private findNearestEnemy(unit: Unit): Unit | null {
      let nearest: Unit | null = null;
      let minDist = Infinity;
      for (const other of this.units.values()) {
          if (other.faction !== unit.faction && other.faction !== Faction.NEUTRAL) {
              if (other.type === UnitType.BEE_QUEEN || other.type === UnitType.WASP_QUEEN) continue;

              const d = getDistance(unit, other);
              if (d < minDist) {
                  minDist = d;
                  nearest = other;
              }
          }
      }
      return nearest;
  }

  public commandMove(unit: Unit, target: HexCoord) {
    unit.targetHex = target;
    unit.targetUnitId = null;
    unit.state = 'MOVING';
  }

  public commandAttack(unit: Unit, targetUnitId: string) {
      unit.targetUnitId = targetUnitId;
      unit.state = 'ATTACKING';
  }

  public buildStructure(unitId: string, hex: HexCoord) {
      const unit = this.units.get(unitId);
      const hData = this.hexMap.get(getHexKey(hex));
      
      if (!unit || !hData || hData.type !== HexType.EMPTY) return;

      if (unit.faction === Faction.BEES && this.stats.beeHoney >= BUILD_COST) {
            this.stats.beeHoney -= BUILD_COST;
            hData.type = HexType.HIVE_BEE;
            hData.maxResource = 100;
            this.audioManager.playSFX('BUILD');
      }
  }

  public plantFlower(unitId: string, hex: HexCoord) {
      const unit = this.units.get(unitId);
      const hData = this.hexMap.get(getHexKey(hex));
      
      if (!unit || !hData || hData.type !== HexType.EMPTY) return;

      if (unit.faction === Faction.BEES && this.stats.beeHoney >= PLANT_COST) {
          this.stats.beeHoney -= PLANT_COST;
          hData.type = HexType.FLOWER;
          hData.pollen = 10;
          this.audioManager.playSFX('BUILD');
      }
  }
}