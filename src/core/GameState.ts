export class GameState {
  readonly totalCoins = 10;
  coinsCollected = 0;
  finished = false;

  get canFinish(): boolean {
    return this.coinsCollected >= this.totalCoins;
  }

  collect(): void {
    if (this.coinsCollected < this.totalCoins) {
      this.coinsCollected++;
    }
  }

  finish(): void {
    if (this.canFinish) {
      this.finished = true;
    }
  }
}