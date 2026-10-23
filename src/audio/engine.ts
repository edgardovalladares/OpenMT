import { Track } from './track';
import { computePeaks, resampleForAnalysis } from './peaks';
import { dbToGain, posToDb } from './dbMath';
import type { MeterSource } from './levels';
import {
  isTauri,
  tauriLoadFile,
  tauriRemoveTrack,
  tauriUpdateTrackMix,
  tauriPlay,
  tauriPause,
  tauriStop,
  tauriSeek,
  tauriSetMasterVolume,
  tauriSetTempoRatio,
  tauriSwitchSong,
  tauriGetState,
} from './tauriBridge';

export type TransportState = 'stopped' | 'playing' | 'paused';
const LEAD = 0.08; // segundos de margen para arrancar todas las pistas en el mismo instante

class Engine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private limiter!: DynamicsCompressorNode;
  private masterMeter!: MeterSource;
  private tracks = new Map<string, Track>();
  private semis = new Map<string, number>();
  private trims = new Map<string, { trimStart: number; trimEnd: number; fadeIn: number; fadeOut: number }>();
  private listeners = new Set<(s: TransportState) => void>();
  private state: TransportState = 'stopped';
  private rate = 1;
  private anchorCtx = 0;
  private anchorPos = 0;
  private pausedPos = 0;
  private watch: number | undefined;

  // Estado y sincronización con Tauri 2 (Rust CPAL + Symphonia)
  private activeSongId = 'default';
  private tauriPosition = 0;
  private tauriDuration = 0;
  private tauriDurations = new Map<string, number>();

  constructor() {
    if (typeof window !== 'undefined' && isTauri()) {
      setInterval(async () => {
        if (this.state === 'playing') {
          try {
            const st = await tauriGetState(this.activeSongId);
            this.tauriPosition = st.position;
            if (st.duration > 0) this.tauriDuration = st.duration;
            if (st.duration > 0 && st.position >= st.duration - 0.05) {
              this.stop();
            }
          } catch {
            // ignore
          }
        }
      }, 30);
    }
  }

  setActiveSongId(id: string) {
    this.activeSongId = id;
    if (isTauri()) {
      void tauriSwitchSong(id);
    }
  }

  /** Crea el AudioContext (queda "suspended" hasta el primer gesto del usuario). */
  init(): AudioContext {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null as unknown as AudioContext;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: 'playback' });
    this.ctx = ctx;

    this.master = ctx.createGain();
    // Limitador de seguridad (compresor "brickwall" aproximado)
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.1;
    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    const split = ctx.createChannelSplitter(2);
    const l = ctx.createAnalyser(); const r = ctx.createAnalyser();
    l.fftSize = r.fftSize = 1024;
    this.limiter.connect(split);
    split.connect(l, 0); split.connect(r, 1);
    this.masterMeter = { l, r };

    const unlock = () => { void ctx.resume(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return ctx;
  }

  private audioBuffers = new Map<string, AudioBuffer>();
  private fileInfo = new Map<string, { name: string; size: number; type: string; lastModified: number }>();

  get context(): AudioContext | null { return this.ctx; }

  // ---------- pistas ----------
  async addTrack(
    id: string,
    file: File,
    activate: boolean | (() => boolean) = true,
  ) {
    // Si corre en Tauri 2 y tenemos ruta nativa de archivo: decodificación en Rust (Symphonia)
    const filePath = (file as unknown as { path?: string }).path;
    if (isTauri() && filePath) {
      try {
        const meta = await tauriLoadFile(this.activeSongId, id, filePath, file.name);
        this.fileInfo.set(id, {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        });
        this.tauriDurations.set(id, meta.duration);
        this.tauriDuration = Math.max(this.tauriDuration, meta.duration);
        const peaks = new Float32Array(meta.peaks);
        return { duration: meta.duration, peaks, analysisInput: new Float32Array(0) };
      } catch (err) {
        console.warn('Tauri decode fallback to WebAudio:', err);
      }
    }

    // Fallback estándar en Web Audio
    const ctx = this.init();
    const arrayBuf = await file.arrayBuffer();
    const buf = await ctx.decodeAudioData(arrayBuf);
    this.audioBuffers.set(id, buf);
    this.fileInfo.set(id, {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    });
    const peaks = computePeaks(buf);
    const analysisInput = await resampleForAnalysis(buf);

    const shouldActivate = typeof activate === 'function' ? activate() : activate;
    if (shouldActivate) {
      const track = new Track(ctx, id, buf.duration, this.master);
      await track.load(buf);
      this.tracks.set(id, track);
      if (this.state === 'playing') {
        const pos = this.position;
        if (pos < track.duration) {
          track.start(ctx.currentTime + LEAD, pos, this.rate, this.semis.get(id) ?? 0, this.trims.get(id));
        }
      }
    }
    return { duration: buf.duration, peaks, analysisInput };
  }

  async addTrackFromBuffer(
    id: string,
    buf: AudioBuffer,
    fileMeta: { name: string; size?: number; type?: string; lastModified?: number },
  ) {
    const ctx = this.init();
    this.audioBuffers.set(id, buf);
    this.fileInfo.set(id, {
      name: fileMeta.name,
      size: fileMeta.size ?? 0,
      type: fileMeta.type ?? 'audio/*',
      lastModified: fileMeta.lastModified ?? Date.now(),
    });
    const peaks = computePeaks(buf);
    const analysisInput = await resampleForAnalysis(buf);
    const track = new Track(ctx, id, buf.duration, this.master);
    await track.load(buf);
    this.tracks.set(id, track);
    if (this.state === 'playing') {
      const pos = this.position;
      if (pos < track.duration) track.start(ctx.currentTime + LEAD, pos, this.rate, this.semis.get(id) ?? 0, this.trims.get(id));
    }
    return { duration: buf.duration, peaks, analysisInput };
  }

  getAudioBuffer(id: string): AudioBuffer | undefined { return this.audioBuffers.get(id); }
  getFileMeta(id: string) { return this.fileInfo.get(id); }
  hasTrack(id: string): boolean { return this.tracks.has(id); }
  cloneTrackBuffer(fromId: string, toId: string) {
    const buf = this.audioBuffers.get(fromId);
    if (buf) this.audioBuffers.set(toId, buf);
    const meta = this.fileInfo.get(fromId);
    if (meta) this.fileInfo.set(toId, meta);
  }

  removeTrack(id: string) {
    if (isTauri()) {
      void tauriRemoveTrack(this.activeSongId, id);
      this.tauriDurations.delete(id);
    }
    this.tracks.get(id)?.dispose();
    this.tracks.delete(id);
    this.audioBuffers.delete(id);
    this.fileInfo.delete(id);
    this.semis.delete(id);
    this.trims.delete(id);
    if (this.tracks.size === 0) this.stop();
  }

  clear() {
    this.stop();
    this.tracks.forEach((t) => t.dispose());
    this.tracks.clear();
    this.audioBuffers.clear();
    this.fileInfo.clear();
    this.semis.clear();
    this.trims.clear();
    this.pausedPos = 0;
  }

  clearActiveTracks() {
    this.stop();
    this.tracks.forEach((t) => t.dispose());
    this.tracks.clear();
    this.pausedPos = 0;
  }

  async switchSongTracks(
    newTrackIds: { id: string; semitones: number; trimStart?: number; trimEnd?: number; fadeIn?: number; fadeOut?: number }[],
  ) {
    if (isTauri()) {
      this.stop();
      this.seek(0);
      await tauriSwitchSong(this.activeSongId);
      return;
    }

    this.stop();
    this.seek(0);
    const activeIds = new Set(newTrackIds.map((t) => t.id));
    for (const [id, track] of this.tracks.entries()) {
      if (!activeIds.has(id)) {
        track.dispose();
        this.tracks.delete(id);
      }
    }
    const ctx = this.init();
    for (const t of newTrackIds) {
      if (!this.tracks.has(t.id)) {
        const buf = this.audioBuffers.get(t.id);
        if (buf) {
          const track = new Track(ctx, t.id, buf.duration, this.master);
          await track.load(buf);
          this.tracks.set(t.id, track);
        }
      }
    }
  }

  meterSource(id: string): MeterSource | null { return this.tracks.get(id)?.meter ?? null; }
  masterMeterSource(): MeterSource | null { return this.ctx ? this.masterMeter : null; }

  // ---------- mezcla ----------
  applyMix(
    tracks: { id: string; volPos: number; pan: number; mute: boolean; solo: boolean }[],
    masterVolPos: number,
  ) {
    if (isTauri()) {
      const masterGain = dbToGain(posToDb(masterVolPos));
      void tauriSetMasterVolume(masterGain);
      const anySolo = tracks.some((x) => x.solo);
      for (const t of tracks) {
        const audible = !t.mute && (!anySolo || t.solo);
        const gain = audible ? dbToGain(posToDb(t.volPos)) : 0;
        void tauriUpdateTrackMix(this.activeSongId, t.id, {
          volume: gain,
          pan: t.pan,
          mute: t.mute,
          solo: t.solo,
        });
      }
      return;
    }

    if (!this.ctx) return;
    const anySolo = tracks.some((t) => t.solo);
    for (const t of tracks) {
      const tr = this.tracks.get(t.id);
      if (!tr) continue;
      const audible = !t.mute && (!anySolo || t.solo);
      tr.setGain(audible ? dbToGain(posToDb(t.volPos)) : 0);
      tr.setPan(t.pan);
    }
    this.master.gain.setTargetAtTime(dbToGain(posToDb(masterVolPos)), this.ctx.currentTime, 0.015);
  }

  // ---------- recortes y desvanecimientos ----------
  applyTrims(tracks: { id: string; trimStart: number; trimEnd: number; fadeIn: number; fadeOut: number }[]) {
    if (isTauri()) {
      for (const t of tracks) {
        void tauriUpdateTrackMix(this.activeSongId, t.id, {
          trimStart: t.trimStart,
          trimEnd: t.trimEnd,
          fadeIn: t.fadeIn,
          fadeOut: t.fadeOut,
        });
      }
      return;
    }

    for (const t of tracks) {
      this.trims.set(t.id, {
        trimStart: t.trimStart,
        trimEnd: t.trimEnd,
        fadeIn: t.fadeIn,
        fadeOut: t.fadeOut,
      });
      if (this.ctx && this.state === 'playing') {
        const tr = this.tracks.get(t.id);
        if (tr) {
          tr.applyClipEnvelope(this.ctx.currentTime, this.position, this.rate, this.trims.get(t.id));
        }
      }
    }
  }

  // ---------- tono / tempo ----------
  applyPitchTempo(rate: number, list: { id: string; semitones: number }[]) {
    const r = Math.min(2, Math.max(0.5, rate));

    if (isTauri()) {
      void tauriSetTempoRatio(r);
      for (const { id, semitones } of list) {
        void tauriUpdateTrackMix(this.activeSongId, id, { semitones });
      }
      return;
    }

    if (this.ctx && this.state === 'playing' && Math.abs(r - this.rate) > 1e-6) {
      this.anchorPos = this.position;
      this.anchorCtx = this.ctx.currentTime;
    }
    this.rate = r;
    for (const { id, semitones } of list) {
      this.semis.set(id, semitones);
      this.tracks.get(id)?.setPitchTempo(r, semitones);
    }
  }

  // ---------- transporte ----------
  get duration() {
    if (isTauri()) {
      let maxD = 0;
      this.tauriDurations.forEach((d) => { if (d > maxD) maxD = d; });
      return maxD > 0 ? maxD : this.tauriDuration;
    }
    let d = 0;
    this.tracks.forEach((t) => { if (t.duration > d) d = t.duration; });
    return d;
  }

  get position(): number {
    if (isTauri()) return this.tauriPosition;
    if (!this.ctx || this.state !== 'playing') return this.pausedPos;
    const p = this.anchorPos + Math.max(0, this.ctx.currentTime - this.anchorCtx) * this.rate;
    return Math.min(p, this.duration);
  }

  get transport() { return this.state; }

  onState(fn: (s: TransportState) => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private setState(s: TransportState) {
    this.state = s;
    this.listeners.forEach((fn) => fn(s));
  }

  private startAt(pos: number) {
    const ctx = this.init();
    const when = ctx.currentTime + LEAD;
    this.tracks.forEach((t, id) => {
      if (pos < t.duration) t.start(when, pos, this.rate, this.semis.get(id) ?? 0, this.trims.get(id));
    });
    this.anchorCtx = when;
    this.anchorPos = pos;
    this.setState('playing');
    clearInterval(this.watch);
    this.watch = setInterval(() => {
      if (this.state === 'playing' && this.position >= this.duration - 0.02) this.stop();
    }, 200) as unknown as number;
  }

  private halt() {
    clearInterval(this.watch);
    this.tracks.forEach((t) => t.stop());
  }

  async play() {
    if (isTauri()) {
      if (this.state === 'playing') return;
      await tauriPlay();
      this.setState('playing');
      return;
    }

    if (this.tracks.size === 0) return;
    const ctx = this.init();
    if (ctx.state !== 'running') await ctx.resume();
    if (this.state === 'playing') return;
    this.startAt(this.pausedPos >= this.duration - 0.02 ? 0 : this.pausedPos);
  }

  pause() {
    if (isTauri()) {
      if (this.state !== 'playing') return;
      void tauriPause();
      this.setState('paused');
      return;
    }

    if (this.state !== 'playing') return;
    this.pausedPos = this.position;
    this.halt();
    this.setState('paused');
  }

  stop() {
    if (isTauri()) {
      void tauriStop();
      this.tauriPosition = 0;
      this.setState('stopped');
      return;
    }

    this.halt();
    this.pausedPos = 0;
    this.setState('stopped');
  }

  toggle() { return this.state === 'playing' ? this.pause() : this.play(); }

  seek(sec: number) {
    if (isTauri()) {
      this.tauriPosition = Math.max(0, sec);
      void tauriSeek(this.tauriPosition);
      return;
    }

    const p = Math.min(Math.max(0, sec), this.duration);
    if (this.state === 'playing') { this.halt(); this.startAt(p); }
    else this.pausedPos = p;
  }
}

export const engine = new Engine();
