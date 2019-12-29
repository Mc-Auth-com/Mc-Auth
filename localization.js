const fs = require('fs');

const defaultLang = 'en',
  localizations = {},
  termArguments = {};

for (const file of fs.readdirSync('./lang')) {
  if (file.endsWith('.json')) {
    if (file == 'arguments.json') continue;

    const lang = (localizations[file.substring(0, file.length - 5)] = {});

    for (const obj of JSON.parse(fs.readFileSync(`./lang/${file}`, 'utf-8'))) {
      if (!/^\+?([a-z0-9_\.]*)$/.test(obj.term)) {
        console.error(`Term (${obj.term}) in './lang/${file}' contains invalid characters (allowed: a-z0-9_.)`);
        continue;
      }

      if (lang[obj.term]) {
        console.error(`Duplicate term (${obj.term}) in './lang/${file}'`);
        continue;
      }

      lang[obj.term] = obj.definition;
    }
  } else {
    console.error(`Invalid file extension for './lang/${file}'`);
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
  /**
   * @param {String} strTerm 
   * @param {String} langKey The language key like 'en' or 'de'
   * @param {Boolean} returnFallback If no string is found for langKey, the string for the default language is returned - DEFAULT IS FALSE
   */
  // getRaw(strTerm, langKey = defaultLang, returnFallback = false) {
  //   if (localizations[langKey] || !returnFallback) {
  //     if (localizations[langKey][strTerm] || !returnFallback) {
  //       return localizations[langKey][strTerm];
  //     } else {
  //       return localizations[defaultLang][strTerm];
  //     }
  //   }

  //   return localizations[defaultLang][strTerm];
  // },

  /**
   * @param {String} strTerm 
   * @param {String} langKey 
   * @param {Number} amount 
   */
  getString(strTerm, langKey = defaultLang, amount = 1) {
    let result = (localizations[langKey] || localizations[defaultLang])[strTerm];

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

  getArguments(strTerm) {
    return termArguments[strTerm];
  }
};