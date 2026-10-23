import { invoke } from '@tauri-apps/api/core';

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

export interface TauriFileMetadata {
  duration: number;
  sample_rate: number;
  channels: number;
  peaks: number[];
}

export interface TauriPlaybackState {
  position: number;
  is_playing: boolean;
  duration: number;
  meter_l: number;
  meter_r: number;
}

export async function tauriLoadFile(
  songId: string,
  trackId: string,
  filePath: string,
  trackName: string,
): Promise<TauriFileMetadata> {
  return await invoke<TauriFileMetadata>('daw_load_file', {
    songId,
    trackId,
    filePath,
    trackName,
  });
}

export async function tauriRemoveTrack(songId: string, trackId: string): Promise<void> {
  await invoke('daw_remove_track', { songId, trackId });
}

export async function tauriUpdateTrackMix(
  songId: string,
  trackId: string,
  mix: {
    volume?: number;
    pan?: number;
    mute?: boolean;
    solo?: boolean;
    semitones?: number;
    trimStart?: number;
    trimEnd?: number;
    fadeIn?: number;
    fadeOut?: number;
  },
): Promise<void> {
  await invoke('daw_update_track_mix', {
    songId,
    trackId,
    volume: mix.volume,
    pan: mix.pan,
    mute: mix.mute,
    solo: mix.solo,
    semitones: mix.semitones,
    trimStart: mix.trimStart,
    trimEnd: mix.trimEnd,
    fadeIn: mix.fadeIn,
    fadeOut: mix.fadeOut,
  });
}

export async function tauriPlay(): Promise<void> {
  await invoke('daw_play');
}

export async function tauriPause(): Promise<void> {
  await invoke('daw_pause');
}

export async function tauriStop(): Promise<void> {
  await invoke('daw_stop');
}

export async function tauriSeek(seconds: number): Promise<void> {
  await invoke('daw_seek', { seconds });
}

export async function tauriSetMasterVolume(volume: number): Promise<void> {
  await invoke('daw_set_master_volume', { volume });
}

export async function tauriSetTempoRatio(ratio: number): Promise<void> {
  await invoke('daw_set_tempo_ratio', { ratio });
}

export async function tauriSwitchSong(songId: string): Promise<void> {
  await invoke('daw_switch_song', { songId });
}

export async function tauriGetState(songId: string): Promise<TauriPlaybackState> {
  return await invoke<TauriPlaybackState>('daw_get_state', { songId });
}
