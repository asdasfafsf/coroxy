import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { FilterPanel } from '@/components/tools/FilterPanel';
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
import { evaluate, loadSavedFilters, saveSavedFilters, type SavedFilter } from '@/lib/filter';

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
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => loadSavedFilters());
  const [showFilters, setShowFilters] = useState(false);
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null);
  useEffect(() => {
    saveSavedFilters(savedFilters);
  }, [savedFilters]);
  const [diffSessionA, setDiffSessionA] = useState<model.Session | null>(null);
  const [diffSessionB, setDiffSessionB] = useState<model.Session | null>(null);
  const [sysProxy, setSysProxy] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTextWizard, setShowTextWizard] = useState(false);
  const [marks, setMarks] = useState<Map<string, string>>(new Map());
  const [throttlePreset, setThrottlePreset] = useState('off');

  // ===== Sidebar width (manual drag resize) =====
  const SIDEBAR_MIN = 160;
  const SIDEBAR_MAX = 400;
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('coroxy-sidebar-width');
      const n = stored ? parseInt(stored, 10) : 200;
      return Number.isFinite(n) ? Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, n)) : 200;
    } catch {
      return 200;
    }
  });
  const sidebarResizing = useRef(false);
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
        localStorage.setItem('coroxy-sidebar-width', String(sidebarWidth));
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
    Promise.resolve()
      .then(() => IsSystemProxyActive())
      .then(setSysProxy)
      .catch(() => {});
    Promise.resolve()
      .then(() => ThrottleState())
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
      Promise.resolve()
        .then(() => ProxyState())
        .then(setProxyState)
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const isRunning = proxyState === 'running';

  const activeFilter = useMemo<SavedFilter | null>(() => {
    const tab = sessionTabs.find((t) => t.id === activeTabId);
    if (!tab || !tab.filterId || tab.filterId === 'default') return null;
    return savedFilters.find((f) => f.id === tab.filterId) ?? null;
  }, [sessionTabs, activeTabId, savedFilters]);

  const filteredSessions = useMemo(() => {
    if (!activeFilter) return sessions;
    return sessions.filter((s) => evaluate(activeFilter, s));
  }, [sessions, activeFilter]);

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
      <div className="mac-app-shell h-screen p-3 text-foreground font-sans">
        <div className="coroxy-window flex h-full min-h-0 overflow-hidden">
          {/* ===== Left sidebar — session groups (draggable width) ===== */}
          <div
            className="mac-sidebar relative shrink-0 flex flex-col overflow-hidden border-r border-sidebar-border"
            style={{ width: sidebarWidth }}
          >
            {/* native macOS traffic lights 영역 확보 + 창 드래그 */}
            <div
              className="mac-titlebar h-7 shrink-0"
              style={{ ['WebkitAppRegion' as never]: 'drag' }}
            >
              <div className="sidebar-wordmark">
                <span className="sidebar-wordmark-mark">C</span>
                <span>Coroxy</span>
              </div>
            </div>
            <SessionSidebar
              groups={sessionTabs.map((t) => {
                const fid = t.filterId && t.filterId !== 'default' ? t.filterId : null;
                const f = fid ? savedFilters.find((sf) => sf.id === fid) : null;
                return {
                  id: t.id,
                  label: t.label,
                  count: t.id === activeTabId ? filteredSessions.length : 0,
                  filterName: f?.name ?? null,
                };
              })}
              activeGroupId={activeTabId}
              onGroupChange={setActiveTabId}
              onGroupAdd={handleTabAdd}
            />
            {/* Drag handle — overlaps right edge border, subtle default + primary on hover */}
            <div
              onMouseDown={handleSidebarResizeStart}
              className="absolute -right-1.5 top-10 bottom-7 w-3 cursor-col-resize bg-transparent transition-colors z-10 after:absolute after:inset-y-3 after:left-1/2 after:w-px after:-translate-x-1/2 after:rounded-full after:bg-transparent hover:after:bg-primary/45 active:after:bg-primary/70"
              role="separator"
              aria-orientation="vertical"
            />
          </div>

          {/* ===== Right main column ===== */}
          <div className="mac-main-column flex flex-col flex-1 min-w-0 overflow-hidden">
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
              onFiltersClick={() => {
                setEditingFilterId(null);
                setShowFilters(true);
              }}
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
            />
            {/* Toolbar */}
            <Toolbar
              onSessionsClear={handleSessionsClear}
              savedFilters={savedFilters}
              activeFilterId={activeFilter?.id ?? null}
              onSelectFilter={(fid) => {
                setSessionTabs((prev) =>
                  prev.map((t) =>
                    t.id === activeTabId ? { ...t, filterId: fid ?? 'default' } : t,
                  ),
                );
              }}
              onNewFilter={() => {
                setEditingFilterId(null);
                setShowFilters(true);
              }}
              onEditActiveFilter={() => {
                setEditingFilterId(activeFilter?.id ?? null);
                setShowFilters(true);
              }}
            />
            <ResizablePanelGroup orientation="vertical" className="main-workspace flex-1">
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
              <ResizableHandle
                withHandle
                className="bg-transparent hover:bg-transparent active:bg-transparent data-[panel-resize-handle-active]:bg-transparent"
              />
              <ResizablePanel defaultSize={55} minSize={20}>
                <div className="h-full overflow-hidden">
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
              totalRequestBytes={sessions.reduce((sum, s) => sum + (s.request?.body_size || 0), 0)}
              totalResponseBytes={sessions.reduce(
                (sum, s) => sum + (s.response?.body_size || 0),
                0,
              )}
            />
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
