import { engine } from './engine';

export type TimeSignature = '4/4' | '3/4' | '2/4' | '6/8' | '5/4' | '7/8';
export type MetronomeSound = 'digital' | 'woodblock' | 'cowbell' | 'rimshot' | 'mechanical';

export interface MetronomeConfig {
  bpm: number;
  timeSignature: TimeSignature;
  sound: MetronomeSound;
  volume: number;
  syncWithDaw: boolean;
}

class Metronome {
  private isRunning = false;
  private isArmed = false;
  private bpm = 120;
  private timeSignature: TimeSignature = '4/4';
  private sound: MetronomeSound = 'digital';
  private volume = 0.75;
  private syncWithDaw = false;

  private currentBeat = 0;
  private nextNoteTime = 0.0;
  private timerWorker: ReturnType<typeof setInterval> | null = null;
  private lookahead = 25.0; // ms
  private scheduleAheadTime = 0.1; // segundos

  private listeners = new Set<(beat: number, totalBeats: number, isAccent: boolean) => void>();
  private stateListeners = new Set<(running: boolean) => void>();

  constructor() {
    // Sincronizar con el transporte del DAW SOLO si el metrónomo está armado por el usuario
    engine.onState((transport) => {
      if (this.syncWithDaw && this.isArmed) {
        if (transport === 'playing') {
          this.start(true);
        } else if (transport === 'stopped' || transport === 'paused') {
          if (this.isRunning) {
            this.stop(false);
          }
        }
      }
    });
  }

  get beatsPerBar(): number {
    switch (this.timeSignature) {
      case '2/4': return 2;
      case '3/4': return 3;
      case '4/4': return 4;
      case '5/4': return 5;
      case '6/8': return 6;
      case '7/8': return 7;
      default: return 4;
    }
  }

  get config(): MetronomeConfig {
    return {
      bpm: this.bpm,
      timeSignature: this.timeSignature,
      sound: this.sound,
      volume: this.volume,
      syncWithDaw: this.syncWithDaw,
    };
  }

  get running(): boolean {
    return this.isRunning;
  }

  setBpm(newBpm: number) {
    this.bpm = Math.min(Math.max(30, Math.round(newBpm)), 300);
  }

  setTimeSignature(ts: TimeSignature) {
    this.timeSignature = ts;
    this.currentBeat = 0;
  }

  setSound(sound: MetronomeSound) {
    this.sound = sound;
  }

  setVolume(vol: number) {
    this.volume = Math.min(Math.max(0, vol), 1);
  }

  setSyncWithDaw(sync: boolean) {
    this.syncWithDaw = sync;
  }

  onBeat(fn: (beat: number, totalBeats: number, isAccent: boolean) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  onStateChange(fn: (running: boolean) => void) {
    this.stateListeners.add(fn);
    return () => {
      this.stateListeners.delete(fn);
    };
  }

  private notifyState(running: boolean) {
    for (const fn of this.stateListeners) {
      fn(running);
    }
  }

  private getAudioContext(): AudioContext | null {
    try {
      return engine.init();
    } catch {
      return null;
    }
  }

  private nextNote() {
    const isEighthBased = this.timeSignature === '6/8' || this.timeSignature === '7/8';
    // Para 6/8 o 7/8 el pulso es corchea
    const secondsPerBeat = (60.0 / this.bpm) * (isEighthBased ? 0.5 : 1.0);
    this.nextNoteTime += secondsPerBeat;
    this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
  }

  private isAccentBeat(beat: number): boolean {
    if (beat === 0) return true;
    if (this.timeSignature === '6/8' && beat === 3) return true;
    if (this.timeSignature === '7/8' && (beat === 2 || beat === 4)) return true;
    return false;
  }

  private scheduleNote(beatNumber: number, time: number) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const isAccent = this.isAccentBeat(beatNumber);

    // Notificar a la UI en el momento del pulso
    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
    setTimeout(() => {
      if (this.isRunning) {
        for (const fn of this.listeners) {
          fn(beatNumber, this.beatsPerBar, isAccent);
        }
      }
    }, delayMs);

    // Sintetizar el sonido exacto según el tipo seleccionado
    this.synthesizeClick(ctx, time, isAccent);
  }

  private synthesizeClick(ctx: AudioContext, time: number, isAccent: boolean) {
    const masterGain = ctx.createGain();
    const finalVol = this.volume * (isAccent ? 1.0 : 0.7);
    masterGain.gain.setValueAtTime(finalVol, time);
    masterGain.connect(ctx.destination);

    switch (this.sound) {
      case 'digital': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isAccent ? 1600 : 900, time);
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + (isAccent ? 0.05 : 0.035));
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(time);
        osc.stop(time + 0.06);
        break;
      }

      case 'woodblock': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const startFreq = isAccent ? 1600 : 1000;
        const endFreq = isAccent ? 1100 : 700;
        osc.frequency.setValueAtTime(startFreq, time);
        osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.025);
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(time);
        osc.stop(time + 0.05);
        break;
      }

      case 'cowbell': {
        // Sonido estilo 808 Cowbell (dos osciladores afinados en 587Hz y 845Hz)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const bandpass = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc1.type = 'square';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(isAccent ? 620 : 540, time);
        osc2.frequency.setValueAtTime(isAccent ? 890 : 800, time);

        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(800, time);
        bandpass.Q.setValueAtTime(2.5, time);

        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

        osc1.connect(bandpass);
        osc2.connect(bandpass);
        bandpass.connect(gain);
        gain.connect(masterGain);

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + 0.08);
        osc2.stop(time + 0.08);
        break;
      }

      case 'rimshot': {
        // Golpe de baqueta / aro
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isAccent ? 520 : 380, time);
        oscGain.gain.setValueAtTime(0.9, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
        osc.connect(oscGain);
        oscGain.connect(masterGain);
        osc.start(time);
        osc.stop(time + 0.04);

        // Burst de ruido para el chasquido del aro
        const bufferSize = Math.floor(ctx.sampleRate * 0.02);
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2200, time);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
        whiteNoise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(masterGain);
        whiteNoise.start(time);
        whiteNoise.stop(time + 0.03);
        break;
      }

      case 'mechanical': {
        // Metrónomo mecánico tradicional (caja de madera con resonancia)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isAccent ? 750 : 500, time);
        osc.frequency.exponentialRampToValueAtTime(isAccent ? 350 : 250, time + 0.02);
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(time);
        osc.stop(time + 0.04);
        break;
      }
    }
  }

  private scheduler() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    while (this.nextNoteTime < ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentBeat, this.nextNoteTime);
      this.nextNote();
    }
  }

  start(fromDawSync = false) {
    if (this.isRunning && !fromDawSync) return;
    if (!fromDawSync) {
      this.isArmed = true;
    }
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
    this.isRunning = true;
    this.currentBeat = 0;
    this.nextNoteTime = (ctx ? ctx.currentTime : 0) + 0.02;
    this.notifyState(true);

    if (this.timerWorker) clearInterval(this.timerWorker);
    this.timerWorker = setInterval(() => this.scheduler(), this.lookahead);
  }

  stop(manual = true) {
    if (manual) {
      this.isArmed = false;
    }
    this.isRunning = false;
    if (this.timerWorker) {
      clearInterval(this.timerWorker);
      this.timerWorker = null;
    }
    this.notifyState(false);
    this.currentBeat = 0;
    if (manual) {
      for (const fn of this.listeners) {
        fn(-1, this.beatsPerBar, false);
      }
    }
  }

  toggle() {
    if (this.isRunning) {
      this.stop(true);
    } else {
      this.start(false);
    }
  }
}

export const metronome = new Metronome();
