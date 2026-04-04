import styles from './Header.module.css';
import { Knob } from '../Knob/Knob';
import { LevelMeter } from '../LevelMeter/LevelMeter';
import { InputSelector } from '../InputSelector/InputSelector';
import { PresetManager } from '../PresetManager/PresetManager';
import { useAudioEngineContext } from '../../context/AudioEngineContext';
import { usePresets } from '../../hooks/usePresets';
import type { ParamDescriptor } from '../../types/effects';

const masterVolumeDescriptor: ParamDescriptor = {
  name: 'master',
  label: 'Master',
  min: 0,
  max: 150,
  default: 100,
  step: 1,
  unit: '%',
};

export function Header() {
  const {
    isRunning,
    start,
    stop,
    masterVolume,
    setMasterVolume,
    inputLevel,
    outputLevel,
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
