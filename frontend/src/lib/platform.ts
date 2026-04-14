const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

/** Returns the platform modifier key symbol for display */
export const modKey = isMac ? '\u2318' : 'Ctrl';

/** Returns the platform shift symbol for display */
export const shiftKey = isMac ? '\u21E7' : 'Shift';

/** Shortcut display string, e.g. "Cmd+S" on Mac, "Ctrl+S" on Windows */
export function shortcut(key: string, shift = false): string {
  const parts = [];
  parts.push(modKey);
  if (shift) parts.push(shiftKey);
  parts.push(key);
  return parts.join(isMac ? '' : '+');
}

/** Check if the platform modifier (Cmd on Mac, Ctrl on Windows) is pressed */
export function isModKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}

export { isMac };
