import { useState, useEffect } from 'react';
import styles from './DrumKit.module.css';
import type { DrumKitAPI } from '../../hooks/useDrumKit';

interface DrumKitProps {
  drumKit: DrumKitAPI;
}

export function DrumKit({ drumKit }: DrumKitProps) {
  const {
    pads,
    activePads,
    enabled,
    setEnabled,
    isAssigning,
    triggerPad,
    cancelAssign,
    assignToPad,
    clearPadSample,
  } = drumKit;

  const [expanded, setExpanded] = useState(true);

  // Auto-expand when entering assign mode
  useEffect(() => {
    if (isAssigning) setExpanded(true);
  }, [isAssigning]);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    setEnabled(next);
  };

  return (
    <div className={`${styles.kit} ${expanded ? styles.expanded : ''}`}>
      <div className={styles.topBar}>
        <button
          className={`${styles.toggleBtn} ${expanded ? styles.on : ''}`}
          onClick={handleToggle}
        >
          <span className={styles.toggleDot} />
          DRUM KIT
        </button>

        {expanded && isAssigning && (
          <div className={styles.assignBanner}>
            Click a pad or press its key to assign sample
            <button className={styles.cancelBtn} onClick={cancelAssign}>
              Cancel
            </button>
          </div>
        )}

        {expanded && !isAssigning && (
          <div className={styles.hint}>
            Keys: 1-4 / Q-R / A-F / Z-V
          </div>
        )}
      </div>

      {expanded && (
        <div className={styles.padGrid}>
          {pads.map((pad, i) => (
            <button
              key={pad.key}
              className={[
                styles.pad,
                activePads.has(i) ? styles.active : '',
                isAssigning ? styles.assigning : '',
                pad.customBuffer ? styles.hasSample : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onPointerDown={(e) => {
                e.preventDefault();
                if (isAssigning) {
                  assignToPad(i);
                } else {
                  triggerPad(i);
                }
              }}
            >
              <span className={styles.padKey}>{pad.key}</span>
              <span className={styles.padName}>{pad.name}</span>
              {pad.customBuffer && (
                <button
                  className={styles.clearBtn}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    clearPadSample(i);
                  }}
                >
                  ×
                </button>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
