const htmlEscape = require('escape-html');

const Utils = require('../utils'),
  db = require('../db/DB');

const router = require('express').Router();

router.get('/authorize/:grantID', (req, res, next) => {
  if (!req.session['loggedIn']) return next(Utils.createError(400, 'ToDo: Not logged in'));

  if (!Utils.isNumber(req.params.grantID)) return next(Utils.createError(404, 'Resource Not Found'));

  db.getGrant(req.params.grantID, (err, grant) => {
    if (err && err.code != 22003 /* numeric_value_out_of_range */) return next(Utils.logAndCreateError(err));
    if (!grant) return next(Utils.createError(404, 'Resource Not Found'));

    const clientID = req.query['client_id'],
      redirectURI = req.query['redirect_uri'],
      state = req.query['state'],
      responseType = (req.query['response_type'] || '').toLowerCase(),
      scope = (req.query['scope'] || '').toLowerCase().split(' ').filter((elem) => { return elem; }),
      agreed = req.query['agreed'];

    if (!clientID || !Utils.isNumber(clientID)) return next(Utils.createError(400, 'ToDo: Invalid or Missing ClientID (notify user - do not redirect)'));

    db.getApplication(clientID, (err, app) => {
      if (err && err.code != 22003 /* numeric_value_out_of_range */) return next(Utils.logAndCreateError(err));
      if (!app) return next(Utils.createError(400, 'ToDo: Invalid or Missing ClientID (notify user - do not redirect)'));

      if (!redirectURI || !Utils.includesIgnoreCase(app.redirect_uris, redirectURI)) return next(Utils.createError(400, 'ToDo: Invalid redirect_uri (notify user - do not redirect)'));
      if (responseType != 'code' && responseType != 'token') return next(Utils.createError(400, 'ToDo: unsupported_response_type'));

      for (const elem of scope) {
        if (elem != 'profile') {
          return next(Utils.createError(400, 'ToDo: invalid_scope'));
        }
      }

      if (responseType == 'token') {
        db.generateAccessToken(clientID, req.session['mc_UUID'], redirectURI, state, scope, (err, token) => {
          if (err) return next(Utils.logAndCreateError(err)); // server_error, error_description=err.message

          return res.redirect(redirectURI + `#access_token=${encodeURIComponent(token)}&token_type=${'Bearer'}&expires_in=${3600}&scope=${encodeURIComponent(scope.sort().join(' '))}${state ? '?state=' + encodeURIComponent(state) : ''}`);
        });
      } else {
        db.generateExchangeToken(clientID, req.session['mc_UUID'], redirectURI, state, scope, (err, token) => {
          if (err) return next(Utils.logAndCreateError(err)); // server_error, error_description=err.message

          return res.redirect(redirectURI + `?code=${encodeURIComponent(token)}&expires_in=${300}${state ? '?state=' + encodeURIComponent(state) : ''}`);
        });
      }
    });
  });
});

router.get('/authorize', (req, res, next) => {
  if (!req.session['loggedIn']) return next(Utils.createError(400, 'ToDo: Not logged in'));

  const clientID = req.query['client_id'],
    redirectURI = req.query['redirect_uri'],
    state = req.query['state'],
    // promt = Utils.toBoolean(req.query['promt']),
    responseType = (req.query['response_type'] || '').toLowerCase(),
    scope = (req.query['scope'] || '').toLowerCase().split(' ').filter((elem) => { return elem; });

  if (!clientID || !Utils.isNumber(clientID)) return next(Utils.createError(404, 'client_id is invalid'));

  db.getApplication(clientID, (err, app) => {
    if (err && err.code != 22003 /* numeric_value_out_of_range */) return next(Utils.logAndCreateError(err));
    if (!app || app.deleted) return next(Utils.createError(404, 'client_id is invalid'));

    if (!redirectURI || !Utils.includesIgnoreCase(app.redirect_uris, redirectURI)) return next(Utils.createError(400, 'redirect_uri is not listed for client_id'));
    if (responseType != 'code' && responseType != 'token') return next(Utils.createError(400, 'ToDo: unsupported_response_type'));

    for (const elem of scope) {
      if (elem != 'profile') {
        return next(Utils.createError(400, 'ToDo: invalid_scope'));
      }
    }

    db.generateGrant(clientID, req.session['mc_UUID'], redirectURI, state, scope, (err, grant) => {
      if (err) return next(Utils.logAndCreateError(err)); // server_error, error_description=err.message

      Utils.Minecraft.getUsername(req.session['mc_UUID'], (err, username) => {
        if (err) Utils.logAndCreateError(err);

        Utils.Minecraft.getUsername(app.owner, (err, appOwner) => {
          if (err) return next(Utils.logAndCreateError(err));

          let result = Utils.replacer(Utils.Storage.AUTHORIZE, '${', '}', (str) => {
            try {
              switch (str) {
                case 'HTML_HEADER': return Utils.Storage.HEADER;
                case 'HTML_FOOTER': return Utils.Storage.FOOTER;
                case 'HTML_HEAD_TOP': return Utils.Storage.HEAD_TOP;
                case 'HTML_HEAD_BOTTOM': return Utils.Storage.HEAD_BOTTOM;

                case 'URL_STATIC_CONTENT': return Utils.Storage.STATIC_CONTENT_URL;
                case 'URL_BASE': return Utils.Storage.BASE_URL;
                case 'URL_DOCS': return Utils.Storage.DOCS_URL;
                case 'MINECRAFT_HOST': return Utils.Storage.MINECRAFT_HOST;

                case 'Minecraft_Username': return (username || req.session['mc_Name']);
                case 'Minecraft_UUID': return req.session['mc_UUID'];

                case 'APP_NAME': return htmlEscape(app.name);
                case 'APP_DESCRIPTION': return htmlEscape(app.description) || 'Der Besitzer dieser Anwendung hat keine Beschreibung verfasst';
                case 'APP_OWNER_NAME': return appOwner;
                case 'APP_PUBLISHED': return new Date(app.created).toDateString().substring(4);

                case 'QUERY_PARAMS': return req.originalUrl.substring(req.originalUrl.indexOf('?'));
                case 'GRANT_ID': return `${grant.id}`;

                default: return '';
              }
            } catch (err) {
              Utils.logAndCreateError(err);
            }

            return '';
          });

          result = Utils.replacer(result, '?{', '?}', (str) => {
            if (str.startsWith('LoggedIn:')) {
              if (req.session['loggedIn']) {
                return str.substring('LoggedIn:'.length, str.lastIndexOf('?:'));
              } else {
                let index = str.lastIndexOf('?:');

                return index >= 0 ? str.substring(index + 2) : '';
              }
            }
          });

          res.send(result);
        });
      });
    });
  });
});

router.post('/token', (req, res, next) => {
  const clientID = req.body['client_id'],
    clientSecret = req.body['client_secret'],
    code = req.body['code'],
    redirectURI = req.body['redirect_uri'],
    grantType = req.body['grant_type'];

  if (!clientID || !clientSecret || !Utils.isNumber(clientID)) return next(Utils.createError(400, 'client_id does not exist or does not match client_secret'));

  db.getApplication(clientID, (err, app) => {
    if (err && err.code != 22003 /* numeric_value_out_of_range */) return next(Utils.logAndCreateError(err));
    if (!app || app.secret != clientSecret) return next(Utils.createError(400, 'client_id does not exist or does not match client_secret'));

    if (!grantType || grantType.toLowerCase() != 'authorization_code') return next(Utils.createError(400, 'Invalid grant_type'));

    db.invalidateExchangeToken(clientID, code, redirectURI, (err, grant) => {
      if (err) return next(Utils.logAndCreateError(err));
      if (!grant) return next(Utils.createError(400, 'Invalid code! expired? Wrong redirect_uri?'));

      const result = {
        access_token: grant.access_token,
        token_type: 'Bearer',
        expires_in: 3600 /* 1h */
      };
      if (grant.scope) {
        result.scope = grant.scope.sort().join(' ');

        if (grant.scope.includes('profile')) {
          (result.data = {}).profile = null;
        }
      }
      if (grant.state) {
        result.state = grant.state;
      }

      return res.send(result);
    });
  });
});

module.exports = router;