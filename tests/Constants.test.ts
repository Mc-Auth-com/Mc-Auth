import fs from 'fs';
import { getCfg } from '../src/Constants';

describe('Test app version extraction from package.json', () => {
  test('Extracted from package.json', () => {
    jest.isolateModules(() => {
      jest.doMock('fs', () => ({
        readFileSync: () => '{ "version": "SemVer" }'
      }));

      expect(require('../src/Constants').APP_VERSION).toBe('SemVer');
    });
  });

  test('No version in package.json available', () => {
    jest.isolateModules(() => {
      jest.doMock('fs', () => ({
        readFileSync: () => '{}'
      }));

      expect(require('../src/Constants').APP_VERSION).toBe('UNKNOWN_APP_VERSION');
    });
  });
});

describe('Test lazy values in default config', () => {
  test('generated secret', () => {
    const secretCallback = getCfg().defaults.secret as any;

    expect(typeof secretCallback).toBe('function');

    const generatedSecret = secretCallback();

    expect(typeof generatedSecret).toBe('string');
    expect(Buffer.from(generatedSecret, 'base64').length).toBeGreaterThanOrEqual(1024);
  });
});
