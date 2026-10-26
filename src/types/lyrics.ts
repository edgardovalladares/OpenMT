export interface LyricLine {
  id: string;
  time: number; // in seconds
  text: string;
}

export interface LyricsData {
  rawLrc: string;
  offsetMs: number; // in milliseconds (positive = display later, negative = display earlier)
  options?: Partial<LyricsDisplayOptions>;
}

export type LyricsTheme = 'transparent' | 'dark' | 'chroma-green' | 'black';
export type LyricsMode = 'lowerthird' | 'prompter' | 'fullscreen';
export type LyricsFontSize = 'normal' | 'large' | 'xlarge';

export interface LyricsDisplayOptions {
  theme: LyricsTheme;
  mode: LyricsMode;
  fontSize: LyricsFontSize;
  uppercase: boolean;
  showNext: boolean;
  textShadow?: boolean;
  customCss?: string;
}

export interface LyricsSyncMessage {
  type: 'TIME_UPDATE' | 'LYRICS_UPDATE' | 'REQUEST_FULL_SYNC' | 'FULL_SYNC';
  position?: number;
  transport?: 'playing' | 'stopped' | 'paused';
  duration?: number;
  rawLrc?: string;
  offsetMs?: number;
  projectName?: string;
  options?: Partial<LyricsDisplayOptions>;
  room?: string;
  timestamp?: number;
}
