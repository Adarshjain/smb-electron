import { describe, expect, it } from 'vitest';
import { filterIdProofTypes } from './idProof';

describe('filterIdProofTypes', () => {
  it('returns nothing for an empty search', () => {
    expect(filterIdProofTypes('')).toEqual([]);
    expect(filterIdProofTypes('   ')).toEqual([]);
  });

  it('matches case-insensitively by prefix', () => {
    expect(filterIdProofTypes('dr')).toEqual(['Driving Licence']);
    expect(filterIdProofTypes('AA')).toEqual(['Aadhaar Card']);
  });

  it('puts starts-with matches before contains matches', () => {
    expect(filterIdProofTypes('pa')).toEqual(['PAN Card', 'Passport']);
    expect(filterIdProofTypes('card')).toEqual([
      'Aadhaar Card',
      'PAN Card',
      'Ration Card',
    ]);
  });

  it('returns nothing when no type matches', () => {
    expect(filterIdProofTypes('xyz')).toEqual([]);
  });
});
