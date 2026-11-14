// Inspect the renderer already owned by the mounted feature; no production hooks.
export async function mapRenderer(page) {
  await page.waitForFunction(() => {
    const node = document.querySelector(".f2-map");
    if (!node) return false;
    let fiber =
      node[Object.keys(node).find((key) => key.startsWith("__reactFiber"))];
    while (fiber) {
      let hook = fiber.memoizedState;
      while (hook) {
        if (hook.memoizedState?.nativeMap) {
          window.fmRenderer = hook.memoizedState;
          return true;
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    return false;
  });
}
