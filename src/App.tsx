import { useCallback } from 'react';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useRecorder } from './hooks/useRecorder';
import { useSynth } from './hooks/useSynth';
import { useDrumKit } from './hooks/useDrumKit';
import { AudioEngineContext } from './context/AudioEngineContext';
import { Header } from './components/Header/Header';
import { Pedalboard } from './components/Pedalboard/Pedalboard';
import { TrimEditor } from './components/TrimEditor/TrimEditor';
import { DrumKit } from './components/DrumKit/DrumKit';
import { Synthesizer } from './components/Synthesizer/Synthesizer';
import './App.css';

function App() {
  const engine = useAudioEngine();
  const recorder = useRecorder(engine.getRecordingStream, engine.getContext);
  const synth = useSynth(engine.getContext, engine.getInputNode, engine.isRunning);
  const drumKit = useDrumKit(engine.getContext);

  const handleSendToPad = useCallback(() => {
    const buf = recorder.getTrimmedBuffer();
    if (buf) drumKit.startAssign(buf);
  }, [recorder, drumKit]);

  return (
    <AudioEngineContext.Provider value={engine}>
      <div className="app">
        <Header recorder={recorder} />
        <Pedalboard />
        {engine.isRunning && recorder.hasRecording && (
          <TrimEditor recorder={recorder} onSendToPad={handleSendToPad} />
        )}
        {engine.isRunning && <DrumKit drumKit={drumKit} />}
        {engine.isRunning && <Synthesizer synth={synth} />}
      </div>
    </AudioEngineContext.Provider>
  );
}

export default App;
