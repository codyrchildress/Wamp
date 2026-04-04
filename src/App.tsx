import { useAudioEngine } from './hooks/useAudioEngine';
import { AudioEngineContext } from './context/AudioEngineContext';
import { Header } from './components/Header/Header';
import { Pedalboard } from './components/Pedalboard/Pedalboard';
import './App.css';

function App() {
  const engine = useAudioEngine();

  return (
    <AudioEngineContext.Provider value={engine}>
      <div className="app">
        <Header />
        <Pedalboard />
      </div>
    </AudioEngineContext.Provider>
  );
}

export default App;
