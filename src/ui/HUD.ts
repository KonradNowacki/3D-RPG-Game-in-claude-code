import type { GameState } from '../core/GameState';

/**
 * Heads-up display for the race:
 *   - Top-left: lap counter ("Lap 1 / 3")
 *   - Top-right: elapsed time ("01:23.45")
 *   - Bottom-center: speedometer ("128 km/h")
 *   - Center overlay (on win): "Race Complete!" with final time
 */
export class HUD {
  private readonly lapEl: HTMLDivElement;
  private readonly timerEl: HTMLDivElement;
  private readonly speedEl: HTMLDivElement;
  private winOverlay: HTMLDivElement | null = null;

  constructor() {
    this.lapEl = HUD.makePanel({
      top: '20px',
      left: '20px',
      color: '#ffd700',
    });
    this.lapEl.textContent = 'Lap 1 / 3';
    document.body.appendChild(this.lapEl);

    this.timerEl = HUD.makePanel({
      top: '20px',
      right: '20px',
      color: '#ffffff',
    });
    this.timerEl.textContent = '00:00.00';
    document.body.appendChild(this.timerEl);

    this.speedEl = HUD.makePanel({
      bottom: '24px',
      left: '50%',
      color: '#a8e0ff',
      transform: 'translateX(-50%)',
      fontSize: '22px',
    });
    this.speedEl.textContent = '0 km/h';
    document.body.appendChild(this.speedEl);
  }

  private static makePanel(style: {
    top?: string; bottom?: string; left?: string; right?: string;
    color: string; transform?: string; fontSize?: string;
  }): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      ${style.top ? `top: ${style.top};` : ''}
      ${style.bottom ? `bottom: ${style.bottom};` : ''}
      ${style.left ? `left: ${style.left};` : ''}
      ${style.right ? `right: ${style.right};` : ''}
      ${style.transform ? `transform: ${style.transform};` : ''}
      background: rgba(0, 0, 0, 0.65);
      color: ${style.color};
      padding: 10px 18px;
      border-radius: 8px;
      font-family: monospace;
      font-size: ${style.fontSize ?? '18px'};
      font-weight: bold;
      z-index: 100;
      letter-spacing: 0.04em;
      text-shadow: 0 1px 3px rgba(0,0,0,0.6);
    `;
    return el;
  }

  /**
   * Update HUD text from current race state.
   *
   * @param state  GameState for lap/timer info.
   * @param speedMs  Forward speed of the car in m/s (signed; HUD shows |v|).
   */
  update(state: GameState, speedMs: number): void {
    this.lapEl.textContent = `Lap ${state.currentLap} / ${state.totalLaps}`;
    this.timerEl.textContent = HUD.formatTime(state.elapsed);

    // m/s -> km/h
    const kmh = Math.abs(speedMs) * 3.6;
    this.speedEl.textContent = `${Math.round(kmh)} km/h`;

    if (state.finished) this.showWin(state.elapsed);
  }

  private static formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
  }

  showWin(finalTime: number): void {
    if (this.winOverlay) return;
    this.winOverlay = document.createElement('div');
    this.winOverlay.innerHTML = `
      <div style="font-size: 56px; margin-bottom: 12px;">Race Complete!</div>
      <div style="font-size: 28px; color: #ffd700;">${HUD.formatTime(finalTime)}</div>
    `;
    this.winOverlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.88);
      color: #ffffff;
      padding: 36px 64px;
      border-radius: 16px;
      font-family: monospace;
      font-weight: bold;
      z-index: 1000;
      text-align: center;
      border: 4px solid #ffd700;
    `;
    document.body.appendChild(this.winOverlay);
  }
}