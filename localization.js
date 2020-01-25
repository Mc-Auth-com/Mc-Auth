const fs = require('fs');

const defaultLang = 'en',
  localizations = {},
  termArguments = {};

for (const fileName of fs.readdirSync('./lang')) {
  if (fileName.endsWith('.json')) {
    if (fileName == 'arguments.json') continue;

    const lang = (localizations[fileName.substring(0, fileName.length - 5)] = {});

    for (const obj of JSON.parse(fs.readFileSync(`./lang/${fileName}`, 'utf-8'))) {
      if (!/^\+?([a-z0-9_\.]*)$/.test(obj.term)) {
        console.error(`Term (${obj.term}) in './lang/${fileName}' contains invalid characters (allowed: a-z0-9_.)`);
        continue;
      }

      if (lang[obj.term]) {
        console.error(`Duplicate term (${obj.term}) in './lang/${fileName}'`);
        continue;
      }

      lang[obj.term] = obj.definition;
    }
  } else {
    console.error(`Invalid file extension for './lang/${fileName}'`);
  }
}

for (const obj of JSON.parse(fs.readFileSync('./lang/arguments.json', 'utf-8'))) {
  if (!localizations[defaultLang][obj.term]) {
    console.error(`Skipping Localization-Argument because term '${obj.term}' is unknown for defaultLang '${defaultLang}'!`);
    continue;
  }

  termArguments[obj.term] = obj.args;
}

if (!localizations[defaultLang]) {
  console.error(`Could not find default localization './lang/${defaultLang}.json'`);
  process.exit(3);
}

module.exports = {
  defaultLang,

  /**
   * @param {String} strTerm 
   * @param {String} langKey 
   * @param {Number} amount 
   */
  getString(strTerm, langKey = defaultLang, amount = 1) {
    let result = (localizations[langKey] || localizations[defaultLang])[strTerm];

    if (!result) {
      result = localizations[defaultLang][strTerm];
    }

    if (typeof result == 'object') {
      if (amount == 1 && result['one']) {
        result = result['one'];
      } else if (amount == 0 && result['zero']) {
        result = result['zero'];
      } else {
        result = result['other'];
      }
    }

    return typeof result == 'string' ? result : JSON.stringify(result);
  },

  /**
   * @param {String} strTerm 
   */
  getArguments(strTerm) {
    return termArguments[strTerm];
  },

  /**
   * @param {String} langKey 
   */
  isLanguageSupported(langKey) {
    return langKey && typeof langKey == 'string' && langKey.length == 2 && localizations[langKey.toLowerCase()];
  }
};