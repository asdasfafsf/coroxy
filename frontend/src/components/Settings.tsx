import { useState, useEffect } from 'react';
import { GetCAInfo, InstallCA, UninstallCA } from '../../wailsjs/go/app/App';
import { model } from '../../wailsjs/go/models';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const [caInfo, setCAInfo] = useState<model.CAInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    GetCAInfo().then(setCAInfo);
  }, []);

  const handleInstall = async () => {
    setLoading(true);
    setError('');
    try {
      await InstallCA();
      const info = await GetCAInfo();
      setCAInfo(info);
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
      const info = await GetCAInfo();
      setCAInfo(info);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1e1e2e] border border-[#313244] rounded-lg w-[500px] max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#313244]">
          <h2 className="text-sm font-semibold text-[#cdd6f4]">Settings</h2>
          <button
            className="text-[#6c7086] hover:text-[#cdd6f4] text-lg"
            onClick={onClose}
          >
            x
          </button>
        </div>

        <div className="p-4 space-y-4">
          <h3 className="text-xs font-semibold text-[#a6adc8]">Root CA Certificate</h3>

          {caInfo && (
            <div className="space-y-2 text-xs">
              <div className="flex">
                <span className="text-[#6c7086] w-24">Common Name</span>
                <span className="text-[#cdd6f4]">{caInfo.common_name}</span>
              </div>
              <div className="flex">
                <span className="text-[#6c7086] w-24">Fingerprint</span>
                <span className="text-[#cdd6f4] font-mono truncate">{caInfo.fingerprint?.slice(0, 32)}...</span>
              </div>
              <div className="flex">
                <span className="text-[#6c7086] w-24">Status</span>
                <span className={caInfo.installed ? 'text-[#a6e3a1]' : 'text-[#f9e2af]'}>
                  {caInfo.installed ? 'Installed' : 'Not installed'}
                </span>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-[#f38ba8]">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-xs rounded bg-[#a6e3a1] text-[#1e1e2e] hover:bg-[#94d68e] disabled:opacity-50"
              onClick={handleInstall}
              disabled={loading || (caInfo?.installed ?? false)}
            >
              Install CA
            </button>
            <button
              className="px-3 py-1.5 text-xs rounded bg-[#f38ba8] text-[#1e1e2e] hover:bg-[#e67a96] disabled:opacity-50"
              onClick={handleUninstall}
              disabled={loading || !(caInfo?.installed ?? false)}
            >
              Uninstall CA
            </button>
          </div>

          <p className="text-[10px] text-[#6c7086]">
            Installing the CA certificate enables HTTPS traffic inspection.
            A system password prompt will appear.
          </p>
        </div>
      </div>
    </div>
  );
}
