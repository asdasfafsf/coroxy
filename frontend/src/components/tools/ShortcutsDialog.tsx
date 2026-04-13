import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { shortcut } from '@/lib/platform';

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutEntry {
  keys: string;
  description: string;
}

const sections: { title: string; entries: ShortcutEntry[] }[] = [
  {
    title: 'General',
    entries: [
      { keys: shortcut('E'), description: 'Start / Stop Capture' },
      { keys: shortcut(','), description: 'Settings' },
      { keys: shortcut('F'), description: 'Focus Search' },
      { keys: 'Esc', description: 'Close Dialog / Panel' },
    ],
  },
  {
    title: 'Sessions',
    entries: [
      { keys: shortcut('A'), description: 'Select All' },
      { keys: shortcut('C'), description: 'Copy URL' },
      { keys: shortcut('X', true), description: 'Clear All Sessions' },
      { keys: '\u2191 / \u2193', description: 'Navigate Sessions' },
    ],
  },
  {
    title: 'Tools',
    entries: [
      { keys: shortcut('N', true), description: 'Open Composer' },
      { keys: shortcut('R', true), description: 'Open Rules' },
      { keys: '?', description: 'Keyboard Shortcuts' },
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {sections.map((section, i) => (
            <div key={section.title}>
              {i > 0 && <Separator className="mb-4" />}
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">{section.title}</h3>
              <div className="space-y-1.5">
                {section.entries.map((entry) => (
                  <div key={entry.description} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{entry.description}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[11px] border border-border">
                      {entry.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
