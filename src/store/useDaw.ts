import { create } from 'zustand';
import { engine, type TransportState } from '../audio/engine';
import { analyze } from '../audio/analysis/analyzerClient';
import { ANALYSIS_SR } from '../audio/peaks';
import { UNITY_POS } from '../audio/dbMath';
import type { KeyInfo } from '../audio/music';
import type { DawProject, ProjectTrackData, SongSection } from '../types/project';
import { selectRef } from './derived';

export const MAX_TRACKS = 20;
export type ThemeId = 'live-dark' | 'live-light' | 'live-neon';
export type MixerPosition = 'bottom' | 'left';

export interface TrackState {
  id: string;
  name: string;
  colorIndex: number;
  status: 'loading' | 'ready' | 'error' | 'missing';
  error?: string;
  duration: number;
  peaks: Float32Array | null;
  volPos: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  semitones: number;
  bpm: number | null;
  bpmConfidence: number;
  key: KeyInfo | null;
  keyConfidence: number;
  analysis: 'pending' | 'done' | 'error';
  trimStart: number;
  trimEnd: number;
  fadeIn: number;
  fadeOut: number;
  pitchLocked?: boolean;
  fileMeta?: {
    name: string;
    size?: number;
    type?: string;
    lastModified?: number;
  };
}

export interface HistorySnapshot {
  tracks: {
    id: string;
    volPos: number;
    pan: number;
    mute: boolean;
    solo: boolean;
    semitones: number;
    trimStart: number;
    trimEnd: number;
    fadeIn: number;
    fadeOut: number;
    pitchLocked?: boolean;
  }[];
  masterVolPos: number;
  tempoRatio: number;
  masterSemitones: number;
  masterCents: number;
  sections: SongSection[];
}

export interface DawState {
  projectId: string;
  projectName: string;
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

  // Zoom
  zoom: number; // 1 to 5
  setZoom(z: number): void;

  // Secciones y Bucles
  sections: SongSection[];
  activeSectionId: string | null;
  loopSectionId: string | null;
  queuedSectionId: string | null;
  addSection(name: string, start: number, end: number, colorIndex?: number): void;
  updateSection(id: string, partial: Partial<SongSection>): void;
  removeSection(id: string): void;
  setLoopSection(id: string | null): void;
  queueSection(id: string | null): void;
  autoGenerateSections(): void;

  // Recorte y Fades
  setTrackTrimFades(
    id: string,
    updates: { trimStart?: number; trimEnd?: number; fadeIn?: number; fadeOut?: number },
  ): void;

  // Bloqueo de Tonalidad por pista
  toggleTrackPitchLock(id: string): void;
  setTrackPitchLock(id: string, locked: boolean): void;
  autoDetectPitchLocks(): void;
  setAllTracksPitchLock(locked: boolean): void;

  // Deshacer / Rehacer
  canUndo: boolean;
  canRedo: boolean;
  undo(): void;
  redo(): void;

  setProjectName(name: string): void;
  addFiles(files: File[]): Promise<void>;
  relinkTrack(id: string, file: File): Promise<void>;
  removeTrack(id: string): void;
  clearAll(): void;
  loadProject(project: DawProject): void;
  getProjectData(): DawProject;

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

let undoStack: HistorySnapshot[] = [];
let redoStack: HistorySnapshot[] = [];

function makeSnapshot(s: DawState): HistorySnapshot {
  return {
    tracks: s.tracks.map((t) => ({
      id: t.id,
      volPos: t.volPos,
      pan: t.pan,
      mute: t.mute,
      solo: t.solo,
      semitones: t.semitones,
      trimStart: t.trimStart,
      trimEnd: t.trimEnd,
      fadeIn: t.fadeIn,
      fadeOut: t.fadeOut,
      pitchLocked: t.pitchLocked ?? false,
    })),
    masterVolPos: s.masterVolPos,
    tempoRatio: s.tempoRatio,
    masterSemitones: s.masterSemitones,
    masterCents: s.masterCents,
    sections: [...s.sections],
  };
}

export const useDaw = create<DawState>()((set, get) => {
  const patch = (id: string, p: Partial<TrackState>) =>
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...p } : t)) }));

  const pushUndo = () => {
    const snap = makeSnapshot(get());
    undoStack.push(snap);
    if (undoStack.length > 40) undoStack.shift();
    redoStack = [];
    set({ canUndo: true, canRedo: false });
  };

  return {
    projectId: crypto.randomUUID(),
    projectName: 'Nuevo Proyecto',
    tracks: [],
    refTrackId: null,
    theme: 'live-dark',
    mixerPosition: 'bottom',
    masterVolPos: UNITY_POS,
    tempoRatio: 1,
    masterSemitones: 0,
    masterCents: 0,
    keyLock: true,
    transport: 'stopped',

    // Zoom
    zoom: 1,
    setZoom: (z) => set({ zoom: clamp(Math.round(z * 100) / 100, 1, 5) }),

    // Secciones
    sections: [],
    activeSectionId: null,
    loopSectionId: null,
    queuedSectionId: null,

    addSection: (name, start, end, colorIndex) => {
      pushUndo();
      const s = get();
      const id = crypto.randomUUID();
      const cIndex = colorIndex ?? (s.sections.length % 8);
      const newSec: SongSection = {
        id,
        name: name.trim() || `Sección ${s.sections.length + 1}`,
        start: Math.max(0, start),
        end: Math.max(start + 0.5, end),
        colorIndex: cIndex,
      };
      const sorted = [...s.sections, newSec].sort((a, b) => a.start - b.start);
      set({ sections: sorted });
    },

    updateSection: (id, partial) => {
      pushUndo();
      set((s) => ({
        sections: s.sections
          .map((sec) => (sec.id === id ? { ...sec, ...partial } : sec))
          .sort((a, b) => a.start - b.start),
      }));
    },

    removeSection: (id) => {
      pushUndo();
      set((s) => ({
        sections: s.sections.filter((sec) => sec.id !== id),
        activeSectionId: s.activeSectionId === id ? null : s.activeSectionId,
        loopSectionId: s.loopSectionId === id ? null : s.loopSectionId,
        queuedSectionId: s.queuedSectionId === id ? null : s.queuedSectionId,
      }));
    },

    setLoopSection: (id) => set({ loopSectionId: id }),
    queueSection: (id) => set({ queuedSectionId: id }),

    autoGenerateSections: () => {
      const s = get();
      const ref = selectRef(s);
      const totalDur = Math.max(0.1, ...s.tracks.map((t) => t.duration));
      if (totalDur <= 1) return;

      pushUndo();
      const bpm = ref?.bpm && ref.bpm > 40 && ref.bpm < 240 ? ref.bpm : 120;
      const barSec = (60 / bpm) * 4;

      const template = [
        { name: 'Intro', bars: 8 },
        { name: 'Verso 1', bars: 16 },
        { name: 'Pre-Coro', bars: 8 },
        { name: 'Coro 1', bars: 16 },
        { name: 'Verso 2', bars: 16 },
        { name: 'Coro 2', bars: 16 },
        { name: 'Puente', bars: 8 },
        { name: 'Coro 3', bars: 16 },
        { name: 'Outro', bars: 8 },
      ];

      const newSections: SongSection[] = [];
      let curTime = 0;
      let idx = 0;

      while (curTime < totalDur - 1 && idx < 20) {
        const item = template[idx % template.length];
        const dur = item.bars * barSec;
        const endTime = Math.min(totalDur, curTime + dur);
        if (endTime - curTime < 1) break;

        newSections.push({
          id: crypto.randomUUID(),
          name: idx < template.length ? item.name : `${item.name} (${Math.floor(idx / template.length) + 1})`,
          start: Math.round(curTime * 100) / 100,
          end: Math.round(endTime * 100) / 100,
          colorIndex: idx % 8,
        });

        curTime = endTime;
        idx++;
      }

      set({ sections: newSections });
    },

    // Recorte y Fades
    setTrackTrimFades: (id, updates) => {
      const tr = get().tracks.find((t) => t.id === id);
      if (!tr) return;
      pushUndo();
      const trimStart = updates.trimStart !== undefined ? Math.max(0, updates.trimStart) : tr.trimStart;
      const trimEnd = updates.trimEnd !== undefined ? Math.min(tr.duration, Math.max(trimStart + 0.1, updates.trimEnd)) : tr.trimEnd;
      const maxFade = (trimEnd - trimStart) / 2;
      const fadeIn = updates.fadeIn !== undefined ? clamp(updates.fadeIn, 0, maxFade) : tr.fadeIn;
      const fadeOut = updates.fadeOut !== undefined ? clamp(updates.fadeOut, 0, maxFade) : tr.fadeOut;

      patch(id, { trimStart, trimEnd, fadeIn, fadeOut });
    },

    // Bloqueo de Tonalidad por pista
    toggleTrackPitchLock: (id) => {
      pushUndo();
      const tr = get().tracks.find((t) => t.id === id);
      if (tr) patch(id, { pitchLocked: !tr.pitchLocked });
    },
    setTrackPitchLock: (id, locked) => {
      pushUndo();
      patch(id, { pitchLocked: locked });
    },
    autoDetectPitchLocks: () => {
      pushUndo();
      const pattern = /drum|bater[ií]a|perc|click|claqueta|metr[oó]nomo|hi-?hat|snare|kick|caja|bombo|shaker|pandereta|tambor|gui[aá]|gu[ií]de/i;
      set((s) => ({
        tracks: s.tracks.map((t) => ({
          ...t,
          pitchLocked: pattern.test(t.name) || (t.fileMeta?.name ? pattern.test(t.fileMeta.name) : false),
        })),
      }));
    },
    setAllTracksPitchLock: (locked) => {
      pushUndo();
      set((s) => ({
        tracks: s.tracks.map((t) => ({ ...t, pitchLocked: locked })),
      }));
    },

    // Deshacer / Rehacer
    canUndo: false,
    canRedo: false,

    undo: () => {
      if (undoStack.length === 0) return;
      const current = makeSnapshot(get());
      redoStack.push(current);
      const prev = undoStack.pop()!;

      set((s) => ({
        tracks: s.tracks.map((t) => {
          const match = prev.tracks.find((pt) => pt.id === t.id);
          if (!match) return t;
          return {
            ...t,
            volPos: match.volPos,
            pan: match.pan,
            mute: match.mute,
            solo: match.solo,
            semitones: match.semitones,
            trimStart: match.trimStart,
            trimEnd: match.trimEnd,
            fadeIn: match.fadeIn,
            fadeOut: match.fadeOut,
            pitchLocked: match.pitchLocked ?? false,
          };
        }),
        masterVolPos: prev.masterVolPos,
        tempoRatio: prev.tempoRatio,
        masterSemitones: prev.masterSemitones,
        masterCents: prev.masterCents,
        sections: prev.sections,
        canUndo: undoStack.length > 0,
        canRedo: true,
      }));
    },

    redo: () => {
      if (redoStack.length === 0) return;
      const current = makeSnapshot(get());
      undoStack.push(current);
      const next = redoStack.pop()!;

      set((s) => ({
        tracks: s.tracks.map((t) => {
          const match = next.tracks.find((pt) => pt.id === t.id);
          if (!match) return t;
          return {
            ...t,
            volPos: match.volPos,
            pan: match.pan,
            mute: match.mute,
            solo: match.solo,
            semitones: match.semitones,
            trimStart: match.trimStart,
            trimEnd: match.trimEnd,
            fadeIn: match.fadeIn,
            fadeOut: match.fadeOut,
            pitchLocked: match.pitchLocked ?? false,
          };
        }),
        masterVolPos: next.masterVolPos,
        tempoRatio: next.tempoRatio,
        masterSemitones: next.masterSemitones,
        masterCents: next.masterCents,
        sections: next.sections,
        canUndo: true,
        canRedo: redoStack.length > 0,
      }));
    },

    setProjectName: (name) => set({ projectName: name }),

    async addFiles(files) {
      pushUndo();
      for (const file of files) {
        if (get().tracks.length >= MAX_TRACKS) break;
        const id = crypto.randomUUID();
        const used = new Set(get().tracks.map((t) => t.colorIndex));
        const colorPalette = Array.from({ length: MAX_TRACKS }, (_, i) => i);
        const colorIndex = colorPalette.find((i) => !used.has(i)) ?? (get().tracks.length % MAX_TRACKS);
        const isRhythmicOrGuide = /drum|bater[ií]a|perc|click|claqueta|metr[oó]nomo|hi-?hat|snare|kick|caja|bombo|shaker|pandereta|tambor|gui[aá]|gu[ií]de/i.test(file.name);
        set((s) => ({
          refTrackId: s.refTrackId ?? id,
          tracks: [...s.tracks, {
            id,
            name: file.name.replace(/\.[^.]+$/, ''),
            colorIndex,
            status: 'loading',
            duration: 0,
            peaks: null,
            volPos: UNITY_POS,
            pan: 0,
            mute: false,
            solo: false,
            semitones: 0,
            bpm: null,
            bpmConfidence: 0,
            key: null,
            keyConfidence: 0,
            analysis: 'pending',
            trimStart: 0,
            trimEnd: 0,
            fadeIn: 0,
            fadeOut: 0,
            pitchLocked: isRhythmicOrGuide,
            fileMeta: {
              name: file.name,
              size: file.size,
              type: file.type,
              lastModified: file.lastModified,
            },
          }],
        }));
        try {
          const info = await engine.addTrack(id, file);
          patch(id, {
            status: 'ready',
            duration: info.duration,
            peaks: info.peaks,
            trimEnd: info.duration,
          });
          analyze(info.analysisInput, ANALYSIS_SR)
            .then((r) => patch(id, {
              analysis: 'done',
              bpm: r.bpm?.bpm ?? null,
              bpmConfidence: r.bpm?.confidence ?? 0,
              key: r.key ? { tonic: r.key.tonic, mode: r.key.mode } : null,
              keyConfidence: r.key?.confidence ?? 0,
            }))
            .catch(() => patch(id, { analysis: 'error' }));
        } catch (e) {
          patch(id, {
            status: 'error',
            analysis: 'error',
            error: e instanceof Error ? e.message : 'No se pudo decodificar el archivo',
          });
        }
      }
    },

    async relinkTrack(id, file) {
      const existing = get().tracks.find((t) => t.id === id);
      if (!existing) return;
      pushUndo();
      patch(id, {
        status: 'loading',
        error: undefined,
        fileMeta: {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        },
      });
      try {
        const info = await engine.addTrack(id, file);
        patch(id, {
          status: 'ready',
          duration: info.duration,
          peaks: info.peaks,
          trimEnd: existing.trimEnd > 0 ? existing.trimEnd : info.duration,
        });
        if (!existing.bpm || !existing.key) {
          analyze(info.analysisInput, ANALYSIS_SR)
            .then((r) => patch(id, {
              analysis: 'done',
              bpm: existing.bpm ?? r.bpm?.bpm ?? null,
              bpmConfidence: existing.bpm ? existing.bpmConfidence : (r.bpm?.confidence ?? 0),
              key: existing.key ?? (r.key ? { tonic: r.key.tonic, mode: r.key.mode } : null),
              keyConfidence: existing.key ? existing.keyConfidence : (r.key?.confidence ?? 0),
            }))
            .catch(() => patch(id, { analysis: 'error' }));
        }
      } catch (e) {
        patch(id, {
          status: 'error',
          error: e instanceof Error ? e.message : 'No se pudo decodificar el archivo',
        });
      }
    },

    removeTrack(id) {
      pushUndo();
      engine.removeTrack(id);
      set((s) => {
        const tracks = s.tracks.filter((t) => t.id !== id);
        return { tracks, refTrackId: s.refTrackId === id ? (tracks[0]?.id ?? null) : s.refTrackId };
      });
    },

    clearAll() {
      engine.clear();
      undoStack = [];
      redoStack = [];
      set({
        projectId: crypto.randomUUID(),
        projectName: 'Nuevo Proyecto',
        tracks: [],
        refTrackId: null,
        masterVolPos: UNITY_POS,
        tempoRatio: 1,
        masterSemitones: 0,
        masterCents: 0,
        transport: 'stopped',
        sections: [],
        activeSectionId: null,
        loopSectionId: null,
        queuedSectionId: null,
        canUndo: false,
        canRedo: false,
      });
    },

    loadProject(project: DawProject) {
      engine.clear();
      undoStack = [];
      redoStack = [];
      const tracks: TrackState[] = project.tracks.map((t: ProjectTrackData) => ({
        id: t.id,
        name: t.name,
        colorIndex: t.colorIndex,
        status: 'missing',
        duration: t.duration,
        peaks: null,
        volPos: t.volPos,
        pan: t.pan,
        mute: t.mute,
        solo: t.solo,
        semitones: t.semitones,
        bpm: t.bpm,
        bpmConfidence: t.bpmConfidence,
        key: t.key,
        keyConfidence: t.keyConfidence,
        analysis: t.bpm && t.key ? 'done' : 'pending',
        trimStart: t.trimStart ?? 0,
        trimEnd: t.trimEnd ?? t.duration,
        fadeIn: t.fadeIn ?? 0,
        fadeOut: t.fadeOut ?? 0,
        pitchLocked: t.pitchLocked ?? false,
        fileMeta: t.fileInfo,
      }));

      set({
        projectId: project.id || crypto.randomUUID(),
        projectName: project.name || 'Proyecto',
        tracks,
        refTrackId: project.master?.refTrackId ?? (tracks[0]?.id ?? null),
        theme: project.ui?.theme ?? 'live-dark',
        mixerPosition: project.ui?.mixerPosition ?? 'bottom',
        masterVolPos: project.master?.volPos ?? UNITY_POS,
        tempoRatio: project.master?.tempoRatio ?? 1,
        masterSemitones: project.master?.masterSemitones ?? 0,
        masterCents: project.master?.masterCents ?? 0,
        keyLock: project.master?.keyLock ?? true,
        transport: 'stopped',
        sections: project.sections ?? [],
        activeSectionId: null,
        loopSectionId: null,
        queuedSectionId: null,
        canUndo: false,
        canRedo: false,
      });
    },

    getProjectData(): DawProject {
      const s = get();
      const tracks: ProjectTrackData[] = s.tracks.map((t) => ({
        id: t.id,
        name: t.name,
        colorIndex: t.colorIndex,
        volPos: t.volPos,
        pan: t.pan,
        mute: t.mute,
        solo: t.solo,
        semitones: t.semitones,
        duration: t.duration,
        bpm: t.bpm,
        bpmConfidence: t.bpmConfidence,
        key: t.key,
        keyConfidence: t.keyConfidence,
        trimStart: t.trimStart,
        trimEnd: t.trimEnd,
        fadeIn: t.fadeIn,
        fadeOut: t.fadeOut,
        pitchLocked: t.pitchLocked ?? false,
        fileInfo: {
          name: t.fileMeta?.name || `${t.name}.wav`,
          size: t.fileMeta?.size,
          type: t.fileMeta?.type,
          lastModified: t.fileMeta?.lastModified,
        },
      }));

      return {
        version: 1,
        id: s.projectId,
        name: s.projectName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        master: {
          volPos: s.masterVolPos,
          tempoRatio: s.tempoRatio,
          masterSemitones: s.masterSemitones,
          masterCents: s.masterCents,
          keyLock: s.keyLock,
          refTrackId: s.refTrackId,
        },
        ui: {
          theme: s.theme,
          mixerPosition: s.mixerPosition,
        },
        tracks,
        sections: s.sections,
      };
    },

    setRef: (id) => set({ refTrackId: id }),
    setVol: (id, v) => patch(id, { volPos: clamp(v, 0, 1) }),
    setPan: (id, v) => patch(id, { pan: clamp(v, -1, 1) }),
    toggleMute: (id) => {
      pushUndo();
      patch(id, { mute: !get().tracks.find((t) => t.id === id)?.mute });
    },
    toggleSolo: (id) => {
      pushUndo();
      patch(id, { solo: !get().tracks.find((t) => t.id === id)?.solo });
    },
    setTrackSemitones: (id, v) => {
      pushUndo();
      patch(id, { semitones: clamp(Math.round(v), -12, 12) });
    },
    setMasterVol: (v) => set({ masterVolPos: clamp(v, 0, 1) }),

    setTempoRatio: (r) => set({ tempoRatio: clamp(r, 0.5, 2) }),
    setBpm(bpm) {
      pushUndo();
      const ref = selectRef(get());
      if (ref?.bpm) set({ tempoRatio: clamp(bpm / ref.bpm, 0.5, 2) });
    },
    correctBpm(factor) {
      pushUndo();
      const ref = selectRef(get());
      if (ref?.bpm) patch(ref.id, { bpm: ref.bpm * factor });
    },
    setMasterSemitones: (v) => {
      pushUndo();
      set({ masterSemitones: clamp(Math.round(v), -12, 12) });
    },
    setMasterCents: (v) => {
      pushUndo();
      set({ masterCents: clamp(Math.round(v), -50, 50) });
    },
    setKeyOverride(k) {
      pushUndo();
      const ref = selectRef(get());
      if (ref) patch(ref.id, { key: k, keyConfidence: 1 });
    },
    toggleKeyLock: () => set((s) => ({ keyLock: !s.keyLock })),
    resetTempoPitch: () => {
      pushUndo();
      set({ tempoRatio: 1, masterSemitones: 0, masterCents: 0 });
    },

    setTheme: (theme) => set({ theme }),
    setMixerPosition: (mixerPosition) => set({ mixerPosition }),
  };
});
