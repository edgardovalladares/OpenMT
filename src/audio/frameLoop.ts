type FrameFn = (t: number) => void;
const subs = new Set<FrameFn>();
let raf = 0;

function tick(t: number) {
  subs.forEach((fn) => fn(t));
  raf = subs.size ? requestAnimationFrame(tick) : 0;
}

export function subscribeFrame(fn: FrameFn): () => void {
  subs.add(fn);
  if (!raf) raf = requestAnimationFrame(tick);
  return () => {
    subs.delete(fn);
  };
}
