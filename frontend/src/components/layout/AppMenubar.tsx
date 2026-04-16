import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
  MenubarCheckboxItem,
} from '@/components/ui/menubar';
import { shortcut } from '@/lib/platform';
import { Play, Square, Save, FolderOpen, Download, Upload, Settings, Scissors, Clipboard, Search, Paintbrush, CheckSquare, Trash2, Shield, Pause, EyeOff, Gauge, Send, Wand2, GitCompare, Keyboard, Info } from 'lucide-react';

interface AppMenubarProps {
  isRunning: boolean;
  sysProxy: boolean;
  hasSelection: boolean;
  onToggleProxy: () => void;
  onToggleSysProxy: () => void;
  onClear: () => void;
  onExportHAR: () => void;
  onExportJSON: () => void;
  onImportHAR: () => void;
  onImportSAZ: () => void;
  onSettingsClick: () => void;
  onRulesClick: () => void;
  onComposerClick: () => void;
  onCopyUrl: () => void;
  onCopyRequestHeaders: () => void;
  onCopyResponseHeaders: () => void;
  onCopyCurl: () => void;
  onCopyResponseBody: () => void;
  onAboutClick: () => void;
  onShortcutsClick: () => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onTextWizardClick: () => void;
  onCompareClick: () => void;
  selectedCount: number;
  onMark: (color: string) => void;
  onUnmarkAll: () => void;
  hiddenTypes: Set<string>;
  onToggleHide: (type: string) => void;
  onSave: () => void;
  onLoad: () => void;
  throttlePreset: string;
  onThrottleChange: (preset: string) => void;
}

export function AppMenubar({
  isRunning,
  sysProxy,
  hasSelection,
  onToggleProxy,
  onToggleSysProxy,
  onClear,
  onExportHAR,
  onExportJSON,
  onImportHAR,
  onImportSAZ,
  onSettingsClick,
  onRulesClick,
  onComposerClick,
  onCopyUrl,
  onCopyRequestHeaders,
  onCopyResponseHeaders,
  onCopyCurl,
  onCopyResponseBody,
  onAboutClick,
  onShortcutsClick,
  onSelectAll,
  onDeleteSelected,
  onTextWizardClick,
  onCompareClick,
  selectedCount,
  onMark,
  onUnmarkAll,
  hiddenTypes,
  onToggleHide,
  onSave,
  onLoad,
  throttlePreset,
  onThrottleChange,
}: AppMenubarProps) {
  return (
    <Menubar className="rounded-none border-b border-border border-t-0 border-x-0 px-2 h-9 bg-sidebar shrink-0" style={{ '--wails-draggable': 'drag' } as React.CSSProperties}>
      {/* File */}
      <MenubarMenu>
        <MenubarTrigger className="text-xs font-medium px-2 py-0.5">File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onToggleProxy}>
            {isRunning ? <Square className="h-3.5 w-3.5 mr-2" /> : <Play className="h-3.5 w-3.5 mr-2" />}
            {isRunning ? 'Stop Capture' : 'Start Capture'}
            <MenubarShortcut>{shortcut('E')}</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onSave}>
            <Save className="h-3.5 w-3.5 mr-2" />
            Save Sessions
            <MenubarShortcut>{shortcut('S')}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={onLoad}>
            <FolderOpen className="h-3.5 w-3.5 mr-2" />
            Load Sessions...
            <MenubarShortcut>{shortcut('O')}</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger><Download className="h-3.5 w-3.5 mr-2" />Export</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem onClick={onExportHAR}>HAR (.har)</MenubarItem>
              <MenubarItem onClick={onExportJSON}>JSON (.json)</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSub>
            <MenubarSubTrigger><Upload className="h-3.5 w-3.5 mr-2" />Import</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem onClick={onImportHAR}>HAR (.har)</MenubarItem>
              <MenubarItem onClick={onImportSAZ}>SAZ (.saz)</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem onClick={onSettingsClick}>
            <Settings className="h-3.5 w-3.5 mr-2" />Settings
            <MenubarShortcut>{shortcut(',')}</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Edit */}
      <MenubarMenu>
        <MenubarTrigger className="text-xs font-medium px-2 py-0.5">Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onClear}>
            <Scissors className="h-3.5 w-3.5 mr-2" />Clear All Sessions
            <MenubarShortcut>{shortcut('X', true)}</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger><Clipboard className="h-3.5 w-3.5 mr-2" />Copy</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem disabled={!hasSelection} onClick={onCopyUrl}>URL <MenubarShortcut>{shortcut('C')}</MenubarShortcut></MenubarItem>
              <MenubarItem disabled={!hasSelection} onClick={onCopyRequestHeaders}>Request Headers</MenubarItem>
              <MenubarItem disabled={!hasSelection} onClick={onCopyResponseHeaders}>Response Headers</MenubarItem>
              <MenubarItem disabled={!hasSelection} onClick={onCopyCurl}>cURL Command</MenubarItem>
              <MenubarItem disabled={!hasSelection} onClick={onCopyResponseBody}>Response Body</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarItem disabled>
            <Search className="h-3.5 w-3.5 mr-2" />Find...
            <MenubarShortcut>{shortcut('F')}</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger><Paintbrush className="h-3.5 w-3.5 mr-2" />Mark</MenubarSubTrigger>
            <MenubarSubContent>
              {[
                { color: '#ef4444', label: 'Red' },
                { color: '#3b82f6', label: 'Blue' },
                { color: '#eab308', label: 'Yellow' },
                { color: '#22c55e', label: 'Green' },
                { color: '#a855f7', label: 'Purple' },
              ].map(({ color, label }) => (
                <MenubarItem key={label} disabled={!hasSelection} onClick={() => onMark(color)}>
                  <span className="w-3 h-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: color }} />
                  {label}
                </MenubarItem>
              ))}
              <MenubarSeparator />
              <MenubarItem onClick={onUnmarkAll}>Unmark All</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem onClick={onSelectAll}><CheckSquare className="h-3.5 w-3.5 mr-2" />Select All <MenubarShortcut>{shortcut('A')}</MenubarShortcut></MenubarItem>
          <MenubarItem onClick={onDeleteSelected}><Trash2 className="h-3.5 w-3.5 mr-2" />Delete Selected <MenubarShortcut>Del</MenubarShortcut></MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Rules */}
      <MenubarMenu>
        <MenubarTrigger className="text-xs font-medium px-2 py-0.5">Rules</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onRulesClick}>
            <Shield className="h-3.5 w-3.5 mr-2" />AutoResponder...
            <MenubarShortcut>{shortcut('R', true)}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem disabled><Pause className="h-3.5 w-3.5 mr-2" />Breakpoints...</MenubarItem>
          <MenubarSeparator />
          <MenubarCheckboxItem checked={sysProxy} onClick={onToggleSysProxy}>
            System Proxy
          </MenubarCheckboxItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger><EyeOff className="h-3.5 w-3.5 mr-2" />Hide</MenubarSubTrigger>
            <MenubarSubContent>
              {[
                { key: 'image', label: 'Images' },
                { key: 'css', label: 'CSS' },
                { key: 'javascript', label: 'JavaScript' },
                { key: 'font', label: 'Fonts' },
                { key: 'json', label: 'JSON' },
                { key: 'xml', label: 'XML' },
              ].map(({ key, label }) => (
                <MenubarCheckboxItem key={key} checked={hiddenTypes.has(key)} onClick={() => onToggleHide(key)}>
                  {label}
                </MenubarCheckboxItem>
              ))}
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSub>
            <MenubarSubTrigger><Gauge className="h-3.5 w-3.5 mr-2" />Network Throttling</MenubarSubTrigger>
            <MenubarSubContent>
              {[
                { key: 'off', label: 'No Throttling' },
                { key: '3g', label: '3G (750 kbps)' },
                { key: '4g', label: '4G (4 Mbps)' },
                { key: 'wifi', label: 'WiFi (30 Mbps)' },
              ].map(({ key, label }) => (
                <MenubarCheckboxItem key={key} checked={throttlePreset === key} onClick={() => onThrottleChange(key)}>
                  {label}
                </MenubarCheckboxItem>
              ))}
            </MenubarSubContent>
          </MenubarSub>
        </MenubarContent>
      </MenubarMenu>

      {/* Tools */}
      <MenubarMenu>
        <MenubarTrigger className="text-xs font-medium px-2 py-0.5">Tools</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onComposerClick}>
            <Send className="h-3.5 w-3.5 mr-2" />Composer
            <MenubarShortcut>{shortcut('N', true)}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={onTextWizardClick}><Wand2 className="h-3.5 w-3.5 mr-2" />TextWizard...</MenubarItem>
          <MenubarItem disabled={selectedCount !== 2} onClick={onCompareClick}><GitCompare className="h-3.5 w-3.5 mr-2" />Compare Sessions...</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Help */}
      <MenubarMenu>
        <MenubarTrigger className="text-xs font-medium px-2 py-0.5">Help</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onShortcutsClick}>
            <Keyboard className="h-3.5 w-3.5 mr-2" />Keyboard Shortcuts
            <MenubarShortcut>?</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onAboutClick}><Info className="h-3.5 w-3.5 mr-2" />About Coroxy</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
