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
}: AppMenubarProps) {
  return (
    <Menubar className="rounded-none border-b border-border border-t-0 border-x-0 px-2 h-8 bg-background">
      {/* File */}
      <MenubarMenu>
        <MenubarTrigger className="text-xs font-medium px-2 py-0.5">File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onToggleProxy}>
            {isRunning ? 'Stop Capture' : 'Start Capture'}
            <MenubarShortcut>{shortcut('E')}</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>Export</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem onClick={onExportHAR}>HAR (.har)</MenubarItem>
              <MenubarItem onClick={onExportJSON}>JSON (.json)</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSub>
            <MenubarSubTrigger>Import</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem onClick={onImportHAR}>HAR (.har)</MenubarItem>
              <MenubarItem onClick={onImportSAZ}>SAZ (.saz)</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem onClick={onSettingsClick}>
            Settings
            <MenubarShortcut>{shortcut(',')}</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Edit */}
      <MenubarMenu>
        <MenubarTrigger className="text-xs font-medium px-2 py-0.5">Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onClear}>
            Clear All Sessions
            <MenubarShortcut>{shortcut('X', true)}</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>Copy</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem disabled={!hasSelection} onClick={onCopyUrl}>URL <MenubarShortcut>{shortcut('C')}</MenubarShortcut></MenubarItem>
              <MenubarItem disabled={!hasSelection} onClick={onCopyRequestHeaders}>Request Headers</MenubarItem>
              <MenubarItem disabled={!hasSelection} onClick={onCopyResponseHeaders}>Response Headers</MenubarItem>
              <MenubarItem disabled={!hasSelection} onClick={onCopyCurl}>cURL Command</MenubarItem>
              <MenubarItem disabled={!hasSelection} onClick={onCopyResponseBody}>Response Body</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarItem disabled>
            Find...
            <MenubarShortcut>{shortcut('F')}</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>Mark</MenubarSubTrigger>
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
          <MenubarItem onClick={onSelectAll}>Select All <MenubarShortcut>{shortcut('A')}</MenubarShortcut></MenubarItem>
          <MenubarItem onClick={onDeleteSelected}>Delete Selected <MenubarShortcut>Del</MenubarShortcut></MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Rules */}
      <MenubarMenu>
        <MenubarTrigger className="text-xs font-medium px-2 py-0.5">Rules</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onRulesClick}>
            AutoResponder...
            <MenubarShortcut>{shortcut('R', true)}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem disabled>Breakpoints...</MenubarItem>
          <MenubarSeparator />
          <MenubarCheckboxItem checked={sysProxy} onClick={onToggleSysProxy}>
            System Proxy
          </MenubarCheckboxItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>Hide</MenubarSubTrigger>
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
          <MenubarItem disabled>Network Throttling...</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Tools */}
      <MenubarMenu>
        <MenubarTrigger className="text-xs font-medium px-2 py-0.5">Tools</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onComposerClick}>
            Composer
            <MenubarShortcut>{shortcut('N', true)}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={onTextWizardClick}>TextWizard...</MenubarItem>
          <MenubarItem disabled={selectedCount !== 2} onClick={onCompareClick}>Compare Sessions...</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Help */}
      <MenubarMenu>
        <MenubarTrigger className="text-xs font-medium px-2 py-0.5">Help</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onShortcutsClick}>
            Keyboard Shortcuts
            <MenubarShortcut>?</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onAboutClick}>About Coroxy</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
