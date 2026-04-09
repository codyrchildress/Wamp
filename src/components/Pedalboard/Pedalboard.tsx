import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import styles from './Pedalboard.module.css';
import { Pedal } from '../Pedal/Pedal';
import { AddPedal } from '../AddPedal/AddPedal';
import { useAudioEngineContext } from '../../context/AudioEngineContext';

export function Pedalboard() {
  const { chain, reorderEffects } = useAudioEngineContext();
  const [expanded, setExpanded] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = chain.findIndex((s) => s.id === active.id);
    const toIndex = chain.findIndex((s) => s.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderEffects(fromIndex, toIndex);
    }
  };

  return (
    <div className={`${styles.board} ${expanded ? styles.expanded : styles.collapsed}`}>
      <div className={styles.topBar}>
        <button
          className={`${styles.toggleBtn} ${expanded ? styles.on : ''}`}
          onClick={() => setExpanded(!expanded)}
        >
          <span className={styles.toggleDot} />
          FX CHAIN
        </button>
        {expanded && chain.length > 0 && (
          <span className={styles.chainCount}>{chain.length} pedal{chain.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {expanded && (
        <div className={styles.chain}>
          {chain.length === 0 && (
            <div className={styles.empty}>
              Add effects to build your signal chain
            </div>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={chain.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
              {chain.map((slot) => (
                <Pedal key={slot.id} slot={slot} />
              ))}
            </SortableContext>
          </DndContext>
          <AddPedal />
        </div>
      )}
    </div>
  );
}
