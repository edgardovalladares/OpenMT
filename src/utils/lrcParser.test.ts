import { describe, it, expect } from 'vitest';
import { parseLrc, formatLrcTimestamp, findActiveLyricIndex } from './lrcParser';

describe('lrcParser', () => {
  it('parses basic LRC with standard timestamps', () => {
    const lrc = `
[00:10.50] Línea 1
[00:20.00] Línea 2
[01:05.25] Línea 3
    `;
    const lines = parseLrc(lrc);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ id: 'line-10.500-0', time: 10.5, text: 'Línea 1' });
    expect(lines[1]).toEqual({ id: 'line-20.000-1', time: 20, text: 'Línea 2' });
    expect(lines[2]).toEqual({ id: 'line-65.250-2', time: 65.25, text: 'Línea 3' });
  });

  it('handles multiple timestamps on a single line and sorts chronologically', () => {
    const lrc = `
[00:30.00][00:10.00] Coro repetido
[00:20.00] Verso
    `;
    const lines = parseLrc(lrc);
    expect(lines).toHaveLength(3);
    expect(lines[0].time).toBe(10);
    expect(lines[0].text).toBe('Coro repetido');
    expect(lines[1].time).toBe(20);
    expect(lines[1].text).toBe('Verso');
    expect(lines[2].time).toBe(30);
    expect(lines[2].text).toBe('Coro repetido');
  });

  it('handles metadata tags and global offset', () => {
    const lrc = `
[ti:Mi Cancion]
[ar:Artista]
[offset:500]
[00:10.00] Con offset aplicado (+0.5s)
    `;
    const lines = parseLrc(lrc);
    expect(lines).toHaveLength(1);
    expect(lines[0].time).toBe(10.5);
    expect(lines[0].text).toBe('Con offset aplicado (+0.5s)');
  });

  it('formats seconds into LRC timestamp correctly', () => {
    expect(formatLrcTimestamp(0)).toBe('[00:00.00]');
    expect(formatLrcTimestamp(12.34)).toBe('[00:12.34]');
    expect(formatLrcTimestamp(65.5)).toBe('[01:05.50]');
  });

  it('finds active lyric index correctly with and without offset', () => {
    const lines = [
      { id: '1', time: 10, text: 'Línea 1' },
      { id: '2', time: 20, text: 'Línea 2' },
      { id: '3', time: 30, text: 'Línea 3' },
    ];

    expect(findActiveLyricIndex(lines, 5)).toBe(-1); // Antes del inicio
    expect(findActiveLyricIndex(lines, 10)).toBe(0);
    expect(findActiveLyricIndex(lines, 15)).toBe(0);
    expect(findActiveLyricIndex(lines, 20)).toBe(1);
    expect(findActiveLyricIndex(lines, 25)).toBe(1);
    expect(findActiveLyricIndex(lines, 35)).toBe(2);

    // Con offset positivo de 1000ms (+1 segundo): la letra se retrasa
    // Por ende en t=10.5, effectiveTime = 10.5 - 1 = 9.5 < 10 -> -1
    expect(findActiveLyricIndex(lines, 10.5, 1000)).toBe(-1);
    // En t=11.5, effectiveTime = 11.5 - 1 = 10.5 >= 10 -> 0
    expect(findActiveLyricIndex(lines, 11.5, 1000)).toBe(0);
  });
});
