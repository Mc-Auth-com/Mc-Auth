import objectAssignDeep from 'object-assign-deep';

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

export function loadConfig(defaultCfg: object, path: string): object {
  // Create directory if it does not exist
  if (!existsSync(dirname(path))) {
    mkdirSync(dirname(path), { recursive: true });
  }

  // Parse file at 'path' and merge with 'defaultCfg'
  const result = objectAssignDeep({}, defaultCfg, existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : {});

  // Write current config (+ missing default values) into file
  writeFileSync(path, JSON.stringify(result, null, 4));

  return result;
}