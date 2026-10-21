import { describe, it, expect, beforeEach } from 'vitest';
import { metronome, type TimeSignature, type MetronomeSound } from './metronome';

describe('Metronome Engine', () => {
  beforeEach(() => {
    metronome.stop(false);
    metronome.setBpm(120);
    metronome.setTimeSignature('4/4');
    metronome.setSound('digital');
    metronome.setVolume(0.75);
    metronome.setSyncWithDaw(false);
  });

  it('calculates beatsPerBar correctly for all supported time signatures', () => {
    const signatures: Array<{ ts: TimeSignature; expected: number }> = [
      { ts: '2/4', expected: 2 },
      { ts: '3/4', expected: 3 },
      { ts: '4/4', expected: 4 },
      { ts: '5/4', expected: 5 },
      { ts: '6/8', expected: 6 },
      { ts: '7/8', expected: 7 },
    ];

    for (const { ts, expected } of signatures) {
      metronome.setTimeSignature(ts);
      expect(metronome.beatsPerBar).toBe(expected);
      expect(metronome.config.timeSignature).toBe(ts);
    }
  });

  it('clamps BPM between 30 and 300 and rounds to integers', () => {
    metronome.setBpm(15);
    expect(metronome.config.bpm).toBe(30);

    metronome.setBpm(500);
    expect(metronome.config.bpm).toBe(300);

    metronome.setBpm(124.6);
    expect(metronome.config.bpm).toBe(125);
  });

  it('clamps volume between 0.0 and 1.0', () => {
    metronome.setVolume(-0.5);
    expect(metronome.config.volume).toBe(0);

    metronome.setVolume(1.8);
    expect(metronome.config.volume).toBe(1);

    metronome.setVolume(0.42);
    expect(metronome.config.volume).toBe(0.42);
  });

  it('allows changing sounds and sync setting', () => {
    const sounds: MetronomeSound[] = ['digital', 'woodblock', 'cowbell', 'rimshot', 'mechanical'];
    for (const s of sounds) {
      metronome.setSound(s);
      expect(metronome.config.sound).toBe(s);
    }

    metronome.setSyncWithDaw(true);
    expect(metronome.config.syncWithDaw).toBe(true);
    metronome.setSyncWithDaw(false);
    expect(metronome.config.syncWithDaw).toBe(false);
  });

  it('notifies state change listeners', () => {
    let state = false;
    const unsub = metronome.onStateChange((running) => {
      state = running;
    });

    metronome.start(false);
    expect(state).toBe(true);
    expect(metronome.running).toBe(true);

    metronome.stop(false);
    expect(state).toBe(false);
    expect(metronome.running).toBe(false);

    unsub();
  });
});
