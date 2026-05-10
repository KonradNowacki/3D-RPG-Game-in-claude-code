export class Input {
  private held = new Set<string>();

  constructor() {
    window.addEventListener('keydown', e => {
      this.held.add(e.key.toLowerCase());
      if ([' ', 'arrowup', 'arrowdown'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', e => this.held.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.held.clear());
  }

  isDown(key: string): boolean {
    return this.held.has(key.toLowerCase());
  }
}
