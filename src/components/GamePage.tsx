'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { GameScene } from '@/game/GameScene';
import { hudBridge } from '@/game/hudBridge';
import HUD from './HUD';
import StartScreen from './StartScreen';
import WinScreen from './WinScreen';
import DeathScreen from './DeathScreen';

const GameCanvas = dynamic(() => import('./GameCanvas'), { ssr: false });

type GameState = 'START' | 'PLAYING' | 'WAVE_CLEAR' | 'DEATH';

interface RunStats { hp: number; shields: number; kills: number; }

export default function GamePage() {
  const [gameState, setGameState]   = useState<GameState>('START');
  const [finalStats, setFinalStats] = useState<RunStats>({ hp: 100, shields: 50, kills: 0 });

  const sceneRef    = useRef<GameScene | null>(null);
  // Refs track per-frame values without triggering re-renders
  const hpRef       = useRef(100);
  const shieldsRef  = useRef(50);

  useEffect(() => {
    const offHp  = hudBridge.on('hp-update',     ({ value }) => { hpRef.current = value; });
    const offSh  = hudBridge.on('shield-update', ({ value }) => { shieldsRef.current = value; });
    const offWin = hudBridge.on('wave-clear',   ({ kills }) => {
      setFinalStats({ hp: hpRef.current, shields: shieldsRef.current, kills });
      setGameState('WAVE_CLEAR');
    });
    const offDead = hudBridge.on('player-dead', ({ kills }) => {
      setFinalStats({ hp: 0, shields: 0, kills });
      setGameState('DEATH');
    });
    return () => { offHp(); offSh(); offWin(); offDead(); };
  }, []);

  const handleReady = useCallback((scene: GameScene) => {
    sceneRef.current = scene;
  }, []);

  const handleStart = useCallback(() => {
    hpRef.current      = 100;
    shieldsRef.current = 50;
    sceneRef.current?.startGame();
    setGameState('PLAYING');
  }, []);

  const handleReset = useCallback(() => {
    sceneRef.current?.reset();
    setGameState('START');
  }, []);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <GameCanvas onReady={handleReady} />
      {gameState === 'PLAYING'    && <HUD />}
      {gameState === 'START'      && <StartScreen onStart={handleStart} />}
      {gameState === 'WAVE_CLEAR' && <WinScreen   hull={finalStats.hp} shields={finalStats.shields} kills={finalStats.kills} onContinue={handleReset} />}
      {gameState === 'DEATH'      && <DeathScreen kills={finalStats.kills} onRetry={handleReset} />}
    </div>
  );
}
