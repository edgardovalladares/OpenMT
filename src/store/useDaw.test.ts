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
});
