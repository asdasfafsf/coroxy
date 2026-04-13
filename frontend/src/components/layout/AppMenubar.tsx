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
}

export function AppMenubar({
  isRunning,
  sysProxy,
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
              <MenubarItem disabled>URL <MenubarShortcut>{shortcut('C')}</MenubarShortcut></MenubarItem>
              <MenubarItem disabled>Headers</MenubarItem>
              <MenubarItem disabled>cURL Command</MenubarItem>
              <MenubarItem disabled>Response Body</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarItem disabled>
            Find...
            <MenubarShortcut>{shortcut('F')}</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled>Select All <MenubarShortcut>{shortcut('A')}</MenubarShortcut></MenubarItem>
          <MenubarItem disabled>Delete Selected <MenubarShortcut>Del</MenubarShortcut></MenubarItem>
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
              <MenubarCheckboxItem disabled>Images</MenubarCheckboxItem>
              <MenubarCheckboxItem disabled>CSS</MenubarCheckboxItem>
              <MenubarCheckboxItem disabled>JavaScript</MenubarCheckboxItem>
              <MenubarCheckboxItem disabled>Fonts</MenubarCheckboxItem>
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
          <MenubarItem disabled>TextWizard...</MenubarItem>
          <MenubarItem disabled>Compare Sessions...</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Help */}
      <MenubarMenu>
        <MenubarTrigger className="text-xs font-medium px-2 py-0.5">Help</MenubarTrigger>
        <MenubarContent>
          <MenubarItem disabled>
            Keyboard Shortcuts
            <MenubarShortcut>?</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled>About Coroxy</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
