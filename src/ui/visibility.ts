/** Never spend hidden-tab wall time in the simulation or keep rendering it. */
export function setupVisibility(
  loop: { runRenderLoop(callback: () => void): void; stopRenderLoop(callback: () => void): void },
  render: () => void, suspend: () => void, page: Document = document,
) {
  const sync = () => {
    suspend();
    if (page.hidden) loop.stopRenderLoop(render);
    else loop.runRenderLoop(render);
  };
  page.addEventListener('visibilitychange', sync);
  sync();
  return { dispose() {
    page.removeEventListener('visibilitychange', sync);
    loop.stopRenderLoop(render);
  } };
}
