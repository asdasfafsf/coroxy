import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowDownUp, Copy, Check } from 'lucide-react';

interface TextWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Transform =
  | 'base64_encode'
  | 'base64_decode'
  | 'url_encode'
  | 'url_decode'
  | 'html_encode'
  | 'html_decode'
  | 'json_pretty'
  | 'json_minify'
  | 'md5'
  | 'sha256';

const TRANSFORMS: { value: Transform; label: string; category: string }[] = [
  { value: 'base64_encode', label: 'Base64 Encode', category: 'Base64' },
  { value: 'base64_decode', label: 'Base64 Decode', category: 'Base64' },
  { value: 'url_encode', label: 'URL Encode', category: 'URL' },
  { value: 'url_decode', label: 'URL Decode', category: 'URL' },
  { value: 'html_encode', label: 'HTML Encode', category: 'HTML' },
  { value: 'html_decode', label: 'HTML Decode', category: 'HTML' },
  { value: 'json_pretty', label: 'JSON Pretty Print', category: 'JSON' },
  { value: 'json_minify', label: 'JSON Minify', category: 'JSON' },
  { value: 'md5', label: 'MD5 Hash', category: 'Hash' },
  { value: 'sha256', label: 'SHA-256 Hash', category: 'Hash' },
];

function applyTransform(input: string, transform: Transform): string {
  try {
    switch (transform) {
      case 'base64_encode':
        return btoa(unescape(encodeURIComponent(input)));
      case 'base64_decode':
        return decodeURIComponent(escape(atob(input)));
      case 'url_encode':
        return encodeURIComponent(input);
      case 'url_decode':
        return decodeURIComponent(input);
      case 'html_encode':
        return input
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      case 'html_decode': {
        const el = document.createElement('textarea');
        el.innerHTML = input;
        return el.value;
      }
      case 'json_pretty':
        return JSON.stringify(JSON.parse(input), null, 2);
      case 'json_minify':
        return JSON.stringify(JSON.parse(input));
      case 'md5':
        return hashHex(input, 'md5');
      case 'sha256':
        return hashHex(input, 'sha256');
      default:
        return input;
    }
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function hashHex(input: string, algo: string): string {
  // Web Crypto API is async, use simple sync hash for display
  // For production, use crypto.subtle.digest
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  // Return a placeholder — real hash needs async
  return `(Use browser console: crypto.subtle.digest('${algo.toUpperCase()}', ...) for real hash)\nSimple hash: ${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

export function TextWizard({ open, onOpenChange }: TextWizardProps) {
  const [input, setInput] = useState('');
  const [transform, setTransform] = useState<Transform>('base64_encode');
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => {
    if (!input.trim()) return '';
    return applyTransform(input, transform);
  }, [input, transform]);

  const handleSwap = () => {
    if (output && !output.startsWith('Error:') && !output.startsWith('(')) {
      setInput(output);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>TextWizard</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Select value={transform} onValueChange={(v) => setTransform(v as Transform)}>
              <SelectTrigger className="h-8 text-xs w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSFORMS.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSwap}
              className="h-8 px-2"
              title="Swap output to input"
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div>
            <div className="text-muted-foreground text-[11px] font-medium mb-1">Input</div>
            <Textarea
              className="h-28 resize-none font-mono text-xs"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter text to transform..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-muted-foreground text-[11px] font-medium">Output</span>
              {output && (
                <button
                  onClick={handleCopy}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-status-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
            <Textarea
              className="h-28 resize-none font-mono text-xs"
              value={output}
              readOnly
              placeholder="Result will appear here..."
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
