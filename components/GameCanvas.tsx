import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../services/gameLogic';
import { COLORS, HEX_SIZE, MAP_RADIUS } from '../constants';
import { hexToPixel, pixelToHex, getHexKey } from '../utils/hexUtils';
import { HexType, UnitType, Faction, Unit, HexCoord } from '../types';

interface GameCanvasProps {
  engine: GameEngine;
  onHexClick: (hex: HexCoord) => void;
  selectedUnitId: string | null;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ engine, onHexClick, selectedUnitId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  
  // Camera State
  const [offset, setOffset] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [isDragging, setIsDragging] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const drawHex = (ctx: CanvasRenderingContext2D, q: number, r: number, color: string, stroke: string = COLORS.GRID_LINE) => {
    const { x, y } = hexToPixel({ q, r });
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      // Flat Top Hexagon
      const angle = (2 * Math.PI / 6) * i; 
      const px = x + HEX_SIZE * Math.cos(angle);
      const py = y + HEX_SIZE * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const drawUnit = (ctx: CanvasRenderingContext2D, unit: Unit, isSelected: boolean) => {
    const { x, y } = unit; 
    const size = HEX_SIZE * 0.6;
    
    // Determine orientation based on target
    let angle = -Math.PI / 2; // Default facing up
    if (unit.targetHex) {
        const tPos = hexToPixel(unit.targetHex);
        angle = Math.atan2(tPos.y - y, tPos.x - x);
    }
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    if (unit.faction === Faction.BEES) {
        // Draw Bee
        // Wings
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.ellipse(0, -size*0.3, size*0.8, size*0.4, -0.5, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, size*0.3, size*0.8, size*0.4, 0.5, 0, Math.PI*2);
        ctx.fill();

        // Body
        ctx.fillStyle = '#fbbf24'; // Amber 400
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size*0.6, 0, 0, Math.PI*2);
        ctx.fill();
        
        // Stripes
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-size*0.3, -size*0.5);
        ctx.lineTo(-size*0.3, size*0.5);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(size*0.3, -size*0.5);
        ctx.lineTo(size*0.3, size*0.5);
        ctx.stroke();
        
        // Eyes
        if (unit.type === UnitType.BEE_QUEEN) ctx.fillStyle = '#ef4444'; // Red eyes for Queen
        else ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(size*0.6, -size*0.2, 2, 0, Math.PI*2);
        ctx.arc(size*0.6, size*0.2, 2, 0, Math.PI*2);
        ctx.fill();

    } else if (unit.faction === Faction.WASPS) {
        // Draw Wasp
        // Wings (Sharper)
        ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
        ctx.beginPath();
        ctx.moveTo(-size*0.5, 0);
        ctx.lineTo(-size*0.8, -size*1.2);
        ctx.lineTo(size*0.2, -size*0.2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-size*0.5, 0);
        ctx.lineTo(-size*0.8, size*1.2);
        ctx.lineTo(size*0.2, size*0.2);
        ctx.fill();
        
        // Body (Sharp Abdomen)
        ctx.fillStyle = '#eab308'; // Yellow 500
        ctx.beginPath();
        ctx.moveTo(size, 0); // Head
        ctx.lineTo(-size*0.5, size*0.5);
        ctx.lineTo(-size*1.2, 0); // Stinger
        ctx.lineTo(-size*0.5, -size*0.5);
        ctx.closePath();
        ctx.fill();

        // Stripes
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-size*0.2, -size*0.4);
        ctx.lineTo(-size*0.2, size*0.4);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(-size*0.7, -size*0.2);
        ctx.lineTo(-size*0.7, size*0.2);
        ctx.stroke();
        
        // Head
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(size*0.8, 0, size*0.3, 0, Math.PI*2);
        ctx.fill();
    }

    ctx.restore();
    
    // Selection Ring (Non-rotated, consistent)
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#60a5fa'; // Blue 400
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Health Bar (Floating above)
    const hpPct = unit.hp / unit.maxHp;
    ctx.fillStyle = 'red';
    ctx.fillRect(x - 12, y - size - 12, 24, 4);
    ctx.fillStyle = '#22c55e'; // Green 500
    ctx.fillRect(x - 12, y - size - 12, 24 * hpPct, 4);
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#111827'; // Dark background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply Camera
    ctx.save();
    ctx.translate(offset.x, offset.y);

    // 1. Draw Hexes
    engine.hexMap.forEach((hex) => {
      let color = COLORS[hex.type];
      drawHex(ctx, hex.q, hex.r, color);
      
      // Resource Indicator
      if (hex.type === HexType.FLOWER && hex.pollen > 10) {
          const {x, y} = hexToPixel({q: hex.q, r: hex.r});
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.beginPath();
          ctx.arc(x, y, HEX_SIZE * 0.3, 0, Math.PI*2);
          ctx.fill();
      }
    });

    // 2. Draw Units
    engine.units.forEach(unit => {
      drawUnit(ctx, unit, unit.id === selectedUnitId);
    });

    ctx.restore();
  };

  // Animation Loop
  useEffect(() => {
    const loop = (time: number) => {
      engine.update(time);
      render();
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [engine, offset, selectedUnitId]);

  // Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    // Click detection logic
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    
    // Treat as click if little movement
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
       const rect = canvasRef.current?.getBoundingClientRect();
       if (rect) {
           const mouseX = e.clientX - rect.left - offset.x;
           const mouseY = e.clientY - rect.top - offset.y;
           const hex = pixelToHex(mouseX, mouseY);
           onHexClick(hex);
       }
    }
  };

  // Resize handling
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="block cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsDragging(false)}
    />
  );
};