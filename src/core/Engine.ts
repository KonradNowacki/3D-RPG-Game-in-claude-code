export class Engine {
  private rafId = 0;
  private lastTime = 0;

  constructor(private readonly tick: (dt: number) => void) {}

  start() {
    const loop = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      this.tick(dt);
      this.rafId = requestAnimationFrame(loop);
    };
    // First frame: seed lastTime then enter loop
    this.rafId = requestAnimationFrame((now) => {
      this.lastTime = now;
      this.rafId = requestAnimationFrame(loop);
    });
  }

  stop() {
    cancelAnimationFrame(this.rafId);
  }
}
