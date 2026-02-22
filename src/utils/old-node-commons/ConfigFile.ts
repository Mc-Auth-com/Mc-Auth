import Fs from 'fs';
import Path from 'path';
import {merge as DeepMerge} from 'ts-deepmerge';

// TODO: We don't want to see #save() fail because the tmp file already exists (mode 'wx'), so we need to choose a different name
export default class ConfigFile<T> {
  readonly path: string;
  readonly prettyPrint: number | string;
  readonly atomicWrites: boolean;

  public readonly defaults: T;
  public data: T;

  constructor(path: string, defaults: T, prettyPrint: number | string | false = 4, autoLoad: boolean = true, atomicWrites: boolean = true) {
    this.path = path;
    this.prettyPrint = prettyPrint !== false ? prettyPrint : 0;
    this.atomicWrites = atomicWrites;

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

    if (Fs.existsSync(this.path)) {
      parsedJson = JSON.parse(Fs.readFileSync(this.path, 'utf-8'));
    }

    this.data = this.lazyDeepMerge(this.defaults, parsedJson);
  }

  save(): void {
    Fs.mkdirSync(Path.dirname(this.path), {recursive: true});

    let targetFilePath = this.path;
    if (this.atomicWrites) {
      targetFilePath = `${this.path}.tmp.${process.pid}-${Date.now()}`;
    }

    Fs.writeFileSync(targetFilePath, JSON.stringify(this.data, null, this.prettyPrint), {
      encoding: 'utf-8',
      flag: this.atomicWrites ? 'wx' : 'w'
    });

    if (this.atomicWrites) {
      Fs.renameSync(targetFilePath, this.path);
    }
  }

  saveIfChanged(): void {
    if (!Fs.existsSync(this.path) ||
      JSON.stringify(this.data) != JSON.stringify(JSON.parse(Fs.readFileSync(this.path, 'utf-8')))) {
      this.save();
    }
  }

  private lazyDeepMerge(...objects: T[]): T {
    const merged = DeepMerge.withOptions<any>({mergeArrays: false}, ...objects);

    this.resolveLazyValues(merged);
    return merged as T;
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
