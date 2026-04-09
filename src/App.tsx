import { useAudioEngine } from './hooks/useAudioEngine';
import { useSynth } from './hooks/useSynth';
import { AudioEngineContext } from './context/AudioEngineContext';
import { Header } from './components/Header/Header';
import { Pedalboard } from './components/Pedalboard/Pedalboard';
import { Synthesizer } from './components/Synthesizer/Synthesizer';
import './App.css';

function App() {
  const engine = useAudioEngine();
  const synth = useSynth(engine.getContext, engine.getInputNode, engine.isRunning);

  return (
    <AudioEngineContext.Provider value={engine}>
      <div className="app">
        <Header />
        <Pedalboard />
        {engine.isRunning && <Synthesizer synth={synth} />}
      </div>
    </AudioEngineContext.Provider>
  );
}

export default App;
