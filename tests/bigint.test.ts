import { describe, it, expect } from 'vitest';
import {
  bigintToJson,
  jsonToBigint,
  bigintToHex,
  hexToBigint,
  atomicToHuman,
  humanToAtomic,
  formatAmount,
  parseAmount
} from '../src/utils/bigint';

describe('BigInt utilities', () => {
  describe('bigintToJson / jsonToBigint', () => {
    it('should convert bigint to string and back', () => {
      const value = 12345678901234567890n;
      const json = bigintToJson(value);
      expect(json).toBe('12345678901234567890');
      expect(jsonToBigint(json)).toBe(value);
    });

    it('should handle zero', () => {
      expect(jsonToBigint(bigintToJson(0n))).toBe(0n);
    });

    it('should handle negative numbers', () => {
      const value = -1000000000000n;
      expect(jsonToBigint(bigintToJson(value))).toBe(value);
    });
  });

  describe('bigintToHex / hexToBigint', () => {
    it('should convert bigint to hex and back', () => {
      const value = 12345678901234567890n;
      const hex = bigintToHex(value);
      expect(hex.startsWith('0x')).toBe(true);
      expect(hexToBigint(hex)).toBe(value);
    });

    it('should handle zero', () => {
      expect(hexToBigint(bigintToHex(0n))).toBe(0n);
    });

    it('should throw on negative', () => {
      expect(() => bigintToHex(-1n)).toThrow();
    });
  });

  describe('atomicToHuman / humanToAtomic', () => {
    it('should convert atomic to human with 12 decimals', () => {
      const atomic = 1000000000000n; // 1.000000000000 PDC
      expect(atomicToHuman(atomic, 12)).toBe('1');
    });

    it('should handle fractional amounts', () => {
      const atomic = 1500000000000n; // 1.5 PDC
      expect(atomicToHuman(atomic, 12)).toBe('1.5');
    });

    it('should handle small fractions', () => {
      const atomic = 100000000n; // 0.0001 PDC
      expect(atomicToHuman(atomic, 12)).toBe('0.0001');
    });

    it('should roundtrip', () => {
      const atomic = 1234567890123n;
      const human = atomicToHuman(atomic, 12);
      expect(humanToAtomic(human, 12)).toBe(atomic);
    });

    it('should handle negative', () => {
      const atomic = -1000000000000n;
      const human = atomicToHuman(atomic, 12);
      expect(human).toBe('-1');
      expect(humanToAtomic(human, 12)).toBe(atomic);
    });
  });

  describe('formatAmount / parseAmount', () => {
    it('should format with ticker', () => {
      expect(formatAmount(1000000000000n, 12, 'PDC')).toBe('1 PDC');
      expect(formatAmount(1500000000000n, 12, 'PDC')).toBe('1.5 PDC');
    });

    it('should parse with ticker', () => {
      expect(parseAmount('1 PDC', 12, 'PDC')).toBe(1000000000000n);
      expect(parseAmount('1.5 PDC', 12, 'PDC')).toBe(1500000000000n);
      expect(parseAmount('  1.5  PDC  ', 12, 'PDC')).toBe(1500000000000n);
    });
  });
});