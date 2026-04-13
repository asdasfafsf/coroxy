import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Globe } from 'lucide-react';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-center text-lg">Coroxy</DialogTitle>
        </DialogHeader>

        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
              <Globe className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-foreground font-medium">Network Debugging Proxy</p>
            <p className="text-xs text-muted-foreground">HTTP/HTTPS (MITM) + TCP (SOCKS5) + UDP</p>
          </div>

          <Separator />

          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between px-4">
              <span>Version</span>
              <span className="text-foreground font-mono">0.1.0-dev</span>
            </div>
            <div className="flex justify-between px-4">
              <span>Framework</span>
              <span className="text-foreground font-mono">Go + Wails v2</span>
            </div>
            <div className="flex justify-between px-4">
              <span>Frontend</span>
              <span className="text-foreground font-mono">React + shadcn/ui</span>
            </div>
          </div>

          <Separator />

          <div className="text-xs text-muted-foreground">
            <a
              href="https://github.com/asdasfafsf/coroxy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              github.com/asdasfafsf/coroxy
            </a>
          </div>

          <p className="text-[10px] text-muted-foreground">MIT License</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
