const crypto = require('crypto'),
  request = require('request'),
  NodeCache = require('node-cache'),
  htmlEscape = require('escape-html');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  UUID_PATTERN_ADD_DASH = new RegExp('(.{8})(.{4})(.{4})(.{4})(.{12})'),
  ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:/i;

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
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,

        error
      }
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
            const error = module.exports.createError(500, `Api.Sprax2013.de responded with HTTP-StatusCode ${res.statusCode}`);

            mcUsernameCache.set(uuid, error);
            return callback(error);
          }
        });
      }
    }
  },

  HTML: {
    /* Replace */

    appVariableCallback(str = '', args) {
      const app = args[0],
        appOwnerName = args[1],
        reqByAppOwner = args[2];

      try {
        switch (str) {
          /* App */
          case 'APP_ID': return app.id;
          case 'APP_NAME': return htmlEscape(app.name);
          case 'APP_SECRET': return app.secret;
          case 'APP_DESCRIPTION': return htmlEscape(app.description) || (reqByAppOwner ? '<i>Der Besitzer dieser Anwendung hat keine Beschreibung angegeben</i>' : '<i>Du hast keine Beschreibung verfasst</i>');
          case 'APP_DESCRIPTION_RAW': return app.description || '';
          case 'APP_OWNER_NAME': return appOwnerName;
          case 'APP_PUBLISHED': return new Date(app.created).toDateString().substring(4);
          case 'APP_REDIRECT_URIs': return (app.redirect_uris || []).join('\r\n');
          case 'APP_ICON': return `${module.exports.Storage.BASE_URL}/uploads/${app.icon || 'default'}.png`;
          case 'APP_ICON_ID': return app.icon || 'default';

          default: break;
        }
      } catch (err) {
        module.exports.logAndCreateError(err);
      }

      return null;
    },

    grantVariableCallback(str = '', args) {
      const grant = args[0];

      try {
        switch (str) {
          /* Grant */
          case 'GRANT_ID': return `${grant.id}`;

          default: break;
        }
      } catch (err) {
        module.exports.logAndCreateError(err);
      }

      return null;
    },

    replaceVariables(req, mcUsername = undefined, html, customCallback = undefined, customCallbackArgs = []) {
      return module.exports.replacer(html, '${', '}', (str) => {
        try {
          switch (str) {
            /* Static */
            case 'HTML_HEADER': return module.exports.Storage.HEADER;
            case 'HTML_FOOTER': return module.exports.Storage.FOOTER;
            case 'HTML_HEAD_TOP': return module.exports.Storage.HEAD_TOP;
            case 'HTML_HEAD_BOTTOM': return module.exports.Storage.HEAD_BOTTOM;

            case 'URL_STATIC_CONTENT': return module.exports.Storage.STATIC_CONTENT_URL;
            case 'URL_BASE': return module.exports.Storage.BASE_URL;
            case 'URL_DOCS': return module.exports.Storage.DOCS_URL;
            case 'MINECRAFT_HOST': return module.exports.Storage.MINECRAFT_HOST;

            /* Dynamic */
            case 'QUERY_PARAMS': return req.originalUrl.indexOf('?') > 0 ? req.originalUrl.substring(req.originalUrl.indexOf('?')) : '';

            /* Session */
            case 'Minecraft_Username': return (mcUsername || req.session['mc_Name']) || '';
            case 'Minecraft_UUID': return req.session['mc_UUID'] || '';

            default: break;
          }

          if (customCallback) {
            return customCallback(str, customCallbackArgs) || '';
          }
        } catch (err) {
          module.exports.logAndCreateError(err);
        }

        return '';
      });
    },

    /* Format */
    appsFormatCallback(str, args) {
      const apps = args[0];

      if (str.startsWith('HasApps:')) {
        if (apps && apps.length > 0) {
          let result = '';
          const template = str.substring('HasApps:'.length, str.lastIndexOf('?:'));

          for (const app of apps) {
            result += module.exports.replacer(template, '$?{', '}', (str) => {
              try {
                switch (str) {
                  case 'APP_ID': return app.id;
                  case 'APP_NAME': return htmlEscape(app.name);
                  case 'APP_ICON': return `${module.exports.Storage.BASE_URL}/uploads/${app.icon || 'default'}.png`;
                  case 'APP_ICON_ID': return app.icon || 'default'

                  default: break;
                }
              } catch (err) {
                module.exports.logAndCreateError(err);
              }

              return '';
            });
          }

          return result;
        } else {
          let index = str.lastIndexOf('?:');

          return index >= 0 ? str.substring(index + 2) : '';
        }
      }

      return null;
    },

    formatHTML(req, html, customCallback = undefined, customCallbackArgs = []) {
      return module.exports.replacer(html, '?{', '?}', (str) => {
        if (str.startsWith('LoggedIn:')) {
          if (req.session['loggedIn']) {
            return str.substring('LoggedIn:'.length, str.lastIndexOf('?:'));
          }

          let index = str.lastIndexOf('?:');

          return index >= 0 ? str.substring(index + 2) : '';
        } else if (customCallback) {
          return customCallback(str, customCallbackArgs) || '';
        }

        return '';
      });
    }
  },

  Express: {
    staticDynamicRouter(html) {
      const router = require('express').Router();

      router.get('/', module.exports.Express.staticDynamicHandler(html));

      return router;
    },

    staticDynamicHandler(html) {
      return (req, res, _next) => {
        module.exports.Express.handleStaticDynamic(req, res, html);
      };
    },

    handleStaticDynamic(req, res, html) {
      module.exports.Minecraft.getUsername(req.session['mc_UUID'], (err, username) => {
        if (err) module.exports.logAndCreateError(err);

        return res.send(module.exports.HTML.formatHTML(req, module.exports.HTML.replaceVariables(req, username, html)));
      });
    }
  },

  EOL: require('os').EOL
};