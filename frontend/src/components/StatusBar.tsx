interface StatusBarProps {
  sessionCount: number;
  isRunning: boolean;
}

export function StatusBar({ sessionCount, isRunning }: StatusBarProps) {
  return (
    <div className="flex items-center px-3 py-1 bg-[#181825] border-t border-[#313244] text-xs text-[#6c7086]">
      <span className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-[#a6e3a1]' : 'bg-[#6c7086]'}`} />
        {isRunning ? 'Listening on :8673' : 'Stopped'}
      </span>
      <span className="flex-1" />
      <span>{sessionCount} sessions</span>
    </div>
  );
}
