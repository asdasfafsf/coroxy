import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sessions, ProxyState, ReplaySession, StartProxy, StopProxy, ClearSessions, ExportSessionsHAR, ExportSessionsJSON, ImportSessionsHAR, ImportSessionsSAZ, EnableSystemProxy, DisableSystemProxy, IsSystemProxyActive } from '../wailsjs/go/app/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { model } from '../wailsjs/go/models';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
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
import { AboutDialog } from '@/components/tools/AboutDialog';
import { ShortcutsDialog } from '@/components/tools/ShortcutsDialog';
import { TextWizard } from '@/components/tools/TextWizard';
import { useTheme } from '@/hooks/useTheme';
import { copyToClipboard, copyUrl, copyRequestHeaders, copyResponseHeaders, copyCurl, copyResponseBody } from '@/lib/copy';
import { useHotkeys } from '@/hooks/useHotkeys';

function App() {
  const { theme, setTheme } = useTheme();
  const [sessions, setSessions] = useState<model.Session[]>([]);
  const [proxyState, setProxyState] = useState('stopped');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [composerPrefill, setComposerPrefill] = useState<{ method: string; url: string; headers: string; body: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [diffSessionA, setDiffSessionA] = useState<model.Session | null>(null);
  const [diffSessionB, setDiffSessionB] = useState<model.Session | null>(null);
  const [sysProxy, setSysProxy] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTextWizard, setShowTextWizard] = useState(false);

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

  // Active session for Inspector (last clicked)
  const activeSession = useMemo(() => {
    if (!activeSessionId) return null;
    return sessions.find(s => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const handleSelect = useCallback((session: model.Session, e?: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
    setActiveSessionId(session.id);

    if (e?.shiftKey && activeSessionId) {
      // Shift+click: range select
      const sessionIds = filteredSessions.map(s => s.id);
      const startIdx = sessionIds.indexOf(activeSessionId);
      const endIdx = sessionIds.indexOf(session.id);
      if (startIdx >= 0 && endIdx >= 0) {
        const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const rangeIds = sessionIds.slice(lo, hi + 1);
        setSelectedIds(prev => {
          const next = new Set(prev);
          for (const id of rangeIds) next.add(id);
          return next;
        });
        return;
      }
    }

    if (e?.metaKey || e?.ctrlKey) {
      // Cmd/Ctrl+click: toggle individual
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(session.id)) {
          next.delete(session.id);
        } else {
          next.add(session.id);
        }
        return next;
      });
      return;
    }

    // Normal click: single select
    setSelectedIds(new Set([session.id]));
  }, [activeSessionId, filteredSessions]);

  const handleSessionsClear = useCallback(() => {
    setSessions([]);
    setSelectedIds(new Set());
    setActiveSessionId(null);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    setSessions(prev => prev.filter(s => !selectedIds.has(s.id)));
    setSelectedIds(new Set());
    setActiveSessionId(null);
  }, [selectedIds]);

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

  const handleCompareFromMenu = useCallback(() => {
    if (selectedIds.size !== 2) return;
    const ids = [...selectedIds];
    const a = sessions.find(s => s.id === ids[0]);
    const b = sessions.find(s => s.id === ids[1]);
    if (a && b) {
      setDiffSessionA(a);
      setDiffSessionB(b);
    }
  }, [selectedIds, sessions]);

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

  const showDiff = !!diffSessionA && !!diffSessionB;

  // Navigate session list with arrow keys
  const navigateSession = useCallback((direction: 'up' | 'down') => {
    if (filteredSessions.length === 0) return;
    const currentIdx = activeSessionId ? filteredSessions.findIndex(s => s.id === activeSessionId) : -1;
    const nextIdx = direction === 'down'
      ? Math.min(currentIdx + 1, filteredSessions.length - 1)
      : Math.max(currentIdx - 1, 0);
    const nextSession = filteredSessions[nextIdx];
    if (nextSession) {
      setActiveSessionId(nextSession.id);
      setSelectedIds(new Set([nextSession.id]));
    }
  }, [filteredSessions, activeSessionId]);

  // Global keyboard shortcuts (Cmd/Ctrl cross-platform)
  useHotkeys(useMemo(() => [
    // File
    { key: 'e', mod: true, handler: handleToggleProxy },
    { key: ',', mod: true, handler: () => setShowSettings(true) },
    // Edit
    { key: 'x', mod: true, shift: true, handler: handleClear },
    { key: 'c', mod: true, handler: () => activeSession && copyToClipboard(copyUrl(activeSession)) },
    { key: 'f', mod: true, handler: () => document.querySelector<HTMLInputElement>('[placeholder*="Filter"]')?.focus() },
    { key: 'a', mod: true, handler: () => setSelectedIds(new Set(filteredSessions.map(s => s.id))) },
    // Rules
    { key: 'r', mod: true, shift: true, handler: () => setShowRules(true) },
    // Tools
    { key: 'n', mod: true, shift: true, handler: () => setShowComposer(true) },
    // Navigation
    { key: 'ArrowDown', handler: () => navigateSession('down') },
    { key: 'ArrowUp', handler: () => navigateSession('up') },
    // Delete
    { key: 'Delete', handler: handleDeleteSelected },
    { key: 'Backspace', handler: handleDeleteSelected },
    // Help
    { key: '?', handler: () => setShowShortcuts(true) },
    // General
    { key: 'Escape', handler: () => {
      setShowSettings(false);
      setShowRules(false);
      setShowComposer(false);
      if (showDiff) { setDiffSessionA(null); setDiffSessionB(null); }
    }},
  ], [handleToggleProxy, handleClear, handleDeleteSelected, activeSession, filteredSessions, navigateSession, showDiff]));

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background text-foreground font-sans">
        <AppMenubar
          isRunning={isRunning}
          sysProxy={sysProxy}
          hasSelection={!!activeSession}
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
          onCopyUrl={() => activeSession && copyToClipboard(copyUrl(activeSession))}
          onCopyRequestHeaders={() => activeSession && copyToClipboard(copyRequestHeaders(activeSession))}
          onCopyResponseHeaders={() => activeSession && copyToClipboard(copyResponseHeaders(activeSession))}
          onCopyCurl={() => activeSession && copyToClipboard(copyCurl(activeSession))}
          onCopyResponseBody={() => activeSession && copyToClipboard(copyResponseBody(activeSession))}
          onAboutClick={() => setShowAbout(true)}
          onShortcutsClick={() => setShowShortcuts(true)}
          onSelectAll={() => setSelectedIds(new Set(filteredSessions.map(s => s.id)))}
          onDeleteSelected={handleDeleteSelected}
          onTextWizardClick={() => setShowTextWizard(true)}
          onCompareClick={handleCompareFromMenu}
          selectedCount={selectedIds.size}
        />
        <Toolbar
          onSessionsClear={handleSessionsClear}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <ResizablePanelGroup orientation="horizontal" id="coroxy-main" className="flex-1">
          <ResizablePanel defaultSize={65} minSize={30}>
            <SessionList
              sessions={filteredSessions}
              selectedIds={selectedIds}
              activeId={activeSessionId}
              onSelect={handleSelect}
              onReplay={handleReplay}
              onComposerPrefill={handleComposerPrefill}
              onDiff={handleDiff}
              diffPending={!!diffSessionA && !diffSessionB}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={35} minSize={20}>
            <div className="h-full bg-card">
              <Inspector session={activeSession} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
        <StatusBar
          sessionCount={sessions.length}
          selectedCount={selectedIds.size}
          isRunning={isRunning}
          theme={theme}
          onThemeChange={setTheme}
        />

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
        <AboutDialog open={showAbout} onOpenChange={setShowAbout} />
        <ShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
        <TextWizard open={showTextWizard} onOpenChange={setShowTextWizard} />
      </div>
    </TooltipProvider>
  );
}

export default App;
