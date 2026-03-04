/**
 * Shared helpers for TVRoboPhetta
 */

/** Attach a window resize handler that keeps renderer + camera in sync */
export function setupResizeHandler(renderer, camera) {
  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  onResize();
}
