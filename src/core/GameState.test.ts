import { describe, it, expect } from 'vitest';
import { GameState } from './GameState';

describe('GameState', () => {
  it('starts with 0 coins collected', () => {
    const state = new GameState();
    expect(state.coinsCollected).toBe(0);
  });

  it('increments coin count on collect', () => {
    const state = new GameState();
    state.collect();
    expect(state.coinsCollected).toBe(1);
  });

  it('canFinish is false until 10 coins are collected', () => {
    const state = new GameState();
    for (let i = 0; i < 9; i++) {
      state.collect();
    }
    expect(state.canFinish).toBe(false);
    state.collect();
    expect(state.canFinish).toBe(true);
  });

  it('does not exceed 10 coins when collecting', () => {
    const state = new GameState();
    for (let i = 0; i < 15; i++) {
      state.collect();
    }
    expect(state.coinsCollected).toBe(10);
  });

  it('finish() only works when canFinish is true', () => {
    const state = new GameState();
    state.finish();
    expect(state.finished).toBe(false);

    for (let i = 0; i < 10; i++) {
      state.collect();
    }
    state.finish();
    expect(state.finished).toBe(true);
  });
});