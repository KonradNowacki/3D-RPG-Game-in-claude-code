import type { GameState } from '../core/GameState';

export class HUD {
  private counterElement: HTMLDivElement;
  private messageElement: HTMLDivElement;
  private winOverlay: HTMLDivElement | null = null;

  constructor() {
    // Coin counter (bottom-right)
    this.counterElement = document.createElement('div');
    this.counterElement.id = 'hud-coin-counter';
    this.counterElement.textContent = 'Coins: 0 / 10';
    this.counterElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.7);
      color: #ffd700;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 18px;
      font-weight: bold;
      z-index: 100;
    `;
    document.body.appendChild(this.counterElement);

    // Finish message (bottom-center)
    this.messageElement = document.createElement('div');
    this.messageElement.id = 'hud-message';
    this.messageElement.textContent = 'All coins collected! Go to the finish!';
    this.messageElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      color: #00ff00;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 16px;
      font-weight: bold;
      z-index: 100;
      display: none;
    `;
    document.body.appendChild(this.messageElement);
  }

  update(gameState: GameState): void {
    this.counterElement.textContent = `Coins: ${gameState.coinsCollected} / ${gameState.totalCoins}`;

    if (gameState.canFinish) {
      this.messageElement.style.display = 'block';
    } else {
      this.messageElement.style.display = 'none';
    }
  }

  showWin(): void {
    if (!this.winOverlay) {
      this.winOverlay = document.createElement('div');
      this.winOverlay.textContent = 'You Win!';
      this.winOverlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: #00ff00;
        padding: 40px 80px;
        border-radius: 16px;
        font-family: monospace;
        font-size: 48px;
        font-weight: bold;
        z-index: 1000;
        text-align: center;
        border: 4px solid #00ff00;
      `;
      document.body.appendChild(this.winOverlay);
    }
  }
}
