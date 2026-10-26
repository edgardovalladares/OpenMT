export type PadSoundType = 'essentials' | 'omnisphere';

export interface PadConfig {
  soundType: PadSoundType;
  tonic: number; // 0 = C, 1 = C#, 2 = D ... 11 = B
  volume: number; // 0.0 to 1.0
  autoKey: boolean;
}

export const PAD_TONIC_NAMES: Record<number, { name: string; relativeMinor: string }> = {
  0: { name: 'C', relativeMinor: 'Am' },
  1: { name: 'C#', relativeMinor: 'A#m' },
  2: { name: 'D', relativeMinor: 'Bm' },
  3: { name: 'D#', relativeMinor: 'Cm' },
  4: { name: 'E', relativeMinor: 'C#m' },
  5: { name: 'F', relativeMinor: 'Dm' },
  6: { name: 'F#', relativeMinor: 'D#m' },
  7: { name: 'G', relativeMinor: 'Em' },
  8: { name: 'G#', relativeMinor: 'Fm' },
  9: { name: 'A', relativeMinor: 'F#m' },
  10: { name: 'A#', relativeMinor: 'Gm' },
  11: { name: 'B', relativeMinor: 'G#m' },
};

const ESSENTIALS_FILES: Record<number, string> = {
  0: 'Pad C.mp3',
  1: 'Pad C#.mp3',
  2: 'pad D.mp3',
  3: 'Pad D#.mp3',
  4: 'Pad E.mp3',
  5: 'Pad F.mp3',
  6: 'Pad F# .mp3',
  7: 'Pad G.mp3',
  8: 'Pad G#.mp3',
  9: 'Pad A.mp3',
  10: 'Pad A#.mp3',
  11: 'pad B.mp3',
};

const OMNISPHERE_FILES: Record<number, string> = {
  0: 'PAD OMNISPHERE C Y Am.mp3',
  1: 'PAD OMNISPHERE C# Y A#m.mp3',
  2: 'PAD OMNISPHERE D Y Bm.mp3',
  3: 'PAD OMNISPHERE D# Y Cm.mp3',
  4: 'PAD OMNISPHERE E Y C#m .mp3',
  5: 'PAD OMNISPHERE F Y Dm .mp3',
  6: 'PAD OMNISPHERE F# Y D#m .mp3',
  7: 'PAD OMNISPHERE G Y Em .mp3',
  8: 'PAD OMNISPHERE G# Y Fm.mp3',
  9: 'PAD OMNISPHERE A Y F#m .mp3',
  10: 'PAD OMNISPHERE A# Y Gm .mp3',
  11: 'PAD OMNISPHERE B Y G#m.mp3',
};

class PadPlayer {
  private soundType: PadSoundType = 'essentials';
  private tonic: number = 0; // Default C
  private volume: number = 0.7;
  private autoKey: boolean = true;
  private isPlaying: boolean = false;

  private currentAudio: HTMLAudioElement | null = null;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;

  private listeners = new Set<(playing: boolean) => void>();
  private configListeners = new Set<(cfg: PadConfig) => void>();

  constructor() {
    // Si estamos en entorno navegador, preparar precargas ligeras
  }

  get config(): PadConfig {
    return {
      soundType: this.soundType,
      tonic: this.tonic,
      volume: this.volume,
      autoKey: this.autoKey,
    };
  }

  get running(): boolean {
    return this.isPlaying;
  }

  get activeTonic(): number {
    return this.tonic;
  }

  get activeSoundType(): PadSoundType {
    return this.soundType;
  }

  private getAudioUrl(soundType: PadSoundType, tonic: number): string {
    const folder = soundType === 'omnisphere' ? 'OMNISPHERE' : 'ESSENTIALS';
    const filename = soundType === 'omnisphere' ? OMNISPHERE_FILES[tonic] : ESSENTIALS_FILES[tonic];
    return `/pads/${folder}/${encodeURIComponent(filename || 'Pad C.mp3')}`;
  }

  private notify() {
    for (const fn of this.listeners) {
      fn(this.isPlaying);
    }
    const cfg = this.config;
    for (const fn of this.configListeners) {
      fn(cfg);
    }
  }

  onStateChange(fn: (playing: boolean) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onConfigChange(fn: (cfg: PadConfig) => void) {
    this.configListeners.add(fn);
    return () => this.configListeners.delete(fn);
  }

  setVolume(vol: number) {
    const clamped = Math.min(Math.max(0, vol), 1);
    this.volume = clamped;
    if (this.currentAudio && !this.fadeInterval) {
      this.currentAudio.volume = clamped;
    }
    this.notify();
  }

  setAutoKey(enabled: boolean) {
    this.autoKey = enabled;
    this.notify();
  }

  setSoundType(type: PadSoundType) {
    if (this.soundType === type) return;
    this.soundType = type;
    if (this.isPlaying) {
      this.crossfadeTo(this.soundType, this.tonic);
    }
    this.notify();
  }

  setTonic(tonic: number, manual = false) {
    const normalized = ((tonic % 12) + 12) % 12;
    if (manual) {
      this.autoKey = false;
    }
    const changed = this.tonic !== normalized;
    this.tonic = normalized;

    if (this.isPlaying && changed) {
      this.crossfadeTo(this.soundType, this.tonic);
    }
    this.notify();
  }

  /**
   * Sincroniza automáticamente la tonalidad del Pad según la tonalidad del DAW.
   * Maneja tonalidades relativas: mayor = tónica directa; menor = tónica relativa mayor (tónica + 3).
   */
  syncFromDawKey(tonic: number, mode: 'major' | 'minor') {
    if (!this.autoKey) return;
    const targetTonic = mode === 'minor' ? (tonic + 3) % 12 : tonic % 12;
    if (this.tonic !== targetTonic) {
      this.tonic = targetTonic;
      if (this.isPlaying) {
        this.crossfadeTo(this.soundType, this.tonic);
      }
      this.notify();
    }
  }

  private crossfadeTo(soundType: PadSoundType, tonic: number) {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;

    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    const nextUrl = this.getAudioUrl(soundType, tonic);
    const nextAudio = new Audio(nextUrl);
    nextAudio.loop = true;
    nextAudio.preload = 'auto';

    const prevAudio = this.currentAudio;
    this.currentAudio = nextAudio;

    // Si no había pad sonando, comenzar directamente al volumen configurado
    if (!prevAudio) {
      nextAudio.volume = this.volume;
      const playPromise = nextAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Pad play() blocked or error:', err);
        });
      }
      return;
    }

    // Si ya había un pad sonando, realizar crossfade suave entre ambos
    nextAudio.volume = 0;
    const playPromise = nextAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Pad play() blocked or error:', err);
      });
    }

    const startVol = prevAudio.volume;
    const targetVol = this.volume;
    const steps = 25; // 25 pasos cada 40ms = 1s de transición fluida
    let step = 0;

    this.fadeInterval = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);

      if (prevAudio) {
        prevAudio.volume = Math.max(0, startVol * (1 - progress));
      }
      if (this.currentAudio === nextAudio) {
        this.currentAudio.volume = Math.min(1, targetVol * progress);
      }

      if (progress >= 1) {
        if (this.fadeInterval) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
        if (prevAudio) {
          prevAudio.pause();
          prevAudio.src = '';
        }
      }
    }, 40);
  }

  start() {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    this.isPlaying = true;
    this.crossfadeTo(this.soundType, this.tonic);
    this.notify();
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    const prevAudio = this.currentAudio;
    this.currentAudio = null;

    if (prevAudio) {
      const startVol = prevAudio.volume;
      const steps = 20;
      let step = 0;
      const fadeOutTimer = setInterval(() => {
        step++;
        const progress = Math.min(step / steps, 1);
        prevAudio.volume = Math.max(0, startVol * (1 - progress));
        if (progress >= 1) {
          clearInterval(fadeOutTimer);
          prevAudio.pause();
          prevAudio.src = '';
        }
      }, 40);
    }

    this.notify();
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
  }
}

export const padPlayer = new PadPlayer();
