import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import type { EffectType, EffectSlotState } from '../types/effects';
import type { PresetEffectSlot } from '../types/presets';
import { loadLastState, saveLastState } from '../audio/presets';

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine>(new AudioEngine());
  const [isRunning, setIsRunning] = useState(false);
  const [chain, setChain] = useState<EffectSlotState[]>([]);
  const [masterVolume, setMasterVolumeState] = useState(1);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const syncChain = useCallback(() => {
    const state = engineRef.current.getChainState();
    setChain(state);
    // Debounced auto-save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveLastState(
        state.map((s) => ({ type: s.type, bypassed: s.bypassed, params: s.params }))
      );
    }, 500);
  }, []);

  const start = useCallback(async (deviceId?: string) => {
    await engineRef.current.start(deviceId);
    setIsRunning(true);

    // Restore last state
    const lastState = loadLastState();
    if (lastState && lastState.length > 0) {
      for (const slot of lastState) {
        const effect = engineRef.current.addEffect(slot.type, slot.params);
        if (slot.bypassed) effect.setBypassed(true);
      }
      syncChain();
    }
  }, [syncChain]);

  const stop = useCallback(() => {
    engineRef.current.stop();
    setIsRunning(false);
    setChain([]);
  }, []);

  const addEffect = useCallback((type: EffectType) => {
    engineRef.current.addEffect(type);
    syncChain();
  }, [syncChain]);

  const removeEffect = useCallback((id: string) => {
    engineRef.current.removeEffect(id);
    syncChain();
  }, [syncChain]);

  const reorderEffects = useCallback((fromIndex: number, toIndex: number) => {
    engineRef.current.reorderEffects(fromIndex, toIndex);
    syncChain();
  }, [syncChain]);

  const setEffectParam = useCallback((id: string, param: string, value: number) => {
    const effect = engineRef.current.getEffectById(id);
    if (effect) {
      effect.setParam(param, value);
      syncChain();
    }
  }, [syncChain]);

  const toggleBypass = useCallback((id: string) => {
    const effect = engineRef.current.getEffectById(id);
    if (effect) {
      effect.setBypassed(!effect.isBypassed());
      syncChain();
    }
  }, [syncChain]);

  const setMasterVolume = useCallback((value: number) => {
    engineRef.current.setMasterVolume(value);
    setMasterVolumeState(value);
  }, []);

  const loadPresetChain = useCallback((slots: PresetEffectSlot[]) => {
    engineRef.current.clearChain();
    for (const slot of slots) {
      const effect = engineRef.current.addEffect(slot.type, slot.params);
      if (slot.bypassed) effect.setBypassed(true);
    }
    syncChain();
  }, [syncChain]);

  const switchInput = useCallback(async (deviceId: string) => {
    await engineRef.current.switchInput(deviceId);
  }, []);

  // Level meter animation loop
  useEffect(() => {
    if (!isRunning) return;
    let raf: number;
    const tick = () => {
      setInputLevel(engineRef.current.getInputLevel());
      setOutputLevel(engineRef.current.getOutputLevel());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isRunning]);

  const getRecordingStream = useCallback(() => {
    return engineRef.current.getRecordingStream();
  }, []);

  return {
    isRunning,
    chain,
    masterVolume,
    inputLevel,
    outputLevel,
    start,
    stop,
    addEffect,
    removeEffect,
    reorderEffects,
    setEffectParam,
    toggleBypass,
    setMasterVolume,
    loadPresetChain,
    switchInput,
    getChainState: () => engineRef.current.getChainState(),
    getRecordingStream,
  };
}

export type AudioEngineAPI = ReturnType<typeof useAudioEngine>;
