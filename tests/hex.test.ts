import { describe, it, expect } from 'vitest';
import {
  hexToBytes,
  bytesToHex,
  hexToBase64,
  base64ToHex,
  xorHex,
  isValidHex,
  normalizeHex,
  ensureHexPrefix,
  removeHexPrefix,
  padHex,
  truncateHex,
  reverseHexBytes,
  randomHex,
  keyToHex,
  hexToKey
} from '../src/utils/hex';

describe('Hex utilities', () => {
  describe('hexToBytes / bytesToHex', () => {
    it('should convert hex to bytes and back', () => {
      const hex = '0xdeadbeefcafe';
      const bytes = hexToBytes(hex);
      expect(bytes).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe]));
      expect(bytesToHex(bytes)).toBe('deadbeefcafe');
    });

    it('should handle empty string', () => {
      expect(hexToBytes('')).toEqual(new Uint8Array(0));
      expect(bytesToHex(new Uint8Array(0))).toBe('');
    });

    it('should handle odd length error', () => {
      expect(() => hexToBytes('abc')).toThrow('even length');
    });

    it('should handle prefix option', () => {
      const bytes = new Uint8Array([0xde, 0xad]);
      expect(bytesToHex(bytes, true)).toBe('0xdead');
    });
  });

  describe('hexToBase64 / base64ToHex', () => {
    it('should convert hex to base64 and back', () => {
      const hex = 'deadbeefcafe';
      const b64 = hexToBase64(hex);
      expect(base64ToHex(b64)).toBe(hex);
    });
  });

  describe('xorHex', () => {
    it('should XOR two hex strings', () => {
      const a = 'deadbeef';
      const b = 'ffffffff';
      const result = xorHex(a, b);
      expect(result).toBe('21524110');
    });

    it('should throw on unequal length', () => {
      expect(() => xorHex('aa', 'aaaa')).toThrow('equal length');
    });
  });

  describe('isValidHex', () => {
    it('should validate correct hex', () => {
      expect(isValidHex('deadbeef')).toBe(true);
      expect(isValidHex('0xdeadbeef')).toBe(true);
      expect(isValidHex('DEADBEEF')).toBe(true);
      expect(isValidHex('0')).toBe(false); // odd length
      expect(isValidHex('')).toBe(false);
      expect(isValidHex('ghijkl')).toBe(false);
    });
  });

  describe('normalizeHex', () => {
    it('should normalize hex strings', () => {
      expect(normalizeHex('0xDEADBEEF')).toBe('deadbeef');
      expect(normalizeHex('deadbeef')).toBe('deadbeef');
      expect(normalizeHex('DeAdBeEf')).toBe('deadbeef');
    });
  });

  describe('ensureHexPrefix / removeHexPrefix', () => {
    it('should add/remove 0x prefix', () => {
      expect(ensureHexPrefix('deadbeef')).toBe('0xdeadbeef');
      expect(ensureHexPrefix('0xdeadbeef')).toBe('0xdeadbeef');
      expect(removeHexPrefix('0xdeadbeef')).toBe('deadbeef');
      expect(removeHexPrefix('deadbeef')).toBe('deadbeef');
    });
  });

  describe('padHex / truncateHex', () => {
    it('should pad to byte length', () => {
      expect(padHex('dead', 4)).toBe('0000dead');
      expect(padHex('0xdead', 4)).toBe('0000dead');
    });

    it('should truncate to byte length', () => {
      expect(truncateHex('deadbeefcafe', 2)).toBe('dead');
      expect(truncateHex('0xdeadbeefcafe', 2)).toBe('dead');
    });
  });

  describe('reverseHexBytes', () => {
    it('should reverse byte order', () => {
      expect(reverseHexBytes('deadbeef')).toBe('efbeadde');
      expect(reverseHexBytes('0xdeadbeef')).toBe('efbeadde');
    });
  });

  describe('randomHex', () => {
    it('should generate correct length', () => {
      const hex = randomHex(32);
      expect(hex.length).toBe(64);
      expect(isValidHex(hex)).toBe(true);
    });
  });

  describe('keyToHex / hexToKey', () => {
    it('should convert 32-byte keys', () => {
      const bytes = new Uint8Array(32).fill(0xab);
      const hex = keyToHex(bytes);
      expect(hex.length).toBe(64);
      expect(hex).toBe('ab'.repeat(32));
      
      const back = hexToKey(hex);
      expect(back).toEqual(bytes);
    });

    it('should throw on wrong key length', () => {
      expect(() => hexToKey('dead')).toThrow('64 characters');
      expect(() => keyToHex(new Uint8Array(16))).toThrow('32 bytes');
    });
  });
});