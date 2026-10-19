/** Fullscreen the document so touch controls and HUD stay alongside the canvas. */
export function setupFullscreen(button: HTMLButtonElement, status: HTMLElement, page: Document = document) {
  let pending = false, disposed = false;
  const sync = () => {
    button.hidden = Boolean(page.fullscreenElement) || !page.fullscreenEnabled;
    button.disabled = pending;
  };
  const enter = async () => {
    if (pending || page.fullscreenElement) return;
    pending = true; sync();
    try { await page.documentElement.requestFullscreen(); }
    catch { if (!disposed) status.textContent = 'Цял екран не е достъпен. Опитай отново от бутона.'; }
    finally { pending = false; if (!disposed) sync(); }
  };
  button.addEventListener('click', enter);
  page.addEventListener('fullscreenchange', sync);
  sync();
  return { dispose() {
    disposed = true;
    button.removeEventListener('click', enter);
    page.removeEventListener('fullscreenchange', sync);
  } };
}
