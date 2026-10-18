const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

/** Camera's horizontal basis: right=(30,46), up=(-46,30). */
export function direction(keys: ReadonlySet<string>) {
  const right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const up = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const length = Math.hypot(30, 46) * Math.max(1, Math.hypot(right, up));
  return { x: (30 * right - 46 * up) / length, z: (46 * right + 30 * up) / length };
}

export function setupKeyboard(onSuspend: () => void, host: Window = window, page: Document = document) {
  const keys = new Set<string>();
  const clear = () => { keys.clear(); onSuspend(); };
  const down = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) { clear(); return; }
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (!movementCodes.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  };
  const up = (event: KeyboardEvent) => { keys.delete(event.code); };
  host.addEventListener('keydown', down);
  host.addEventListener('keyup', up);
  host.addEventListener('blur', clear);
  page.addEventListener('visibilitychange', clear);
  page.addEventListener('focusin', clear);
  return {
    read: () => direction(keys),
    dispose() {
      clear();
      host.removeEventListener('keydown', down);
      host.removeEventListener('keyup', up);
      host.removeEventListener('blur', clear);
      page.removeEventListener('visibilitychange', clear);
      page.removeEventListener('focusin', clear);
    },
  };
}
