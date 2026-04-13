interface StatusBarProps {
  sessionCount: number;
  isRunning: boolean;
}

export function StatusBar({ sessionCount, isRunning }: StatusBarProps) {
  return (
    <div className="flex items-center px-3 py-1 bg-card border-t border-border text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-status-success' : 'bg-muted-foreground'}`} />
        {isRunning ? 'Listening on :8673' : 'Stopped'}
      </span>
      <span className="flex-1" />
      <span>{sessionCount} sessions</span>
    </div>
  );
}
