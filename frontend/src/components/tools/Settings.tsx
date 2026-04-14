import { useState, useEffect } from 'react';
import { CAInfo, InstallCA, UninstallCA } from '../../../wailsjs/go/app/App';
import { model } from '../../../wailsjs/go/models';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Settings({ open, onOpenChange }: SettingsProps) {
  const [caInfo, setCAInfo] = useState<model.CAInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) CAInfo().then(setCAInfo);
  }, [open]);

  const handleInstall = async () => {
    setLoading(true);
    setError('');
    try {
      await InstallCA();
      setCAInfo(await CAInfo());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUninstall = async () => {
    setLoading(true);
    setError('');
    try {
      await UninstallCA();
      setCAInfo(await CAInfo());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground">Root CA Certificate</h3>

          {caInfo && (
            <div className="space-y-2 text-xs">
              <div className="flex">
                <span className="text-muted-foreground w-24">Common Name</span>
                <span className="text-foreground">{caInfo.common_name}</span>
              </div>
              <div className="flex">
                <span className="text-muted-foreground w-24">Fingerprint</span>
                <span className="text-foreground font-mono truncate">{caInfo.fingerprint?.slice(0, 32)}...</span>
              </div>
              <div className="flex">
                <span className="text-muted-foreground w-24">Status</span>
                <span className={caInfo.installed ? 'text-status-success' : 'text-status-warning'}>
                  {caInfo.installed ? 'Installed' : 'Not installed'}
                </span>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleInstall}
              disabled={loading || (caInfo?.installed ?? false)}
            >
              Install CA
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleUninstall}
              disabled={loading || !(caInfo?.installed ?? false)}
            >
              Uninstall CA
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Installing the CA certificate enables HTTPS traffic inspection.
            A system password prompt will appear.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
