import { useState, useEffect, useCallback } from 'react';
import { GetSessions, GetProxyState } from '../wailsjs/go/app/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { model } from '../wailsjs/go/models';
import { Toolbar } from './components/Toolbar';
import { SessionList } from './components/SessionList';
import { Inspector } from './components/Inspector';
import { StatusBar } from './components/StatusBar';
import { Settings } from './components/Settings';

function App() {
  const [sessions, setSessions] = useState<model.Session[]>([]);
  const [proxyState, setProxyState] = useState('stopped');
  const [selectedSession, setSelectedSession] = useState<model.Session | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    GetSessions().then((s) => setSessions(s || []));
    GetProxyState().then(setProxyState);
  }, []);

  useEffect(() => {
    const cancel = EventsOn('coroxy:session:new', (session: model.Session) => {
      setSessions((prev) => [session, ...prev]);
    });
    return cancel;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      GetProxyState().then(setProxyState);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSessionsClear = useCallback(() => {
    setSessions([]);
    setSelectedSession(null);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#1e1e2e] text-[#cdd6f4] font-sans">
      <Toolbar
        onSessionsClear={handleSessionsClear}
        onSettingsClick={() => setShowSettings(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <SessionList
          sessions={sessions}
          selectedId={selectedSession?.id || null}
          onSelect={setSelectedSession}
        />
        <div className="w-[400px] border-l border-[#313244] bg-[#181825]">
          <Inspector session={selectedSession} />
        </div>
      </div>
      <StatusBar sessionCount={sessions.length} isRunning={proxyState === 'running'} />
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
