import type { GameState } from '../core/GameState';

/**
 * Heads-up display for the race. Supports split-screen via the `side` parameter
 * so each player gets their own HUD panel within their half of the screen.
 *
 *  - Lap counter (top corner of viewport)
 *  - Elapsed time (top of viewport, near the centre divider)
 *  - Speedometer (bottom of viewport, centred horizontally within the half)
 *  - Optional centre overlay on win: "Race Complete!" with final time
 */
export type HudSide = 'left' | 'right';

export class HUD {
  private readonly lapEl: HTMLDivElement;
  private readonly timerEl: HTMLDivElement;
  private readonly speedEl: HTMLDivElement;
  private static winOverlay: HTMLDivElement | null = null;

  constructor(private readonly side: HudSide = 'left', accentColor?: string) {
    const isLeft = side === 'left';
    const accent = accentColor ?? (isLeft ? '#ff8a8a' : '#8ab0ff');

    // Lap counter — top corner of the player's viewport
    this.lapEl = HUD.makePanel({
      top: '20px',
      ...(isLeft ? { left: '20px' } : { right: '20px' }),
      color: accent,
    });
    this.lapEl.textContent = `${isLeft ? 'P1' : 'P2'} · Lap 1 / 3`;
    document.body.appendChild(this.lapEl);

    // Elapsed time — top, near the centre divider on this player's side
    this.timerEl = HUD.makePanel({
      top: '20px',
      ...(isLeft ? { left: 'calc(50% - 130px)' } : { left: 'calc(50% + 20px)' }),
      color: '#ffffff',
    });
    this.timerEl.textContent = '00:00.00';
    document.body.appendChild(this.timerEl);

    // Speed — bottom, centred within the player's half
    this.speedEl = HUD.makePanel({
      bottom: '24px',
      left: isLeft ? '25%' : '75%',
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

  /** Update HUD text from current race state. */
  update(state: GameState, speedMs: number): void {
    const label = this.side === 'left' ? 'P1' : 'P2';
    this.lapEl.textContent = `${label} · Lap ${state.currentLap} / ${state.totalLaps}`;
    this.timerEl.textContent = HUD.formatTime(state.elapsed);
    const kmh = Math.abs(speedMs) * 3.6;
    this.speedEl.textContent = `${Math.round(kmh)} km/h`;
    if (state.finished) HUD.showWin(label, state.elapsed);
  }

  private static formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
  }

  /** Shared (single) win overlay — whichever player finishes first triggers it. */
  static showWin(winnerLabel: string, finalTime: number): void {
    if (HUD.winOverlay) return;
    HUD.winOverlay = document.createElement('div');
    HUD.winOverlay.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 12px;">${winnerLabel} Wins!</div>
      <div style="font-size: 26px; color: #ffd700;">${HUD.formatTime(finalTime)}</div>
    `;
    HUD.winOverlay.style.cssText = `
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
    document.body.appendChild(HUD.winOverlay);
  }
}
