import { create } from 'zustand';
import { engine, type TransportState } from '../audio/engine';
import { analyze } from '../audio/analysis/analyzerClient';
import { ANALYSIS_SR } from '../audio/peaks';
import { UNITY_POS } from '../audio/dbMath';
import type { KeyInfo } from '../audio/music';
import { selectRef } from './derived';

export const MAX_TRACKS = 8;
export type ThemeId = 'live-dark' | 'live-light' | 'live-neon';
export type MixerPosition = 'bottom' | 'left';

export interface TrackState {
  id: string; name: string; colorIndex: number;
  status: 'loading' | 'ready' | 'error'; error?: string;
  duration: number; peaks: Float32Array | null;
  volPos: number; pan: number; mute: boolean; solo: boolean; semitones: number;
  bpm: number | null; bpmConfidence: number;
  key: KeyInfo | null; keyConfidence: number;
  analysis: 'pending' | 'done' | 'error';
}

export interface DawState {
  tracks: TrackState[];
  refTrackId: string | null;
  theme: ThemeId;
  mixerPosition: MixerPosition;
  masterVolPos: number;
  tempoRatio: number;       // 0.5 – 2
  masterSemitones: number;  // -12 – +12
  masterCents: number;      // -50 – +50
  keyLock: boolean;
  transport: TransportState;

  addFiles(files: File[]): Promise<void>;
  removeTrack(id: string): void;
  setRef(id: string): void;
  setVol(id: string, v: number): void;
  setPan(id: string, v: number): void;
  toggleMute(id: string): void;
  toggleSolo(id: string): void;
  setTrackSemitones(id: string, v: number): void;
  setMasterVol(v: number): void;
  setTempoRatio(r: number): void;
  setBpm(bpm: number): void;
  correctBpm(factor: 0.5 | 2): void;
  setMasterSemitones(v: number): void;
  setMasterCents(v: number): void;
  setKeyOverride(k: KeyInfo | null): void;
  toggleKeyLock(): void;
  resetTempoPitch(): void;
  setTheme(t: ThemeId): void;
  setMixerPosition(p: MixerPosition): void;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const useDaw = create<DawState>()((set, get) => {
  const patch = (id: string, p: Partial<TrackState>) =>
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...p } : t)) }));

  return {
    tracks: [], refTrackId: null,
    theme: 'live-dark', mixerPosition: 'bottom',
    masterVolPos: UNITY_POS, tempoRatio: 1, masterSemitones: 0, masterCents: 0,
    keyLock: true, transport: 'stopped',

    async addFiles(files) {
      for (const file of files) {
        if (get().tracks.length >= MAX_TRACKS) break;
        const id = crypto.randomUUID();
        const used = new Set(get().tracks.map((t) => t.colorIndex));
        const colorIndex = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !used.has(i)) ?? 0;
        set((s) => ({
          refTrackId: s.refTrackId ?? id,
          tracks: [...s.tracks, {
            id, name: file.name.replace(/\.[^.]+$/, ''), colorIndex,
            status: 'loading', duration: 0, peaks: null,
            volPos: UNITY_POS, pan: 0, mute: false, solo: false, semitones: 0,
            bpm: null, bpmConfidence: 0, key: null, keyConfidence: 0, analysis: 'pending',
          }],
        }));
        try {
          const info = await engine.addTrack(id, file);
          patch(id, { status: 'ready', duration: info.duration, peaks: info.peaks });
          analyze(info.analysisInput, ANALYSIS_SR)
            .then((r) => patch(id, {
              analysis: 'done',
              bpm: r.bpm?.bpm ?? null, bpmConfidence: r.bpm?.confidence ?? 0,
              key: r.key ? { tonic: r.key.tonic, mode: r.key.mode } : null,
              keyConfidence: r.key?.confidence ?? 0,
            }))
            .catch(() => patch(id, { analysis: 'error' }));
        } catch (e) {
          patch(id, {
            status: 'error', analysis: 'error',
            error: e instanceof Error ? e.message : 'No se pudo decodificar el archivo',
          });
        }
      }
    },

    removeTrack(id) {
      engine.removeTrack(id);
      set((s) => {
        const tracks = s.tracks.filter((t) => t.id !== id);
        return { tracks, refTrackId: s.refTrackId === id ? (tracks[0]?.id ?? null) : s.refTrackId };
      });
    },
    setRef: (id) => set({ refTrackId: id }),
    setVol: (id, v) => patch(id, { volPos: clamp(v, 0, 1) }),
    setPan: (id, v) => patch(id, { pan: clamp(v, -1, 1) }),
    toggleMute: (id) => patch(id, { mute: !get().tracks.find((t) => t.id === id)?.mute }),
    toggleSolo: (id) => patch(id, { solo: !get().tracks.find((t) => t.id === id)?.solo }),
    setTrackSemitones: (id, v) => patch(id, { semitones: clamp(Math.round(v), -12, 12) }),
    setMasterVol: (v) => set({ masterVolPos: clamp(v, 0, 1) }),

    setTempoRatio: (r) => set({ tempoRatio: clamp(r, 0.5, 2) }),
    setBpm(bpm) {
      const ref = selectRef(get());
      if (ref?.bpm) set({ tempoRatio: clamp(bpm / ref.bpm, 0.5, 2) });
    },
    correctBpm(factor) {
      const ref = selectRef(get());
      if (ref?.bpm) patch(ref.id, { bpm: ref.bpm * factor });
    },
    setMasterSemitones: (v) => set({ masterSemitones: clamp(Math.round(v), -12, 12) }),
    setMasterCents: (v) => set({ masterCents: clamp(Math.round(v), -50, 50) }),
    setKeyOverride(k) {
      const ref = selectRef(get());
      if (ref) patch(ref.id, { key: k, keyConfidence: 1 });
    },
    toggleKeyLock: () => set((s) => ({ keyLock: !s.keyLock })),
    resetTempoPitch: () => set({ tempoRatio: 1, masterSemitones: 0, masterCents: 0 }),

    setTheme: (theme) => set({ theme }),
    setMixerPosition: (mixerPosition) => set({ mixerPosition }),
  };
});
