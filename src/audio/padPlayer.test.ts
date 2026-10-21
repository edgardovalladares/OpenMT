import { describe, it, expect, beforeEach } from 'vitest';
import { padPlayer, PAD_TONIC_NAMES } from './padPlayer';

describe('PadPlayer Engine', () => {
  beforeEach(() => {
    padPlayer.stop();
    padPlayer.setAutoKey(true);
    padPlayer.setTonic(0);
    padPlayer.setSoundType('essentials');
    padPlayer.setVolume(0.7);
  });

  it('has all 12 tonics mapped with names and relative minors', () => {
    for (let i = 0; i < 12; i++) {
      expect(PAD_TONIC_NAMES[i]).toBeDefined();
      expect(PAD_TONIC_NAMES[i].name).toBeTruthy();
      expect(PAD_TONIC_NAMES[i].relativeMinor).toBeTruthy();
    }
    expect(PAD_TONIC_NAMES[0].name).toBe('C');
    expect(PAD_TONIC_NAMES[0].relativeMinor).toBe('Am');
    expect(PAD_TONIC_NAMES[7].name).toBe('G');
    expect(PAD_TONIC_NAMES[7].relativeMinor).toBe('Em');
  });

  it('clamps volume between 0 and 1', () => {
    padPlayer.setVolume(-0.2);
    expect(padPlayer.config.volume).toBe(0);

    padPlayer.setVolume(1.5);
    expect(padPlayer.config.volume).toBe(1);

    padPlayer.setVolume(0.65);
    expect(padPlayer.config.volume).toBe(0.65);
  });

  it('switches sound types correctly', () => {
    padPlayer.setSoundType('omnisphere');
    expect(padPlayer.config.soundType).toBe('omnisphere');

    padPlayer.setSoundType('essentials');
    expect(padPlayer.config.soundType).toBe('essentials');
  });

  it('syncs from DAW keys with correct relative major resolution', () => {
    padPlayer.setAutoKey(true);

    // D Major -> Pad D (tonic 2)
    padPlayer.syncFromDawKey(2, 'major');
    expect(padPlayer.activeTonic).toBe(2);

    // B Minor -> Relative Major is D Major (11 + 3 = 14 % 12 = 2)
    padPlayer.syncFromDawKey(11, 'minor');
    expect(padPlayer.activeTonic).toBe(2);

    // A Minor -> Relative Major is C Major (9 + 3 = 12 % 12 = 0)
    padPlayer.syncFromDawKey(9, 'minor');
    expect(padPlayer.activeTonic).toBe(0);

    // E Minor -> Relative Major is G Major (4 + 3 = 7)
    padPlayer.syncFromDawKey(4, 'minor');
    expect(padPlayer.activeTonic).toBe(7);
  });

  it('disables autoKey when tonic is selected manually', () => {
    padPlayer.setAutoKey(true);
    padPlayer.setTonic(5, true); // F Major manual
    expect(padPlayer.config.autoKey).toBe(false);
    expect(padPlayer.activeTonic).toBe(5);

    // syncFromDawKey should not override manual selection if autoKey is false
    padPlayer.syncFromDawKey(0, 'major');
    expect(padPlayer.activeTonic).toBe(5);
  });
});
