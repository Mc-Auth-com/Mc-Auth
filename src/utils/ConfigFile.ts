import fs from 'fs';
import Path from 'path';
import deepMerge from 'ts-deepmerge';

export type ConfigFileValues =
    string |
    number |
    boolean |
    string[] |
    number[] |
    boolean[] |
    { [key: string | number]: ConfigFileValues };

export interface LazyDefaults {
  [key: string]: ConfigFileValues | (() => ConfigFileValues);
}

export class ConfigFile<T> {
  readonly path: string;
  readonly prettyPrint: number | string;

  public readonly defaults: T;
  public data: T;

  constructor(path: string, defaults: T, prettyPrint: number | string | false = 4, autoLoad: boolean = true) {
    this.path = path;
    this.prettyPrint = prettyPrint !== false ? prettyPrint : 0;

    this.defaults = Object.freeze(defaults);
    this.data = {} as any;

    if (!autoLoad) {
      this.data = this.lazyDeepMerge(this.defaults);
      return;
    }

    this.load();
  }

  load(): void {
    let parsedJson: any = {};

    if (fs.existsSync(this.path)) {
      parsedJson = JSON.parse(fs.readFileSync(this.path, 'utf-8'));
    }

    this.data = this.lazyDeepMerge(this.defaults, parsedJson);
  }

  save(): void {
    fs.mkdirSync(Path.dirname(this.path), {recursive: true});
    fs.writeFileSync(this.path, JSON.stringify(this.data, null, this.prettyPrint), 'utf-8');
  }

  saveIfChanged(): void {
    if (JSON.stringify(this.data) != JSON.stringify(JSON.parse(fs.readFileSync(this.path, 'utf-8')))) {
      this.save();
    }
  }

  private lazyDeepMerge(...objects: T[]): T {
    const merged = deepMerge.withOptions<any>({mergeArrays: false}, ...objects) as any;

    this.resolveLazyValues(merged);
    return merged;
  }

  private resolveLazyValues(object: { [key: string | number]: any }): void {
    if (object === null) {
      return;
    }

    for (const key of Object.keys(object)) {
      const value = object[key];

      if (typeof value == 'function') {
        object[key] = value();
        break;
      }

      if (typeof value == 'object') {
        this.resolveLazyValues(value);
      }
    }
  }
}
