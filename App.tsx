import React, { useEffect, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameEngine } from './services/gameLogic';
import { Faction, GameStats, HexCoord, HexType, UnitType, Difficulty } from './types';
import { BUILD_COST, SPAWN_COST, PLANT_COST } from './constants';
import { Hexagon, Bug, Skull, Play, Pause, Swords, Volume2, VolumeX, Settings, Flower } from 'lucide-react';
import { getHexKey, getDistance, getNeighbors } from './utils/hexUtils';

const App: React.FC = () => {
  const engineRef = useRef(new GameEngine());
  const [stats, setStats] = useState<GameStats>(engineRef.current.stats);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedHex, setSelectedHex] = useState<HexCoord | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [isMuted, setIsMuted] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [tick, setTick] = useState(0); 

  // Sync Stats Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setStats({ ...engineRef.current.stats });
      setTick(t => t + 1); 
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const initAudioIfNeeded = () => {
    if (!audioStarted) {
      engineRef.current.initAudio();
      setAudioStarted(true);
    }
  };

  const handleHexClick = (hex: HexCoord) => {
    initAudioIfNeeded();
    const key = getHexKey(hex);
    const engine = engineRef.current;
    
    let clickedUnitId: string | null = null;
    for (const unit of engine.units.values()) {
        if (unit.q === hex.q && unit.r === hex.r) {
            clickedUnitId = unit.id;
            break;
        }
    }

    if (selectedUnitId) {
        const unit = engine.units.get(selectedUnitId);
        if (unit && unit.faction === Faction.BEES) {
             if (clickedUnitId && clickedUnitId !== selectedUnitId) {
                 engine.commandAttack(unit, clickedUnitId);
                 setSelectedUnitId(null);
                 return;
             } else {
                 engine.commandMove(unit, hex);
                 setSelectedUnitId(null);
                 return;
             }
        }
    }

    if (clickedUnitId) {
        setSelectedUnitId(clickedUnitId);
        setSelectedHex(hex);
    } else {
        setSelectedUnitId(null);
        setSelectedHex(hex);
    }
  };

  const toggleDemo = () => {
    initAudioIfNeeded();
    const newVal = !isDemo;
    setIsDemo(newVal);
    engineRef.current.toggleDemoMode(newVal);
    setSelectedUnitId(null);
  };

  const toggleMute = () => {
    initAudioIfNeeded();
    const newVal = !isMuted;
    setIsMuted(newVal);
    engineRef.current.audioManager.toggleMute(newVal);
  };

  const changeDifficulty = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const d = e.target.value as Difficulty;
      setDifficulty(d);
      engineRef.current.setDifficulty(d);
  };

  const spawnUnit = (type: UnitType) => {
      initAudioIfNeeded();
      if (!selectedHex) return;
      const hexData = engineRef.current.hexMap.get(getHexKey(selectedHex));
      if (!hexData || hexData.type !== HexType.HIVE_BEE) return;

      const cost = type === UnitType.BEE_WORKER ? SPAWN_COST.WORKER : SPAWN_COST.GUARD;
      if (engineRef.current.stats.beeHoney >= cost) {
          engineRef.current.stats.beeHoney -= cost;
          // Spawn in neighbor empty
          const neighbors = getNeighbors(selectedHex);
          const empty = neighbors.find(n => {
             const h = engineRef.current.hexMap.get(getHexKey(n));
             return h && h.type !== HexType.OBSTACLE;
          });
          
          if (empty) {
            engineRef.current.spawnUnit(Faction.BEES, type, empty.q, empty.r);
          }
      }
  };

  const buildHive = () => {
      initAudioIfNeeded();
      if (!selectedHex || !selectedUnitId) return;
      engineRef.current.buildStructure(selectedUnitId, selectedHex);
  };

  const plantFlower = () => {
      initAudioIfNeeded();
      if (!selectedHex || !selectedUnitId) return;
      engineRef.current.plantFlower(selectedUnitId, selectedHex);
  };
  
  const getSelectionDetails = () => {
      if (selectedUnitId) {
          const u = engineRef.current.units.get(selectedUnitId);
          if (u) return u;
      }
      return null;
  };
  
  const selectedUnit = getSelectionDetails();
  const hexData = selectedHex ? engineRef.current.hexMap.get(getHexKey(selectedHex)) : null;
  const maxBeePop = stats.beeHexes * 4;
  const isPopCapped = stats.beePopulation >= maxBeePop;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 font-sans text-white">
      {/* Game Layer */}
      <div className="absolute inset-0 z-0">
        <GameCanvas 
            engine={engineRef.current} 
            onHexClick={handleHexClick} 
            selectedUnitId={selectedUnitId}
        />
      </div>

      {/* HUD: Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none">
        
        {/* Bees Stats */}
        <div className="bg-slate-800/90 backdrop-blur border border-amber-500/50 p-4 rounded-xl shadow-lg pointer-events-auto min-w-[200px]">
          <h2 className="text-amber-400 font-bold text-lg mb-2 flex items-center gap-2">
            <Hexagon size={20} className="fill-amber-400/20" /> Honey Bees
          </h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Honey:</span>
              <span className="text-amber-300 font-mono">{Math.floor(stats.beeHoney)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Hexes:</span>
              <span className="text-amber-300 font-mono">{stats.beeHexes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Population:</span>
              <span className={`font-mono ${isPopCapped ? 'text-red-400' : 'text-amber-300'}`}>
                  {stats.beePopulation} / {maxBeePop}
              </span>
            </div>
          </div>
        </div>

        {/* Center Controls */}
        <div className="flex flex-col items-center gap-2 pointer-events-auto">
            <div className="bg-slate-900/80 backdrop-blur px-6 py-2 rounded-full border border-slate-700 text-slate-300 font-bold shadow-2xl">
                {stats.gameOver ? (
                    <span className={stats.winner === Faction.BEES ? 'text-green-400' : 'text-red-400'}>
                        GAME OVER - {stats.winner} WIN
                    </span>
                ) : (
                    <span>HEX WAR</span>
                )}
            </div>
            
            <div className="flex gap-2">
                <button 
                    onClick={toggleDemo}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all shadow-lg text-sm ${
                        isDemo 
                        ? 'bg-red-500/20 text-red-400 border border-red-500 hover:bg-red-500/30' 
                        : 'bg-green-500/20 text-green-400 border border-green-500 hover:bg-green-500/30'
                    }`}
                >
                    {isDemo ? <Pause size={14} /> : <Play size={14} />}
                    {isDemo ? 'DEMO' : 'DEMO'}
                </button>

                <div className="flex items-center gap-1 bg-slate-800 rounded-full px-2 border border-slate-600">
                     <Settings size={14} className="text-slate-400" />
                     <select 
                        value={difficulty} 
                        onChange={changeDifficulty}
                        className="bg-transparent text-xs text-white p-1 outline-none cursor-pointer"
                     >
                         <option value={Difficulty.EASY}>EASY</option>
                         <option value={Difficulty.MEDIUM}>MEDIUM</option>
                         <option value={Difficulty.HARD}>HARD</option>
                     </select>
                </div>

                <button 
                    onClick={toggleMute}
                    className="p-2 rounded-full bg-slate-800 border border-slate-600 hover:bg-slate-700 transition-colors"
                >
                    {isMuted ? <VolumeX size={16} className="text-red-400"/> : <Volume2 size={16} className="text-green-400"/>}
                </button>
            </div>
        </div>

        {/* Wasp Stats */}
        <div className="bg-slate-800/90 backdrop-blur border border-yellow-800/50 p-4 rounded-xl shadow-lg pointer-events-auto min-w-[200px]">
          <h2 className="text-yellow-500 font-bold text-lg mb-2 flex items-center gap-2">
             <Skull size={20} className="fill-yellow-500/20" /> Wasps
          </h2>
          <div className="space-y-1 text-sm">
             <div className="flex justify-between">
              <span className="text-slate-400">Honey:</span>
              <span className="text-yellow-300 font-mono">{Math.floor(stats.waspHoney)}</span>
            </div>
             <div className="flex justify-between">
              <span className="text-slate-400">Hexes:</span>
              <span className="text-yellow-300 font-mono">{stats.waspHexes}</span>
            </div>
             <div className="flex justify-between">
              <span className="text-slate-400">Population:</span>
              <span className="text-yellow-300 font-mono">{stats.waspPopulation}</span>
            </div>
          </div>
        </div>
      </div>

      {/* HUD: Bottom Selection Panel */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
        {selectedUnit ? (
            <div className="bg-slate-800/95 backdrop-blur border border-slate-600 rounded-xl p-4 shadow-2xl w-[400px] flex gap-4 animate-in slide-in-from-bottom-4">
                <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center shrink-0 border border-slate-600">
                    <Bug size={32} color={selectedUnit.faction === Faction.BEES ? '#f59e0b' : '#facc15'} />
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-bold text-white">{selectedUnit.type.replace('_', ' ')}</h3>
                            <p className="text-xs text-slate-400">HP: {Math.ceil(selectedUnit.hp)} / {selectedUnit.maxHp}</p>
                        </div>
                        <div className="text-xs font-mono text-slate-500 text-right">
                           {selectedUnit.state}
                        </div>
                    </div>
                    
                    {/* Actions */}
                    {selectedUnit.faction === Faction.BEES && !isDemo && (
                        <div className="flex gap-2 mt-2">
                            {selectedUnit.type === UnitType.BEE_WORKER && hexData && hexData.type === HexType.EMPTY && (
                                <>
                                    <button 
                                        onClick={buildHive}
                                        disabled={stats.beeHoney < BUILD_COST}
                                        className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold transition-colors flex items-center justify-center gap-1"
                                    >
                                        <Hexagon size={14} /> BUILD ({BUILD_COST})
                                    </button>
                                    <button 
                                        onClick={plantFlower}
                                        disabled={stats.beeHoney < PLANT_COST}
                                        className="flex-1 px-3 py-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold transition-colors flex items-center justify-center gap-1"
                                    >
                                        <Flower size={14} /> FLOWER ({PLANT_COST})
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        ) : hexData && hexData.type === HexType.HIVE_BEE ? (
            <div className="bg-slate-800/95 backdrop-blur border border-amber-600 rounded-xl p-4 shadow-2xl w-[400px] flex gap-4 animate-in slide-in-from-bottom-4">
                <div className="w-16 h-16 bg-amber-900/40 rounded-lg flex items-center justify-center shrink-0 border border-amber-600/50">
                    <Hexagon size={32} className="text-amber-500" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-amber-500 mb-2">Bee Hive</h3>
                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                         <span>Population Cap: {maxBeePop}</span>
                         {isPopCapped && <span className="text-red-400">MAX REACHED</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                         <button 
                            onClick={() => spawnUnit(UnitType.BEE_WORKER)}
                            disabled={stats.beeHoney < SPAWN_COST.WORKER || isPopCapped}
                            className="flex flex-col items-center justify-center p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs transition-colors"
                        >
                            <span className="font-bold text-amber-300">WORKER</span>
                            <span className="text-slate-400">{SPAWN_COST.WORKER} Honey</span>
                        </button>
                        <button 
                             onClick={() => spawnUnit(UnitType.BEE_GUARD)}
                             disabled={stats.beeHoney < SPAWN_COST.GUARD || isPopCapped}
                             className="flex flex-col items-center justify-center p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs transition-colors"
                        >
                            <span className="font-bold text-amber-500">GUARD</span>
                            <span className="text-slate-400">{SPAWN_COST.GUARD} Honey</span>
                        </button>
                    </div>
                </div>
            </div>
        ) : (
            <div className="bg-slate-800/50 backdrop-blur text-slate-400 px-6 py-2 rounded-full text-sm">
                Click a unit to select. Click empty space to move.
            </div>
        )}
      </div>
      <div className="absolute top-20 right-4 w-64 text-right pointer-events-none opacity-50 hover:opacity-100 transition-opacity">
          <p className="text-xs text-slate-400 mb-1">Controls</p>
          <ul className="text-xs text-slate-500 space-y-1">
              <li>Left Click: Select Unit / Hex</li>
              <li>Click Unit -> Click Empty: Move</li>
              <li>Click Unit -> Click Enemy: Attack</li>
              <li>Select Worker -> Build Hive button</li>
              <li>Select Hive -> Spawn Unit buttons</li>
              <li>Drag to Pan Camera</li>
          </ul>
      </div>
    </div>
  );
};

export default App;