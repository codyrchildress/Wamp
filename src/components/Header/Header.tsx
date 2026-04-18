import styles from './Header.module.css';
import { Knob } from '../Knob/Knob';
import { LevelMeter } from '../LevelMeter/LevelMeter';
import { InputSelector } from '../InputSelector/InputSelector';
import { PresetManager } from '../PresetManager/PresetManager';
import { Recorder } from '../Recorder/Recorder';
import { useAudioEngineContext } from '../../context/AudioEngineContext';
import { usePresets } from '../../hooks/usePresets';
import type { ParamDescriptor } from '../../types/effects';
import type { RecorderAPI } from '../../hooks/useRecorder';

const masterVolumeDescriptor: ParamDescriptor = {
  name: 'master',
  label: 'Master',
  min: 0,
  max: 150,
  default: 100,
  step: 1,
  unit: '%',
};

interface HeaderProps {
  recorder: RecorderAPI;
}

export function Header({ recorder }: HeaderProps) {
  const {
    isRunning,
    start,
    stop,
    masterVolume,
    setMasterVolume,
    forceMono,
    setForceMono,
    inputLevel,
    outputLevel,
    micMuted,
    toggleMicMute,
    switchInput,
    loadPresetChain,
    chain,
  } = useAudioEngineContext();

  const { presets, activePresetId, savePreset, deletePreset, selectPreset } = usePresets();

  const handleLoadPreset = (preset: { id: string; chain: Array<{ type: string; bypassed: boolean; params: Record<string, number> }> }) => {
    selectPreset(preset.id);
    loadPresetChain(preset.chain as Parameters<typeof loadPresetChain>[0]);
  };

  const handleSavePreset = (name: string) => {
    savePreset(name, chain);
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.logo}>Wamp</h1>
        <div className={styles.powerSection}>
          {isRunning ? (
            <button className={`${styles.powerBtn} ${styles.on}`} onClick={stop}>
              <span className={styles.powerDot} /> ON
            </button>
          ) : (
            <button className={`${styles.powerBtn} ${styles.off}`} onClick={() => start()}>
              <span className={styles.powerDot} /> START
            </button>
          )}
        </div>
        {isRunning && <InputSelector onSelect={switchInput} />}
        {isRunning && (
          <button
            className={`${styles.muteBtn} ${micMuted ? styles.muted : ''}`}
            onClick={toggleMicMute}
            title={micMuted ? 'Unmute mic' : 'Mute mic'}
          >
            {micMuted ? 'MIC OFF' : 'MIC'}
          </button>
        )}
        {isRunning && (
          <button
            className={`${styles.monoBtn} ${forceMono ? styles.monoOn : ''}`}
            onClick={() => setForceMono(!forceMono)}
            title="Sum L+R to mono (useful when guitar only comes through one channel)"
          >
            MONO
          </button>
        )}
      </div>

      <div className={styles.center}>
        {isRunning && (
          <PresetManager
            presets={presets}
            activePresetId={activePresetId}
            onLoad={handleLoadPreset}
            onSave={handleSavePreset}
            onDelete={deletePreset}
          />
        )}
      </div>

      <div className={styles.right}>
        {isRunning && (
          <>
            <Recorder recorder={recorder} />
            <div className={styles.divider} />
            <LevelMeter level={inputLevel} label="IN" />
            <LevelMeter level={outputLevel} label="OUT" color="#4da6e0" />
            <Knob
              descriptor={masterVolumeDescriptor}
              value={masterVolume * 100}
              onChange={(v) => setMasterVolume(v / 100)}
              color="#e0c44d"
              size={44}
            />
          </>
        )}
      </div>
    </header>
  );
}
