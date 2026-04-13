import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sessions, ProxyState, ReplaySession, StartProxy, StopProxy, ClearSessions, ExportSessionsHAR, ExportSessionsJSON, ImportSessionsHAR, ImportSessionsSAZ, EnableSystemProxy, DisableSystemProxy, IsSystemProxyActive } from '../wailsjs/go/app/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { model } from '../wailsjs/go/models';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppMenubar } from '@/components/layout/AppMenubar';
import { Toolbar } from '@/components/layout/Toolbar';
import { SessionList } from '@/components/session/SessionList';
import { Inspector } from '@/components/session/Inspector';
import { StatusBar } from '@/components/layout/StatusBar';
import { Settings } from '@/components/tools/Settings';
import { RuleEditor } from '@/components/tools/RuleEditor';
import { BreakpointPanel } from '@/components/tools/BreakpointPanel';
import { Composer } from '@/components/tools/Composer';
import { SessionDiff } from '@/components/tools/SessionDiff';

function App() {
  const [sessions, setSessions] = useState<model.Session[]>([]);
  const [proxyState, setProxyState] = useState('stopped');
  const [selectedSession, setSelectedSession] = useState<model.Session | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [composerPrefill, setComposerPrefill] = useState<{ method: string; url: string; headers: string; body: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [diffSessionA, setDiffSessionA] = useState<model.Session | null>(null);
  const [diffSessionB, setDiffSessionB] = useState<model.Session | null>(null);
  const [sysProxy, setSysProxy] = useState(false);

  useEffect(() => {
    Sessions().then((s) => setSessions(s || []));
    ProxyState().then(setProxyState);
    IsSystemProxyActive().then(setSysProxy);
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

  const isRunning = proxyState === 'running';

  const handleSessionsClear = useCallback(() => {
    setSessions([]);
    setSelectedSession(null);
  }, []);

  const handleToggleProxy = useCallback(async () => {
    try {
      if (isRunning) { await StopProxy(); } else { await StartProxy(); }
      setProxyState(await ProxyState());
    } catch (e) { console.error('proxy toggle failed:', e); }
  }, [isRunning]);

  const handleToggleSysProxy = useCallback(async () => {
    try {
      if (sysProxy) { await DisableSystemProxy(); } else { await EnableSystemProxy(); }
      setSysProxy(!sysProxy);
    } catch (e) { console.error('sys proxy toggle failed:', e); }
  }, [sysProxy]);

  const handleClear = useCallback(async () => {
    await ClearSessions();
    handleSessionsClear();
  }, [handleSessionsClear]);

  const handleReplay = useCallback((session: model.Session) => {
    ReplaySession(session.id).catch((e) => console.error('replay failed:', e));
  }, []);

  const handleDiff = useCallback((session: model.Session) => {
    if (!diffSessionA) {
      setDiffSessionA(session);
    } else {
      setDiffSessionB(session);
    }
  }, [diffSessionA]);

  const handleComposerPrefill = useCallback((session: model.Session) => {
    const req = session.request;
    if (!req) return;
    const headerLines = req.headers
      ? Object.entries(req.headers).map(([k, vs]) => `${k}: ${Array.isArray(vs) ? vs.join(', ') : vs}`).join('\n')
      : '';
    setComposerPrefill({
      method: req.method || 'GET',
      url: req.url || '',
      headers: headerLines,
      body: req.body ? (typeof req.body === 'string' ? atob(req.body) : new TextDecoder().decode(new Uint8Array(req.body))) : '',
    });
    setShowComposer(true);
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

  const showDiff = !!diffSessionA && !!diffSessionB;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background text-foreground font-sans">
        <AppMenubar
          isRunning={isRunning}
          sysProxy={sysProxy}
          onToggleProxy={handleToggleProxy}
          onToggleSysProxy={handleToggleSysProxy}
          onClear={handleClear}
          onExportHAR={() => ExportSessionsHAR().catch(console.error)}
          onExportJSON={() => ExportSessionsJSON().catch(console.error)}
          onImportHAR={() => ImportSessionsHAR().catch(console.error)}
          onImportSAZ={() => ImportSessionsSAZ().catch(console.error)}
          onSettingsClick={() => setShowSettings(true)}
          onRulesClick={() => setShowRules(true)}
          onComposerClick={() => setShowComposer(true)}
        />
        <Toolbar
          onSessionsClear={handleSessionsClear}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div className="flex flex-1 overflow-hidden">
          <SessionList
            sessions={filteredSessions}
            selectedId={selectedSession?.id || null}
            onSelect={setSelectedSession}
            onReplay={handleReplay}
            onComposerPrefill={handleComposerPrefill}
            onDiff={handleDiff}
            diffPending={!!diffSessionA && !diffSessionB}
          />
          <div className="w-[400px] border-l border-border bg-card">
            <Inspector session={selectedSession} />
          </div>
        </div>
        <StatusBar sessionCount={sessions.length} isRunning={isRunning} />

        <Settings open={showSettings} onOpenChange={setShowSettings} />
        <RuleEditor open={showRules} onOpenChange={setShowRules} />
        <Composer
          open={showComposer}
          onOpenChange={(open) => { setShowComposer(open); if (!open) setComposerPrefill(null); }}
          prefill={composerPrefill}
        />
        {showDiff && diffSessionA && diffSessionB && (
          <SessionDiff
            sessionA={diffSessionA}
            sessionB={diffSessionB}
            open={showDiff}
            onOpenChange={(open) => { if (!open) { setDiffSessionA(null); setDiffSessionB(null); } }}
          />
        )}
        <BreakpointPanel />
      </div>
    </TooltipProvider>
  );
}

export default App;
