import type { ThemeId, MixerPosition } from '../store/useDaw';
import type { KeyInfo } from '../audio/music';

export interface SongSection {
  id: string;
  name: string; // e.g. "Intro", "Verso 1", "Coro 1", "Verso 2", "Coro 2", "Puente", "Outro"
  start: number; // in seconds
  end: number;   // in seconds
  colorIndex?: number;
}

export interface ProjectTrackData {
  id: string;
  name: string;
  colorIndex: number;
  volPos: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  semitones: number;
  duration: number;
  bpm: number | null;
  bpmConfidence: number;
  key: KeyInfo | null;
  keyConfidence: number;
  trimStart?: number;
  trimEnd?: number;
  fadeIn?: number;
  fadeOut?: number;
  pitchLocked?: boolean;
  fileInfo: {
    name: string;
    size?: number;
    type?: string;
    lastModified?: number;
  };
}

export interface DawProject {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  master: {
    volPos: number;
    tempoRatio: number;
    masterSemitones: number;
    masterCents: number;
    keyLock: boolean;
    refTrackId: string | null;
  };
  ui: {
    theme: ThemeId;
    mixerPosition: MixerPosition;
  };
  tracks: ProjectTrackData[];
  sections?: SongSection[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  tracksCount: number;
  duration: number;
}
