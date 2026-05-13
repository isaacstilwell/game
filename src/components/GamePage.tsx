'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { GameScene } from '@/game/GameScene';
import { hudBridge } from '@/game/hudBridge';
import HUD from './HUD';
import StartScreen from './StartScreen';
import WinScreen from './WinScreen';
import DeathScreen from './DeathScreen';
import Wave2LoadingOverlay from './Wave2LoadingOverlay';

const GameCanvas = dynamic(() => import('./GameCanvas'), { ssr: false });

type GameState = 'START' | 'PLAYING' | 'WAVE1_CLEAR' | 'WAVE2_LOADING' | 'WAVE2_DONE' | 'DEATH';

interface RunStats { hp: number; shields: number; kills: number; }

export default function GamePage() {
  const [gameState, setGameState]   = useState<GameState>('START');
  const [finalStats, setFinalStats] = useState<RunStats>({ hp: 100, shields: 50, kills: 0 });

  const sceneRef    = useRef<GameScene | null>(null);
  const hpRef       = useRef(100);
  const shieldsRef  = useRef(50);

  useEffect(() => {
    const offHp   = hudBridge.on('hp-update',       ({ value }) => { hpRef.current = value; });
    const offSh   = hudBridge.on('shield-update',   ({ value }) => { shieldsRef.current = value; });
    const offWin  = hudBridge.on('wave-clear',       ({ kills }) => {
      setFinalStats({ hp: hpRef.current, shields: shieldsRef.current, kills });
      setGameState('WAVE1_CLEAR');
    });
    const offAst  = hudBridge.on('asteroid-clear',  ({ kills }) => {
      setFinalStats({ hp: hpRef.current, shields: shieldsRef.current, kills });
      setGameState('WAVE2_DONE');
    });
    const offW2Ready = hudBridge.on('wave2-ready', () => {
      sceneRef.current?.startWave2();
      setGameState('PLAYING');
    });
    const offDead = hudBridge.on('player-dead',     ({ kills }) => {
      setFinalStats({ hp: 0, shields: 0, kills });
      setGameState('DEATH');
    });
    return () => { offHp(); offSh(); offWin(); offAst(); offDead(); offW2Ready(); };
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

  const handleContinueToWave2 = useCallback(() => {
    sceneRef.current?.prepareWave2();
    setGameState('WAVE2_LOADING');
  }, []);

  const handleReset = useCallback(() => {
    sceneRef.current?.reset();
    setGameState('START');
  }, []);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <GameCanvas onReady={handleReady} />
      {(gameState === 'PLAYING')      && <HUD />}
      {gameState === 'WAVE2_LOADING'  && <Wave2LoadingOverlay />}
      {gameState === 'START'        && <StartScreen onStart={handleStart} />}
      {gameState === 'WAVE1_CLEAR'  && (
        <WinScreen
          hull={finalStats.hp}
          shields={finalStats.shields}
          kills={finalStats.kills}
          onContinue={handleContinueToWave2}
        />
      )}
      {gameState === 'WAVE2_DONE'   && (
        <WinScreen
          hull={finalStats.hp}
          shields={finalStats.shields}
          kills={finalStats.kills}
          onContinue={handleReset}
          wave={2}
        />
      )}
      {gameState === 'DEATH'        && <DeathScreen kills={finalStats.kills} onRetry={handleReset} />}
    </div>
  );
}
