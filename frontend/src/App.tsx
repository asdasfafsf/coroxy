import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sessions,
  ProxyState,
  ReplaySession,
  StartProxy,
  StopProxy,
  ClearSessions,
  ExportSessionsHAR,
  ExportSessionsJSON,
  ImportSessionsHAR,
  ImportSessionsSAZ,
  EnableSystemProxy,
  DisableSystemProxy,
  IsSystemProxyActive,
  SaveSessions,
  LoadSessions,
  SetThrottle,
  ThrottleState,
} from '../wailsjs/go/app/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { model } from '../wailsjs/go/models';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { AppMenubar } from '@/components/layout/AppMenubar';
import { Toolbar } from '@/components/layout/Toolbar';
import { SessionList } from '@/components/session/SessionList';
import { SessionSidebar } from '@/components/session/SessionSidebar';
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
import {
  copyToClipboard,
  copyUrl,
  copyRequestHeaders,
  copyResponseHeaders,
  copyCurl,
  copyResponseBody,
} from '@/lib/copy';
import { decodeBody } from '@/lib/format';
import { useHotkeys } from '@/hooks/useHotkeys';
import { type SessionFilter, EMPTY_FILTER, filterSessions } from '@/lib/filter';

function App() {
  const { theme, setTheme } = useTheme();
  const [sessions, setSessions] = useState<model.Session[]>([]);
  const [proxyState, setProxyState] = useState('stopped');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [composerPrefill, setComposerPrefill] = useState<{
    method: string;
    url: string;
    headers: string;
    body: string;
  } | null>(null);
  const [filter, setFilter] = useState<SessionFilter>(EMPTY_FILTER);
  const [diffSessionA, setDiffSessionA] = useState<model.Session | null>(null);
  const [diffSessionB, setDiffSessionB] = useState<model.Session | null>(null);
  const [sysProxy, setSysProxy] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTextWizard, setShowTextWizard] = useState(false);
  const [marks, setMarks] = useState<Map<string, string>>(new Map());
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [throttlePreset, setThrottlePreset] = useState('off');

  // Multi-session tabs
  const [sessionTabs, setSessionTabs] = useState([
    { id: 'default', label: 'All Traffic', filterId: 'default' },
  ]);
  const [activeTabId, setActiveTabId] = useState('default');

  const handleTabAdd = useCallback(() => {
    const id = `tab-${Date.now()}`;
    setSessionTabs((prev) => [...prev, { id, label: `Session ${prev.length + 1}`, filterId: id }]);
    setActiveTabId(id);
  }, []);

  useEffect(() => {
    Sessions()
      .then((s) => setSessions(s || []))
      .catch(() => {});
    ProxyState()
      .then(setProxyState)
      .catch(() => {});
    IsSystemProxyActive()
      .then(setSysProxy)
      .catch(() => {});
    ThrottleState()
      .then((cfg) => setThrottlePreset(cfg.preset))
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const cancel = EventsOn('coroxy:session:new', (session: model.Session) => {
        setSessions((prev) => [session, ...prev]);
      });
      return cancel;
    } catch {
      /* not in Wails */
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      ProxyState()
        .then(setProxyState)
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const isRunning = proxyState === 'running';

  const filteredSessions = useMemo(() => {
    let result = filterSessions(sessions, filter);
    if (hiddenTypes.size > 0) {
      result = result.filter((s) => {
        const ct = s.response?.content_type?.toLowerCase() || '';
        for (const hidden of hiddenTypes) {
          if (ct.includes(hidden)) return false;
        }
        return true;
      });
    }
    return result;
  }, [sessions, filter, hiddenTypes]);

  // Active session for Inspector (last clicked)
  const activeSession = useMemo(() => {
    if (!activeSessionId) return null;
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const handleSelect = useCallback(
    (session: model.Session, e?: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
      setActiveSessionId(session.id);

      if (e?.shiftKey && activeSessionId) {
        // Shift+click: range select
        const sessionIds = filteredSessions.map((s) => s.id);
        const startIdx = sessionIds.indexOf(activeSessionId);
        const endIdx = sessionIds.indexOf(session.id);
        if (startIdx >= 0 && endIdx >= 0) {
          const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          const rangeIds = sessionIds.slice(lo, hi + 1);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const id of rangeIds) next.add(id);
            return next;
          });
          return;
        }
      }

      if (e?.metaKey || e?.ctrlKey) {
        // Cmd/Ctrl+click: toggle individual
        setSelectedIds((prev) => {
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
    },
    [activeSessionId, filteredSessions],
  );

  const handleSessionsClear = useCallback(() => {
    setSessions([]);
    setSelectedIds(new Set());
    setActiveSessionId(null);
  }, []);

  const handleMark = useCallback(
    (color: string) => {
      setMarks((prev) => {
        const next = new Map(prev);
        for (const id of selectedIds) next.set(id, color);
        return next;
      });
    },
    [selectedIds],
  );

  const handleUnmarkAll = useCallback(() => {
    setMarks(new Map());
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    setSessions((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    setSelectedIds(new Set());
    setActiveSessionId(null);
  }, [selectedIds]);

  const handleToggleProxy = useCallback(async () => {
    try {
      if (isRunning) {
        await StopProxy();
      } else {
        await StartProxy();
      }
      setProxyState(await ProxyState());
    } catch (e) {
      toast.error('프록시 토글 실패', { description: String(e) });
    }
  }, [isRunning]);

  const handleToggleSysProxy = useCallback(async () => {
    try {
      if (sysProxy) {
        await DisableSystemProxy();
      } else {
        await EnableSystemProxy();
      }
      setSysProxy(!sysProxy);
    } catch (e) {
      toast.error('시스템 프록시 토글 실패', { description: String(e) });
    }
  }, [sysProxy]);

  const handleClear = useCallback(async () => {
    await ClearSessions();
    handleSessionsClear();
  }, [handleSessionsClear]);

  const handleReplay = useCallback((session: model.Session) => {
    ReplaySession(session.id).catch((e) => toast.error('Replay 실패', { description: String(e) }));
  }, []);

  const handleDiff = useCallback(
    (session: model.Session) => {
      if (!diffSessionA) {
        setDiffSessionA(session);
      } else {
        setDiffSessionB(session);
      }
    },
    [diffSessionA],
  );

  const handleCompareFromMenu = useCallback(() => {
    if (selectedIds.size !== 2) return;
    const ids = [...selectedIds];
    const a = sessions.find((s) => s.id === ids[0]);
    const b = sessions.find((s) => s.id === ids[1]);
    if (a && b) {
      setDiffSessionA(a);
      setDiffSessionB(b);
    }
  }, [selectedIds, sessions]);

  const handleComposerPrefill = useCallback((session: model.Session) => {
    const req = session.request;
    if (!req) return;
    const headerLines = req.headers
      ? Object.entries(req.headers)
          .map(([k, vs]) => `${k}: ${Array.isArray(vs) ? vs.join(', ') : vs}`)
          .join('\n')
      : '';
    setComposerPrefill({
      method: req.method || 'GET',
      url: req.url || '',
      headers: headerLines,
      body: decodeBody(req.body) || '',
    });
    setShowComposer(true);
  }, []);

  const showDiff = !!diffSessionA && !!diffSessionB;

  // Navigate session list with arrow keys
  const navigateSession = useCallback(
    (direction: 'up' | 'down') => {
      if (filteredSessions.length === 0) return;
      const currentIdx = activeSessionId
        ? filteredSessions.findIndex((s) => s.id === activeSessionId)
        : -1;
      const nextIdx =
        direction === 'down'
          ? Math.min(currentIdx + 1, filteredSessions.length - 1)
          : Math.max(currentIdx - 1, 0);
      const nextSession = filteredSessions[nextIdx];
      if (nextSession) {
        setActiveSessionId(nextSession.id);
        setSelectedIds(new Set([nextSession.id]));
      }
    },
    [filteredSessions, activeSessionId],
  );

  // Global keyboard shortcuts (Cmd/Ctrl cross-platform)
  useHotkeys(
    useMemo(
      () => [
        // File
        { key: 'e', mod: true, handler: handleToggleProxy },
        { key: ',', mod: true, handler: () => setShowSettings(true) },
        // Edit
        { key: 'x', mod: true, shift: true, handler: handleClear },
        {
          key: 'c',
          mod: true,
          handler: () => activeSession && copyToClipboard(copyUrl(activeSession)),
        },
        {
          key: 'f',
          mod: true,
          handler: () =>
            document.querySelector<HTMLInputElement>('[placeholder*="filter" i]')?.focus(),
        },
        {
          key: 'a',
          mod: true,
          handler: () => setSelectedIds(new Set(filteredSessions.map((s) => s.id))),
        },
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
        {
          key: 'Escape',
          handler: () => {
            setShowSettings(false);
            setShowRules(false);
            setShowComposer(false);
            if (showDiff) {
              setDiffSessionA(null);
              setDiffSessionB(null);
            }
          },
        },
      ],
      [
        handleToggleProxy,
        handleClear,
        handleDeleteSelected,
        activeSession,
        filteredSessions,
        navigateSession,
        showDiff,
      ],
    ),
  );

  return (
    <TooltipProvider>
      <ResizablePanelGroup
        orientation="horizontal"
        className="h-screen bg-background text-foreground font-sans"
      >
        {/* ===== Left sidebar — session groups ===== */}
        <ResizablePanel defaultSize={15} minSize={8} maxSize={30}>
          <div className="h-full border-r border-border flex flex-col overflow-hidden">
            <SessionSidebar
              groups={sessionTabs.map((t) => ({
                id: t.id,
                label: t.label,
                count: t.id === activeTabId ? filteredSessions.length : 0,
              }))}
              activeGroupId={activeTabId}
              onGroupChange={setActiveTabId}
              onGroupAdd={handleTabAdd}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle />

        {/* ===== Right main column ===== */}
        <ResizablePanel defaultSize={85} minSize={40}>
          <div className="flex flex-col h-full min-w-0">
            {/* Menubar */}
            <AppMenubar
              isRunning={isRunning}
              sysProxy={sysProxy}
              hasSelection={!!activeSession}
              onToggleProxy={handleToggleProxy}
              onToggleSysProxy={handleToggleSysProxy}
              onClear={handleClear}
              onExportHAR={() =>
                ExportSessionsHAR().catch((e) =>
                  toast.error('HAR export 실패', { description: String(e) }),
                )
              }
              onExportJSON={() =>
                ExportSessionsJSON().catch((e) =>
                  toast.error('JSON export 실패', { description: String(e) }),
                )
              }
              onImportHAR={() =>
                ImportSessionsHAR().catch((e) =>
                  toast.error('HAR import 실패', { description: String(e) }),
                )
              }
              onImportSAZ={() =>
                ImportSessionsSAZ().catch((e) =>
                  toast.error('SAZ import 실패', { description: String(e) }),
                )
              }
              onSettingsClick={() => setShowSettings(true)}
              onRulesClick={() => setShowRules(true)}
              onComposerClick={() => setShowComposer(true)}
              onCopyUrl={() => activeSession && copyToClipboard(copyUrl(activeSession))}
              onCopyRequestHeaders={() =>
                activeSession && copyToClipboard(copyRequestHeaders(activeSession))
              }
              onCopyResponseHeaders={() =>
                activeSession && copyToClipboard(copyResponseHeaders(activeSession))
              }
              onCopyCurl={() => activeSession && copyToClipboard(copyCurl(activeSession))}
              onCopyResponseBody={() =>
                activeSession && copyToClipboard(copyResponseBody(activeSession))
              }
              onAboutClick={() => setShowAbout(true)}
              onShortcutsClick={() => setShowShortcuts(true)}
              onSelectAll={() => setSelectedIds(new Set(filteredSessions.map((s) => s.id)))}
              onDeleteSelected={handleDeleteSelected}
              onTextWizardClick={() => setShowTextWizard(true)}
              onCompareClick={handleCompareFromMenu}
              selectedCount={selectedIds.size}
              onMark={handleMark}
              onUnmarkAll={handleUnmarkAll}
              hiddenTypes={hiddenTypes}
              onSave={() =>
                SaveSessions().catch((e) =>
                  toast.error('세션 저장 실패', { description: String(e) }),
                )
              }
              onLoad={() =>
                LoadSessions().catch((e) =>
                  toast.error('세션 불러오기 실패', { description: String(e) }),
                )
              }
              throttlePreset={throttlePreset}
              onThrottleChange={(preset) => {
                SetThrottle(preset);
                setThrottlePreset(preset);
              }}
              onToggleHide={(type) =>
                setHiddenTypes((prev) => {
                  const next = new Set(prev);
                  if (next.has(type)) next.delete(type);
                  else next.add(type);
                  return next;
                })
              }
            />
            {/* Toolbar */}
            <Toolbar
              onSessionsClear={handleSessionsClear}
              filter={filter}
              onFilterChange={setFilter}
            />
            {/* Request table + Inspector — vertical split */}
            <ResizablePanelGroup orientation="vertical" className="flex-1">
              <ResizablePanel defaultSize={45} minSize={20}>
                <SessionList
                  sessions={filteredSessions}
                  selectedIds={selectedIds}
                  activeId={activeSessionId}
                  onSelect={handleSelect}
                  onReplay={handleReplay}
                  onComposerPrefill={handleComposerPrefill}
                  onDiff={handleDiff}
                  diffPending={!!diffSessionA && !diffSessionB}
                  marks={marks}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={55} minSize={20}>
                <div className="h-full bg-card overflow-hidden">
                  <Inspector session={activeSession} />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
            {/* StatusBar inside main column */}
            <StatusBar
              sessionCount={sessions.length}
              selectedCount={selectedIds.size}
              isRunning={isRunning}
              theme={theme}
              onThemeChange={setTheme}
              totalRequestBytes={sessions.reduce((sum, s) => sum + (s.request?.body_size || 0), 0)}
              totalResponseBytes={sessions.reduce(
                (sum, s) => sum + (s.response?.body_size || 0),
                0,
              )}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Modals — outside main flex layout */}
      <Composer
        open={showComposer}
        onClose={() => {
          setShowComposer(false);
          setComposerPrefill(null);
        }}
        prefill={composerPrefill}
      />
      <Settings open={showSettings} onOpenChange={setShowSettings} />
      <RuleEditor open={showRules} onOpenChange={setShowRules} />
      {showDiff && diffSessionA && diffSessionB && (
        <SessionDiff
          sessionA={diffSessionA}
          sessionB={diffSessionB}
          open={showDiff}
          onOpenChange={(open) => {
            if (!open) {
              setDiffSessionA(null);
              setDiffSessionB(null);
            }
          }}
        />
      )}
      <BreakpointPanel />
      <AboutDialog open={showAbout} onOpenChange={setShowAbout} />
      <ShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
      <TextWizard open={showTextWizard} onOpenChange={setShowTextWizard} />
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
