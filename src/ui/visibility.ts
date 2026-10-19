/** Never spend hidden-tab wall time in the simulation or keep rendering it. */
export function setupVisibility(
  loop: { runRenderLoop(callback: () => void): void; stopRenderLoop(callback: () => void): void },
  render: () => void, suspend: () => void, page: Document = document,
  resume: () => void = () => {}, host: EventTarget | null = page.defaultView,
) {
  let contextLost = false, pageAway = false;
  const sync = () => {
    suspend();
    loop.stopRenderLoop(render);
    if (!page.hidden && !contextLost && !pageAway) { resume(); loop.runRenderLoop(render); }
  };
  const hide = () => { pageAway = true; sync(); };
  const show = () => { pageAway = false; sync(); };
  page.addEventListener('visibilitychange', sync);
  host?.addEventListener('pagehide', hide);
  host?.addEventListener('pageshow', show);
  page.addEventListener('freeze', hide);
  page.addEventListener('resume', show);
  sync();
  return { setContextLost(lost: boolean) { contextLost = lost; sync(); }, dispose() {
    page.removeEventListener('visibilitychange', sync);
    host?.removeEventListener('pagehide', hide);
    host?.removeEventListener('pageshow', show);
    page.removeEventListener('freeze', hide);
    page.removeEventListener('resume', show);
    loop.stopRenderLoop(render);
  } };
}
