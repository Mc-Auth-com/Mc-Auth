const crypto = require('crypto'),
  request = require('request'),
  NodeCache = require('node-cache');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  UUID_PATTERN_ADD_DASH = new RegExp('(.{8})(.{4})(.{4})(.{4})(.{12})'),
  ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:/i;
;

const errLogStream = require('rotating-file-stream').createStream('error.log', {
  interval: '1d',
  maxFiles: 90,
  path: require('path').join(__dirname, 'logs', 'runtime-error')
});
errLogStream.on('error', (err) => {
  console.error(err); // Don't crash whole application, just print
  // once this event is emitted, the stream will be closed as well
});

const mcUsernameCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

module.exports = {
  Storage: require('./storage'),

  /**
   * @param {Number} HTTPStatusCode The HTTP-StatusCode
   * @param {String} message A short description (or message)
   * 
   * @returns {Error}
   */
  createError(HTTPStatusCode = 500, message = 'An unknown error has occurred', hideFromConsole = false) {
    let err = new Error(message);
    err.status = HTTPStatusCode;
    err.hideFromConsole = hideFromConsole;

    return err;
  },

  /**
   * @param {Error} error
   * 
   * @returns {Error}
   */
  logAndCreateError(error) {
    console.error(error);

    errLogStream.write(JSON.stringify({
      time: new Date().toUTCString(),
      error: error
    }) + module.exports.EOL, 'utf-8', console.error);

    return module.exports.createError(undefined, undefined, true);
  },

  /**
   * @param {String[]} arr 
   * @param {String} str
   * 
   * @returns {Boolean}
   */
  includesIgnoreCase(arr, str) {
    if (arr && str && typeof str === 'string') {
      str = str.toLowerCase();

      for (const elem of arr) {
        if (typeof elem === 'string' && elem.toLowerCase() == str) {
          return true;
        }
      }
    }

    return false;
  },

  /**
   * @param {String} input 
   * 
   * @returns {Boolean}
   */
  toBoolean(input) {
    if (input) {
      if (typeof input === 'string') return input === '1' || input.toLowerCase() === 'true' || input.toLowerCase() === 't';
      if (typeof input === 'number') return input === 1;
      if (typeof input === 'boolean') return input;
    }

    return false;
  },

  /**
   * @param {String} str 
   * 
   * @returns {Boolean}
   */
  isUUID(str) {
    if (typeof str !== 'string') return false;

    str = str.toLowerCase();

    return UUID_PATTERN.test(str) || UUID_PATTERN.test(str.replace(/-/g, '').replace(UUID_PATTERN_ADD_DASH, '$1-$2-$3-$4-$5'));
  },

  /**
   * Acording to RFC3986 (https://tools.ietf.org/html/rfc3986#section-4.3)
   * 
   * This function only checks for the layout. Not the actual content (illegal characters etc.)
   * 
   * @param {String} str 
   * 
   * @returns {Boolean}
   */
  isAbsoluteURL(str) {
    return typeof str === 'string' && str.length < 2083 && ABSOLUTE_URL_PATTERN.test(str);
  },

  /**
   * @param {String} str 
   * 
   * @returns {Boolean}
   */
  isNumber(str) {
    return /^\+?([0-9]\d*)$/.test(str);
  },

  /**
   * @param {String|Number} str 
   * 
   * @returns {Number} A finite integer or NaN
   */
  toInteger(str) {
    if (typeof str === 'string') {
      let result = Number.parseInt(str);

      if (!Number.isNaN(result) && Number.isFinite(result)) return result;
    }

    return (typeof str === 'number') ? str : Number.NaN;
  },

  /**
   * Replaces all multiple spaces, tabs, etc. with a single space
   * 
   * @param {string} str 
   * 
   * @returns {string}
   */
  toNeutralString(str) {
    if (typeof str !== 'string') return null;

    return str.trim().replace(/\s\s+/g, ' ');
  },

  /**
   * @param {String} str 
   * 
   * @returns {String} SHA1 (hex)
   */
  getSHA1(str) {
    return crypto.createHash('SHA1').update(str).digest('hex');
  },

  /**
   * @callback ReplacerCallback
   * @param {String} str
   */
  /**
   * 
   * @param {String} text 
   * @param {String} startToken 
   * @param {String} endToken 
   * @param {ReplacerCallback} callback 
   * 
   * @author NudelErde
   */
  replacer(text, startToken, endToken, callback) {
    let startIndex = text.indexOf(startToken);

    while (startIndex != -1) {
      startIndex += startToken.length;
      let tmp = text.substring(startIndex);
      let endIndex = tmp.indexOf(endToken);

      tmp = callback(tmp.substring(0, endIndex));

      text = text.substring(0, startIndex - startToken.length) + tmp + text.substring(startIndex + endIndex + endToken.length);
      startIndex = text.indexOf(startToken);
    }

    return text;
  },

  Minecraft: {
    getUsername(uuid, callback) {
      if (!uuid) return callback(null, null);

      uuid = uuid.toLowerCase().replace(/-/g, '');

      const cached = mcUsernameCache.get(uuid);

      if (cached !== undefined) {
        if (cached instanceof Error) {
          callback(cached);
        } else {
          callback(null, cached);
        }
      } else {
        request('https://api.sprax2013.de/mojang/profile/' + uuid, (err, res, body) => {
          if (err) {
            mcUsernameCache.set(uuid, err);
            return callback(err);
          }

          if (res.statusCode == 200) {
            const json = JSON.parse(body);

            mcUsernameCache.set(uuid, json.name);

            return callback(null, json.name);
          } else if (res.statusCode == 204) {
            mcUsernameCache.set(uuid, null);

            return callback(null, null);
          } else {
            const error = Utils.createError(500, `Api.Sprax2013.de responded with HTTP-StatusCode ${res.statusCode}`);

            mcUsernameCache.set(uuid, error);
            return callback(error);
          }
        });
      }
    }
  },

  EOL: require('os').EOL
};