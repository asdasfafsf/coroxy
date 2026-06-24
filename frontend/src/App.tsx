import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Sessions,
  ProxyState,
  ReplaySession,
  StartProxy,
  StopProxy,
  ClearSessions,
} from '../wailsjs/go/app/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { model } from '../wailsjs/go/models';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Toolbar } from '@/components/layout/Toolbar';
import { StatusBar } from '@/components/layout/StatusBar';
import { SessionList } from '@/components/session/SessionList';
import { SessionSidebar } from '@/components/session/SessionSidebar';
import { Inspector } from '@/components/session/Inspector';
import { Settings } from '@/components/tools/Settings';
import { RuleEditor } from '@/components/tools/RuleEditor';
import { FilterPanel } from '@/components/tools/FilterPanel';
import { BreakpointPanel } from '@/components/tools/BreakpointPanel';
import { Composer } from '@/components/tools/Composer';
import { SessionDiff } from '@/components/tools/SessionDiff';
import { AboutDialog } from '@/components/tools/AboutDialog';
import { ShortcutsDialog } from '@/components/tools/ShortcutsDialog';
import { TextWizard } from '@/components/tools/TextWizard';
import { copyToClipboard, copyUrl } from '@/lib/copy';
import { decodeBody } from '@/lib/format';
import { useHotkeys } from '@/hooks/useHotkeys';
import { evaluate, loadSavedFilters, saveSavedFilters, type SavedFilter } from '@/lib/filter';

function App() {
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
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => loadSavedFilters());
  const [showFilters, setShowFilters] = useState(false);
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
  useEffect(() => {
    saveSavedFilters(savedFilters);
  }, [savedFilters]);
  const [diffSessionA, setDiffSessionA] = useState<model.Session | null>(null);
  const [diffSessionB, setDiffSessionB] = useState<model.Session | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTextWizard, setShowTextWizard] = useState(false);
  const [marks] = useState<Map<string, string>>(new Map());

  // ===== Sidebar width (manual drag resize) =====
  const SIDEBAR_MIN = 140;
  const SIDEBAR_DEFAULT = 156;
  const SIDEBAR_MAX = 320;
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('coroxy-sidebar-width-v3');
      const n = stored ? parseInt(stored, 10) : SIDEBAR_DEFAULT;
      return Number.isFinite(n) ? Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, n)) : SIDEBAR_DEFAULT;
    } catch {
      return SIDEBAR_DEFAULT;
    }
  });
  const sidebarResizing = useRef(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!sidebarResizing.current) return;
      const next = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, e.clientX));
      setSidebarWidth(next);
    };
    const onUp = () => {
      if (!sidebarResizing.current) return;
      sidebarResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem('coroxy-sidebar-width-v3', String(sidebarWidth));
      } catch {
        // ignore quota/storage errors
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [sidebarWidth]);
  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    sidebarResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // ===== Inspector rail width (manual drag resize) =====
  const INSPECTOR_MIN = 340;
  const INSPECTOR_MAX = 560;
  const getDefaultInspectorWidth = () => {
    const workspaceWidth =
      typeof window === 'undefined' ? 1180 : Math.max(760, window.innerWidth - SIDEBAR_DEFAULT);
    return Math.round(Math.max(INSPECTOR_MIN, Math.min(430, workspaceWidth * 0.32)));
  };
  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    try {
      const fallback = getDefaultInspectorWidth();
      const stored = localStorage.getItem('coroxy-inspector-width-v3');
      const n = stored ? parseInt(stored, 10) : fallback;
      return Number.isFinite(n) ? Math.max(INSPECTOR_MIN, Math.min(INSPECTOR_MAX, n)) : fallback;
    } catch {
      return getDefaultInspectorWidth();
    }
  });
  const inspectorResizing = useRef(false);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!inspectorResizing.current || !workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const maxForWindow = Math.min(INSPECTOR_MAX, Math.max(INSPECTOR_MIN, rect.width * 0.44));
      const next = Math.max(INSPECTOR_MIN, Math.min(maxForWindow, rect.right - e.clientX));
      setInspectorWidth(next);
    };
    const onUp = () => {
      if (!inspectorResizing.current) return;
      inspectorResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem('coroxy-inspector-width-v3', String(inspectorWidth));
      } catch {
        // ignore quota/storage errors
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [inspectorWidth]);
  const handleInspectorResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    inspectorResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

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
    Promise.resolve()
      .then(() => Sessions())
      .then((s) => setSessions(s || []))
      .catch(() => {});
    Promise.resolve()
      .then(() => ProxyState())
      .then(setProxyState)
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
      Promise.resolve()
        .then(() => ProxyState())
        .then(setProxyState)
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const isRunning = proxyState === 'running';

  const trafficTotals = useMemo(
    () =>
      sessions.reduce(
        (acc, session) => {
          acc.requestBytes += session.request?.body_size || 0;
          acc.responseBytes += session.response?.body_size || 0;
          return acc;
        },
        { requestBytes: 0, responseBytes: 0 },
      ),
    [sessions],
  );

  const activeFilter = useMemo<SavedFilter | null>(() => {
    const tab = sessionTabs.find((t) => t.id === activeTabId);
    if (!tab || !tab.filterId || tab.filterId === 'default') return null;
    return savedFilters.find((f) => f.id === tab.filterId) ?? null;
  }, [sessionTabs, activeTabId, savedFilters]);

  const filteredSessions = useMemo(() => {
    const filterMatched = activeFilter
      ? sessions.filter((s) => evaluate(activeFilter, s))
      : sessions;
    const query = quickSearch.trim().toLowerCase();
    if (!query) return filterMatched;

    return filterMatched.filter((s) => {
      const haystack = [
        s.protocol,
        s.state,
        s.target?.host,
        s.request?.method,
        s.request?.url,
        s.request?.content_type,
        s.response?.status_code != null ? String(s.response.status_code) : '',
        s.response?.status_text,
        s.response?.content_type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [sessions, activeFilter, quickSearch]);

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
            document.querySelector<HTMLInputElement>('[placeholder*="find sessions" i]')?.focus(),
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
      <div className="mac-app-shell h-screen text-foreground font-sans">
        <div className="coroxy-window flex h-full min-h-0 flex-col overflow-hidden">
          <div className="fiddler-workbench flex min-h-0 flex-1 overflow-hidden">
            <div
              className="mac-sidebar relative shrink-0 flex flex-col overflow-hidden border-r border-sidebar-border"
              style={{ width: sidebarWidth }}
            >
              <SessionSidebar onGroupAdd={handleTabAdd} />
              <div
                onMouseDown={handleSidebarResizeStart}
                className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize bg-transparent transition-colors z-10 after:absolute after:inset-y-3 after:left-1/2 after:w-px after:-translate-x-1/2 after:rounded-full after:bg-transparent hover:after:bg-primary/45 active:after:bg-primary/70"
                role="separator"
                aria-orientation="vertical"
              />
            </div>

            <div className="mac-main-column flex flex-col flex-1 min-w-0 overflow-hidden">
              <Toolbar
                onSessionsClear={handleSessionsClear}
                onFiltersOpen={() => setShowFilters(true)}
                onProxyToggle={handleToggleProxy}
                onRulesOpen={() => setShowRules(true)}
                quickSearch={quickSearch}
                onQuickSearchChange={setQuickSearch}
                filteredCount={filteredSessions.length}
                totalCount={sessions.length}
                isRunning={isRunning}
              />
              <div ref={workspaceRef} className="main-workspace flex min-h-0 flex-1">
                <div className="min-w-0 flex-1">
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
                </div>
                <div
                  onMouseDown={handleInspectorResizeStart}
                  className="workbench-inspector-resizer"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize inspector rail"
                />
                <div className="h-full shrink-0 overflow-hidden" style={{ width: inspectorWidth }}>
                  <Inspector session={activeSession} />
                </div>
              </div>
              <StatusBar
                sessionCount={sessions.length}
                selectedCount={selectedIds.size}
                isRunning={isRunning}
                totalRequestBytes={trafficTotals.requestBytes}
                totalResponseBytes={trafficTotals.responseBytes}
              />
            </div>
          </div>
        </div>
      </div>

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
      <FilterPanel
        open={showFilters}
        onOpenChange={setShowFilters}
        initial={savedFilters.find((f) => f.id === editingFilterId) ?? null}
        onSave={(filter) => {
          const isNew = !savedFilters.some((f) => f.id === filter.id);
          setSavedFilters((prev) => {
            const idx = prev.findIndex((f) => f.id === filter.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = filter;
              return next;
            }
            return [...prev, filter];
          });
          setEditingFilterId(filter.id);
          if (isNew) {
            // 새 필터 저장 시 현재 활성 탭에 자동 적용
            setSessionTabs((prev) =>
              prev.map((t) => (t.id === activeTabId ? { ...t, filterId: filter.id } : t)),
            );
          }
        }}
        onDelete={(id) => {
          setSavedFilters((prev) => prev.filter((f) => f.id !== id));
          // 이 필터를 참조하던 탭들은 default(pass-all)로 복귀
          setSessionTabs((prev) =>
            prev.map((t) => (t.filterId === id ? { ...t, filterId: 'default' } : t)),
          );
        }}
      />
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
