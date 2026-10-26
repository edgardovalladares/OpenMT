import { describe, it, expect, beforeEach } from 'vitest';
import { useDaw } from './useDaw';
import { totalSemitones } from './derived';

describe('useDaw store improvements', () => {
  beforeEach(() => {
    useDaw.getState().clearAll();
  });

  it('controls timeline zoom between 1 and 5', () => {
    const { setZoom } = useDaw.getState();
    setZoom(2.5);
    expect(useDaw.getState().zoom).toBe(2.5);

    setZoom(0.2);
    expect(useDaw.getState().zoom).toBe(1);

    setZoom(10);
    expect(useDaw.getState().zoom).toBe(5);
  });

  it('manages song sections, loop mode, and queued transition', () => {
    const { addSection, updateSection, setLoopSection, queueSection } = useDaw.getState();

    addSection('Intro', 0, 16, 0);
    addSection('Coro 1', 16, 32, 1);

    const s1 = useDaw.getState();
    expect(s1.sections).toHaveLength(2);
    expect(s1.sections[0].name).toBe('Intro');
    expect(s1.sections[1].name).toBe('Coro 1');

    const introId = s1.sections[0].id;
    const coroId = s1.sections[1].id;

    // Loop mode
    setLoopSection(introId);
    expect(useDaw.getState().loopSectionId).toBe(introId);

    // Queued transition
    queueSection(coroId);
    expect(useDaw.getState().queuedSectionId).toBe(coroId);

    // Update section
    updateSection(introId, { name: 'Intro Modificado', end: 18 });
    expect(useDaw.getState().sections[0].name).toBe('Intro Modificado');
    expect(useDaw.getState().sections[0].end).toBe(18);
  });

  it('manages undo and redo history for mixer, sections, and clip parameters', () => {
    const { addSection, setMasterSemitones, undo, redo } = useDaw.getState();

    expect(useDaw.getState().canUndo).toBe(false);

    setMasterSemitones(3);
    expect(useDaw.getState().masterSemitones).toBe(3);
    expect(useDaw.getState().canUndo).toBe(true);

    addSection('Verso', 0, 16);
    expect(useDaw.getState().sections).toHaveLength(1);

    // Undo section add
    undo();
    expect(useDaw.getState().sections).toHaveLength(0);
    expect(useDaw.getState().masterSemitones).toBe(3);
    expect(useDaw.getState().canRedo).toBe(true);

    // Redo section add
    redo();
    expect(useDaw.getState().sections).toHaveLength(1);

    // Undo both actions
    undo();
    undo();
    expect(useDaw.getState().masterSemitones).toBe(0);
  });

  it('locks tracks from master pitch shifting (drums, percussion, clicks, guide vocals)', () => {
    // Add mock tracks
    useDaw.setState({
      masterSemitones: 4,
      masterCents: 20,
      tracks: [
        {
          id: 't-bass',
          name: 'Bajo Eléctrico',
          colorIndex: 0,
          status: 'ready',
          duration: 100,
          peaks: null,
          volPos: 0.8,
          pan: 0,
          mute: false,
          solo: false,
          semitones: 0,
          bpm: null,
          bpmConfidence: 0,
          key: null,
          keyConfidence: 0,
          analysis: 'done',
          trimStart: 0,
          trimEnd: 100,
          fadeIn: 0,
          fadeOut: 0,
          pitchLocked: false,
        },
        {
          id: 't-drums',
          name: 'Batería Completa',
          colorIndex: 1,
          status: 'ready',
          duration: 100,
          peaks: null,
          volPos: 0.8,
          pan: 0,
          mute: false,
          solo: false,
          semitones: 0,
          bpm: null,
          bpmConfidence: 0,
          key: null,
          keyConfidence: 0,
          analysis: 'done',
          trimStart: 0,
          trimEnd: 100,
          fadeIn: 0,
          fadeOut: 0,
          pitchLocked: true,
        },
      ],
    });

    const state = useDaw.getState();
    const bass = state.tracks[0];
    const drums = state.tracks[1];

    // Bass track follows master transposition
    expect(totalSemitones(state, bass)).toBeCloseTo(4.2, 2);

    // Drums track is pitchLocked, so it ignores master pitch shift (keeps 0 st)
    expect(totalSemitones(state, drums)).toBe(0);

    // Toggle pitch lock on bass
    state.toggleTrackPitchLock('t-bass');
    const state2 = useDaw.getState();
    expect(totalSemitones(state2, state2.tracks[0])).toBe(0);

    // Auto detect pitch locks
    state2.autoDetectPitchLocks();
    const state3 = useDaw.getState();
    // Batería Completa matches pattern
    expect(state3.tracks.find((t) => t.id === 't-drums')?.pitchLocked).toBe(true);
  });

  it('manages song setlist tabs (add, select, rename, duplicate, remove, reorder)', async () => {
    const state = useDaw.getState();
    expect(state.songs).toHaveLength(1);
    expect(state.songs[0].name).toBe('Canción 1');

    // Rename current song
    state.renameSong(state.activeSongId, 'Gracia Sublime');
    expect(useDaw.getState().songs[0].name).toBe('Gracia Sublime');

    // Set lyrics on song 1
    state.setLyrics('[00:10.00] Verso 1 Cancion 1', 200);
    expect(useDaw.getState().lyrics.rawLrc).toContain('Verso 1 Cancion 1');

    // Add Song 2
    const song2Id = state.addSong('Hermoso Nombre');
    const s2 = useDaw.getState();
    expect(s2.songs).toHaveLength(2);
    expect(s2.activeSongId).toBe(song2Id);
    expect(s2.songs[1].name).toBe('Hermoso Nombre');
    // Song 2 starts with fresh lyrics
    expect(s2.lyrics.rawLrc).toBe('');

    // Set lyrics on song 2
    s2.setLyrics('[00:15.00] Verso 1 Cancion 2', 400);
    expect(useDaw.getState().lyrics.rawLrc).toContain('Verso 1 Cancion 2');

    // Switch back to Song 1
    const song1Id = s2.songs[0].id;
    await s2.selectSong(song1Id);
    const s1Back = useDaw.getState();
    expect(s1Back.activeSongId).toBe(song1Id);
    expect(s1Back.lyrics.rawLrc).toContain('Verso 1 Cancion 1');
    expect(s1Back.lyrics.offsetMs).toBe(200);

    // Duplicate Song 1
    s1Back.duplicateSong(song1Id);
    expect(useDaw.getState().songs).toHaveLength(3);
    expect(useDaw.getState().songs[2].name).toBe('Gracia Sublime (Copia)');

    // Reorder songs
    useDaw.getState().reorderSongs(2, 0);
    expect(useDaw.getState().songs[0].name).toBe('Gracia Sublime (Copia)');

    // Remove song
    useDaw.getState().removeSong(useDaw.getState().songs[0].id);
    expect(useDaw.getState().songs).toHaveLength(2);
  });

  it('keeps tracks isolated when creating a new song while tracks exist', async () => {
    const { addSong, selectSong } = useDaw.getState();
    const song1Id = useDaw.getState().activeSongId;

    // Simulate tracks in Song 1
    useDaw.setState(() => ({
      tracks: [
        {
          id: 't-1',
          name: 'Pista 1',
          colorIndex: 0,
          status: 'ready',
          duration: 120,
          peaks: null,
          volPos: 0.8,
          pan: 0,
          mute: false,
          solo: false,
          semitones: 0,
          bpm: 120,
          bpmConfidence: 1,
          key: null,
          keyConfidence: 0,
          analysis: 'done',
          trimStart: 0,
          trimEnd: 120,
          fadeIn: 0,
          fadeOut: 0,
          pitchLocked: false,
        },
      ],
    }));

    // Create Song 2
    const song2Id = addSong('Canción 2');
    expect(useDaw.getState().activeSongId).toBe(song2Id);
    expect(useDaw.getState().tracks).toHaveLength(0); // Song 2 is empty!

    // Verify Song 1 preserved its track
    const song1 = useDaw.getState().songs.find((s) => s.id === song1Id);
    expect(song1?.tracks).toHaveLength(1);
    expect(song1?.tracks[0].id).toBe('t-1');

    // Switch back to Song 1
    await selectSong(song1Id);
    expect(useDaw.getState().tracks).toHaveLength(1);
    expect(useDaw.getState().tracks[0].id).toBe('t-1');
  });

  it('assigns random colors to songs and preserves them in setlist and project export', () => {
    const { addSong, getProjectData } = useDaw.getState();
    const songId = addSong('Mi Canción Con Color');

    const song = useDaw.getState().songs.find((s) => s.id === songId);
    expect(song).toBeDefined();
    expect(song?.color).toBeDefined();
    expect(song?.color).toMatch(/^#[0-9a-f]{6}$/i);

    // Verify it exports in project data
    const proj = getProjectData();
    const exportedSong = proj.songs?.find((s) => s.id === songId);
    expect(exportedSong).toBeDefined();
    expect(exportedSong?.color).toBe(song?.color);
  });
});
