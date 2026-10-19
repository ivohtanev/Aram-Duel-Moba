type OrientationControl = {
  lock?: (orientation: 'landscape') => Promise<void>;
  unlock?: () => void;
};

const EXPAND = 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5';
const SHRINK = 'M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5';

/** Fullscreen the document so touch controls and HUD stay alongside the canvas.
 * Unlocking on every exit restores the device's pre-fullscreen automatic orientation.
 * No game/camera state is reset; normal resize handling restores the projection.
 */
export function setupFullscreen(button: HTMLButtonElement, status: HTMLElement, page: Document = document) {
  let pending = false, disposed = false, ownsOrientation = false;
  let session = 0;
  const host = page.defaultView;
  const orientation = host?.screen.orientation as OrientationControl | undefined;
  const mobile = () => Boolean(host?.matchMedia('(any-pointer: coarse)').matches);
  const unlock = () => {
    if (!ownsOrientation) return;
    ownsOrientation = false;
    try { orientation?.unlock?.(); } catch { /* Unsupported browsers need no cleanup. */ }
  };
  const sync = () => {
    const active = Boolean(page.fullscreenElement);
    if (!active) { session++; unlock(); }
    button.hidden = !active && !page.fullscreenEnabled;
    button.disabled = pending;
    const label = active ? 'Изход от цял екран' : 'Цял екран';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', String(active));
    button.querySelector('[data-fullscreen-icon]')?.setAttribute('d', active ? SHRINK : EXPAND);
  };
  const toggle = async () => {
    if (pending) return;
    pending = true; sync();
    const exiting = Boolean(page.fullscreenElement);
    const token = ++session;
    try {
      if (exiting) await page.exitFullscreen();
      else {
        await page.documentElement.requestFullscreen();
        if (!disposed && page.fullscreenElement && token === session && mobile()) {
          if (orientation?.lock) {
            ownsOrientation = true;
            try { await orientation.lock('landscape'); }
            catch { if (!disposed && page.fullscreenElement) status.textContent = 'Завърти устройството хоризонтално.'; }
            // Escape/system Back may exit while the lock request is still pending.
            if (disposed || !page.fullscreenElement || token !== session) {
              ownsOrientation = true; unlock();
            }
          } else status.textContent = 'Завърти устройството хоризонтално.';
        }
      }
    } catch {
      if (!disposed) status.textContent = exiting
        ? 'Изходът от цял екран не е достъпен. Опитай отново.'
        : 'Цял екран не е достъпен. Опитай отново от бутона.';
    } finally { pending = false; if (!disposed) sync(); }
  };
  button.addEventListener('click', toggle);
  page.addEventListener('fullscreenchange', sync);
  sync();
  return { dispose() {
    disposed = true; session++; unlock();
    button.removeEventListener('click', toggle);
    page.removeEventListener('fullscreenchange', sync);
  } };
}
