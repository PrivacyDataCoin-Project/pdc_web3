import { describe, it, expect } from 'vitest';
import {
  isValidPdcAddress,
  isValidAlias,
  normalizeAlias,
  getAliasName,
  getAddressPrefix,
  detectNetworkFromAddress,
  formatAddress,
  isValidIntegratedAddress
} from '../src/utils/address';

describe('Address utilities', () => {
  describe('isValidPdcAddress', () => {
    it('should validate mainnet addresses', () => {
      // These are example formats - real addresses would be base58
      expect(isValidPdcAddress('pdc' + 'a'.repeat(90))).toBe(true);
    });

    it('should validate testnet addresses', () => {
      expect(isValidPdcAddress('tpdc' + 'b'.repeat(90))).toBe(true);
    });

    it('should validate stagenet addresses', () => {
      expect(isValidPdcAddress('spdc' + 'c'.repeat(90))).toBe(true);
    });

    it('should reject invalid prefixes', () => {
      expect(isValidPdcAddress('btc' + 'a'.repeat(90))).toBe(false);
      expect(isValidPdcAddress('xmr' + 'a'.repeat(90))).toBe(false);
    });

    it('should reject too short addresses', () => {
      expect(isValidPdcAddress('pdc123')).toBe(false);
    });

    it('should reject invalid characters', () => {
      expect(isValidPdcAddress('pdc' + '0'.repeat(90))).toBe(false); // 0 not in base58
      expect(isValidPdcAddress('pdc' + 'O'.repeat(90))).toBe(false); // O not in base58
      expect(isValidPdcAddress('pdc' + 'I'.repeat(90))).toBe(false); // I not in base58
      expect(isValidPdcAddress('pdc' + 'l'.repeat(90))).toBe(false); // l not in base58
    });

    it('should validate aliases', () => {
      expect(isValidPdcAddress('@myalias')).toBe(true);
      expect(isValidPdcAddress('@test-name')).toBe(true);
      expect(isValidPdcAddress('@test_name')).toBe(true);
    });
  });

  describe('isValidAlias', () => {
    it('should accept valid aliases', () => {
      expect(isValidAlias('@abc')).toBe(true);
      expect(isValidAlias('@my-alias')).toBe(true);
      expect(isValidAlias('@my_alias')).toBe(true);
      expect(isValidAlias('@a1b2c3')).toBe(true);
      expect(isValidAlias('@' + 'a'.repeat(64))).toBe(true);
    });

    it('should reject invalid aliases', () => {
      expect(isValidAlias('@ab')).toBe(false); // too short
      expect(isValidAlias('@' + 'a'.repeat(65))).toBe(false); // too long
      expect(isValidAlias('@MyAlias')).toBe(false); // uppercase
      expect(isValidAlias('@my alias')).toBe(false); // space
      expect(isValidAlias('@-alias')).toBe(false); // starts with hyphen
      expect(isValidAlias('@alias-')).toBe(false); // ends with hyphen
      expect(isValidAlias('@_alias')).toBe(false); // starts with underscore
      expect(isValidAlias('@alias_')).toBe(false); // ends with underscore
      expect(isValidAlias('myalias')).toBe(false); // no @ prefix
      expect(isValidAlias('@')).toBe(false); // empty
    });
  });

  describe('normalizeAlias', () => {
    it('should lowercase and add @ prefix', () => {
      expect(normalizeAlias('MyAlias')).toBe('@myalias');
      expect(normalizeAlias('@MyAlias')).toBe('@myalias');
      expect(normalizeAlias('  @Test_Name  ')).toBe('@test_name');
    });
  });

  describe('getAliasName', () => {
    it('should extract name without @', () => {
      expect(getAliasName('@myalias')).toBe('myalias');
      expect(getAliasName('myalias')).toBe('myalias');
    });
  });

  describe('getAddressPrefix', () => {
    it('should return correct prefix for each network', () => {
      expect(getAddressPrefix('mainnet')).toBe('pdc');
      expect(getAddressPrefix('testnet')).toBe('tpdc');
      expect(getAddressPrefix('stagenet')).toBe('spdc');
      expect(getAddressPrefix('regtest')).toBe('rpdc');
    });
  });

  describe('detectNetworkFromAddress', () => {
    it('should detect network from prefix', () => {
      expect(detectNetworkFromAddress('pdc' + 'a'.repeat(90))).toBe('mainnet');
      expect(detectNetworkFromAddress('tpdc' + 'a'.repeat(90))).toBe('testnet');
      expect(detectNetworkFromAddress('spdc' + 'a'.repeat(90))).toBe('stagenet');
      expect(detectNetworkFromAddress('rpdc' + 'a'.repeat(90))).toBe('regtest');
    });

    it('should return null for unknown prefix', () => {
      expect(detectNetworkFromAddress('btc' + 'a'.repeat(90))).toBeNull();
    });
  });

  describe('formatAddress', () => {
    it('should truncate long addresses', () => {
      const addr = 'pdc' + 'a'.repeat(100);
      const formatted = formatAddress(addr, 6, 6);
      expect(formatted).toBe('pdcaaa...aaaaaa');
      expect(formatted.length).toBeLessThan(addr.length);
    });

    it('should not truncate short addresses', () => {
      const addr = 'pdc123456';
      expect(formatAddress(addr)).toBe(addr);
    });
  });

  describe('isValidIntegratedAddress', () => {
    it('should accept long valid addresses', () => {
      expect(isValidIntegratedAddress('pdc' + 'a'.repeat(150))).toBe(true);
    });

    it('should reject short addresses', () => {
      expect(isValidIntegratedAddress('pdc' + 'a'.repeat(90))).toBe(false);
    });
  });
});