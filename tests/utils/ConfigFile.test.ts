import Fs from 'fs';
import Path from 'path';
import { ConfigFile, LazyDefaults } from '../../src/utils/ConfigFile';

interface TestCfg extends LazyDefaults {
  str: string;
  num: number;
  lazyValue: string | (() => string);

  nested: {
    deeper: {
      anotherStr: string;
    }

    letters: string[];
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = Fs.mkdtempSync('ApolloTests');
});

afterEach(() => {
  Fs.rmSync(tmpDir, {recursive: true, force: true});
});

describe('Auto load', () => {
  test('Enabled (default)', () => {
    const cfgPath = Path.join(tmpDir, 'config.json');
    const expectedData = {key: 'value'};

    Fs.writeFileSync(cfgPath, JSON.stringify(expectedData));

    const cfgDefaults = {key: 'Default-Value'};
    const cfg = new ConfigFile(cfgPath, cfgDefaults);

    expect(cfg.data).toEqual(expectedData);
  });

  test('Disabled', () => {
    const cfgPath = Path.join(tmpDir, 'config.json');
    const savedData = {key: 'value'};

    Fs.writeFileSync(cfgPath, JSON.stringify(savedData));

    const cfgDefaults = {key: 'Default-Value'};
    const cfg = new ConfigFile(cfgPath, cfgDefaults, undefined, false);

    expect(cfg.data).toEqual(cfgDefaults);
  });
});

describe('Pretty print', () => {
  test('Default (4 spaces)', () => {
    const cfgDefaults = {a: 'a', b: 'b', c: {c1: 1}};
    const cfg = new ConfigFile(Path.join(tmpDir, 'config.json'), cfgDefaults);

    expect(cfg.prettyPrint).toEqual(4);

    cfg.save();
    expect(Fs.readFileSync(cfg.path, 'utf-8'))
        .toEqual(JSON.stringify(cfgDefaults, null, 4));
  });

  test('Custom pretty print (2 spaces)', () => {
    const cfgDefaults = {a: 'a', b: 'b'};
    const cfg = new ConfigFile(Path.join(tmpDir, 'config.json'), cfgDefaults, 2);

    expect(cfg.prettyPrint).toEqual(2);

    cfg.save();
    expect(Fs.readFileSync(cfg.path, 'utf-8'))
        .toEqual(JSON.stringify(cfgDefaults, null, 2));
  });

  test('Disabled', () => {
    const cfgDefaults = {a: 'a', b: 'b', c: {c1: 1}};
    const cfg = new ConfigFile(Path.join(tmpDir, 'config.json'), cfgDefaults, false, false);

    expect(cfg.prettyPrint).toEqual(0);

    cfg.save();
    expect(Fs.readFileSync(cfg.path, 'utf-8')).toEqual(JSON.stringify(cfgDefaults));
  });
});

describe('Additional functionality', () => {
  let cfg: ConfigFile<TestCfg>;
  let defaultValue: TestCfg;
  let expectedCfgData: TestCfg;

  beforeEach(() => {
    const lazyValueValue = 'Lazily generated value';
    const lazyValueCallback = jest.fn(() => lazyValueValue.toString());
    defaultValue = {
      str: 'Test string',
      num: 110,
      lazyValue: lazyValueCallback,

      nested: {
        deeper: {
          anotherStr: 'Nested-Deeper-AnotherString'
        },
        letters: ['a', 'b', 'c']
      }
    };

    cfg = new ConfigFile<TestCfg>(Path.join(tmpDir, 'config.json'), defaultValue);
    expectedCfgData = {...defaultValue};
    expectedCfgData.lazyValue = lazyValueValue;
  });

  describe('Lazy values', () => {
    test('Config defaults properly resolved', () => {
      expect(cfg.data).toEqual(expectedCfgData);
    });

    test('Lazy values only being resolved once', () => {
      expect(defaultValue.lazyValue).toHaveBeenCalledTimes(1);

      cfg.save();
      cfg.load();

      expect(defaultValue.lazyValue).toHaveBeenCalledTimes(1);
    });
  });

  test('Config defaults properly written to file', () => {
    cfg.save();

    expect(Fs.readFileSync(cfg.path, 'utf-8'))
        .toEqual(JSON.stringify(expectedCfgData, null, cfg.prettyPrint));
  });

  test('Config changes written to file', () => {
    expect(Fs.existsSync(cfg.path)).toBe(false);

    cfg.save();
    expect(Fs.existsSync(cfg.path)).toBe(true);

    cfg.data.num = 12;
    expectedCfgData.num = 12;
    cfg.save();

    expect(Fs.readFileSync(cfg.path, 'utf-8'))
        .toEqual(JSON.stringify(expectedCfgData, null, cfg.prettyPrint));
  });

  test('Config changes read from file', () => {
    expectedCfgData.num = -10;
    Fs.writeFileSync(cfg.path, JSON.stringify(expectedCfgData));

    cfg.load();
    expect(cfg.data).toEqual(expectedCfgData);
  });

  test('Arrays in file overwriting defaults', () => {
    expectedCfgData.nested.letters = ['1', '2', '3'];
    Fs.writeFileSync(cfg.path, JSON.stringify(expectedCfgData));

    cfg.load();
    expect(cfg.data).toEqual(expectedCfgData);
  });
});
