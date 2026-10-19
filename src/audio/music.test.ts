import { describe, expect, it } from 'vitest';
import { camelot, keyName, transposeKey } from './music';

describe('tonalidades', () => {
  it('A minor = 8A', () => expect(camelot({ tonic: 9, mode: 'minor' })).toBe('8A'));
  it('C major = 8B', () => expect(camelot({ tonic: 0, mode: 'major' })).toBe('8B'));
  it('transpone +3 semitonos', () => expect(keyName(transposeKey({ tonic: 9, mode: 'minor' }, 3))).toBe('C min'));
  it('envuelve por debajo de 0', () => expect(transposeKey({ tonic: 0, mode: 'major' }, -1).tonic).toBe(11));
});
