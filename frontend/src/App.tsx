import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sessions, ProxyState } from '../wailsjs/go/app/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { model } from '../wailsjs/go/models';
import { Toolbar } from './components/Toolbar';
import { SessionList } from './components/SessionList';
import { Inspector } from './components/Inspector';
import { StatusBar } from './components/StatusBar';
import { Settings } from './components/Settings';
import { RuleEditor } from './components/RuleEditor';
import { BreakpointPanel } from './components/BreakpointPanel';
import { Composer } from './components/Composer';

function App() {
  const [sessions, setSessions] = useState<model.Session[]>([]);
  const [proxyState, setProxyState] = useState('stopped');
  const [selectedSession, setSelectedSession] = useState<model.Session | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    Sessions().then((s) => setSessions(s || []));
    ProxyState().then(setProxyState);
  }, []);

  useEffect(() => {
    const cancel = EventsOn('coroxy:session:new', (session: model.Session) => {
      setSessions((prev) => [session, ...prev]);
    });
    return cancel;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      ProxyState().then(setProxyState);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSessionsClear = useCallback(() => {
    setSessions([]);
    setSelectedSession(null);
  }, []);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => {
      const host = s.target?.host?.toLowerCase() || '';
      const url = s.request?.url?.toLowerCase() || '';
      const method = s.request?.method?.toLowerCase() || '';
      const status = String(s.response?.status_code || '');
      const ct = s.response?.content_type?.toLowerCase() || '';
      return host.includes(q) || url.includes(q) || method.includes(q) || status.includes(q) || ct.includes(q);
    });
  }, [sessions, searchQuery]);

  return (
    <div className="flex flex-col h-screen bg-[#1e1e2e] text-[#cdd6f4] font-sans">
      <Toolbar
        onSessionsClear={handleSessionsClear}
        onSettingsClick={() => setShowSettings(true)}
        onRulesClick={() => setShowRules(true)}
        onComposerClick={() => setShowComposer(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="flex flex-1 overflow-hidden">
        <SessionList
          sessions={filteredSessions}
          selectedId={selectedSession?.id || null}
          onSelect={setSelectedSession}
        />
        <div className="w-[400px] border-l border-[#313244] bg-[#181825]">
          <Inspector session={selectedSession} />
        </div>
      </div>
      <StatusBar sessionCount={sessions.length} isRunning={proxyState === 'running'} />
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showRules && <RuleEditor onClose={() => setShowRules(false)} />}
      {showComposer && <Composer onClose={() => setShowComposer(false)} />}
      <BreakpointPanel />
    </div>
  );
}

export default App;
