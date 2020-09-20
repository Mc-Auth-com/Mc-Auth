// TODO: Think of a new file structure for en.json. It needs to be easily translatable and contain info like 'de', 'de_DE', 'Deutsch'
import { join as joinPath } from 'path';
import { readFileSync, readdirSync, statSync } from 'fs';

import { ApiError } from './utils/errors';
import { formatStr } from './utils/utils';

let loc: Localization | null = null;

/**
 * `langKey` and `defaultLanguage` are expected to be based on 'ISO 639-1'
 *
 * @see https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
 */
export class Localization {
  readonly languages: { [key: string /* langKey */]: { [key: string /* strKey/term */]: string /* localized string */ } };

  defaultLanguage: string;

  constructor(languages: { [key: string]: { [key: string]: string } }, defaultLanguage: string, langPath: string) {
    if (!languages[defaultLanguage]) {
      throw new ApiError(500, 'Could not find localization for default language', true,
        {
          defaultLanguage,
          expectedPath: joinPath(langPath, defaultLanguage + '.json'),
          providedLangs: Object.keys(languages)
        });
    }

    this.languages = languages;
    this.defaultLanguage = defaultLanguage;
  }

  getString(langKey: string, strKey: string): string {
    let result: string | undefined;

    if (this.languages[langKey]) {
      result = this.languages[langKey][strKey];
    }

    if (!result) {
      result = this.languages[this.defaultLanguage][strKey];
    }

    if (!result) {
      result = '<i>[missing translation]</i>';

      // Log error
      ApiError.log(500, 'Could not find a matching localization', true, {
        langKey,
        strKey,
        defaultLanguage: this.defaultLanguage,
        languages: Object.keys(this.languages)
      });
    }

    return result;
  }

  isAvailable(langKey: string): boolean {
    return !!this.languages[langKey];
  }
}

export function getLocalization(): Localization {
  if (!loc) {
    /* Read language files and instantiate Localization */
    const langPath = joinPath(__dirname, '..', 'resources', 'lang');
    const locArgs = JSON.parse(readFileSync(joinPath(langPath, 'arguments.json'), 'utf-8'));

    const tempLoc: { [key: string]: { [key: string]: string } } = {};
    for (const fileName of readdirSync(langPath)) {
      const fileNameLower = fileName.toLowerCase();
      const filePath = joinPath(langPath, fileName);

      if (fileNameLower.endsWith('.json') &&
        fileNameLower != 'arguments.json' &&
        statSync(filePath).isFile()) {
        const langKey = fileName.substring(0, fileName.length - 5).toLowerCase(),
          lang = JSON.parse(readFileSync(filePath, 'utf-8'));

        if (langKey.length != 2) {
          ApiError.log(500, 'Language key needs to be 2 characters long (e.g. en.json)', true, { file: filePath });  // log error
          continue;
        } else if (tempLoc[langKey]) {
          ApiError.log(500, 'Duplicate language file for the same language', true, { langKey, file: filePath });  // log error
          continue;
        }

        const duplicateTerms = [];
        tempLoc[langKey] = {};

        for (const langElem of lang) {
          if (tempLoc[langKey][langElem.term]) {
            duplicateTerms.push(langElem.term);
            continue;
          }

          let langArgs = [];

          for (const locArgElem of locArgs) {
            if (locArgElem.term == langElem.term) {
              langArgs = locArgElem.args;
              break;
            }
          }

          tempLoc[langKey][langElem.term] = formatStr(langElem.definition, langArgs);
        }

        if (duplicateTerms.length > 0) {
          ApiError.log(500, 'Duplicate localization terms', true, { file: filePath, duplicates: duplicateTerms });  // log error
        }
      }
    }

    loc = new Localization(tempLoc, 'en', langPath);
  }

  return loc;
}