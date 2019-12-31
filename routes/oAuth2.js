const Utils = require('../utils'),
  db = require('../db/DB');

const router = require('express').Router();

router.get('/authorize/:grantID', (req, res, next) => {
  if (!req.session['loggedIn']) return res.redirect(`${Utils.Storage.BASE_URL}/login?returnTo=${encodeURIComponent(Utils.Storage.BASE_URL + req.originalUrl)}`);

  if (!Utils.isNumber(req.params.grantID)) return next(Utils.createError(404, 'Resource Not Found'));

  db.getUnusedGrant(req.params.grantID, req.session['mc_UUID'], (err, grant) => {
    if (err && err.code != 22003 /* numeric_value_out_of_range */) return next(Utils.logAndCreateError(err));
    if (!grant) return next(Utils.createError(404, 'Resource Not Found'));

    const clientID = req.query['client_id'],
      redirectURI = req.query['redirect_uri'],
      state = req.query['state'],
      responseType = (req.query['response_type'] || '').toLowerCase(),
      scope = (req.query['scope'] || '').toLowerCase().split(' ').filter((elem) => { return elem; }),
      agreed = Utils.toBoolean(req.query['agreed']);

    if (!clientID || !Utils.isNumber(clientID)) return next(Utils.createError(400, 'ToDo: Invalid or Missing ClientID (notify user - do not redirect)'));

    db.getApplication(clientID, (err, app) => {
      if (err && err.code != 22003 /* numeric_value_out_of_range */) return next(Utils.logAndCreateError(err));
      if (!app) return next(Utils.createError(400, 'ToDo: Invalid or Missing ClientID (notify user - do not redirect)'));

      const uriParamPrefix = responseType == 'token' ? '#' : '?',
        stateSuffix = state ? '&state=' + encodeURIComponent(state) : '';

      if (!redirectURI || !Utils.includesIgnoreCase(app.redirect_uris, redirectURI)) return next(Utils.createError(400, 'ToDo: Invalid redirect_uri (notify user - do not redirect)'));
      if (responseType != 'code' && responseType != 'token') return res.redirect(redirectURI + `${uriParamPrefix}error=unsupported_response_type${stateSuffix}`);

      for (const elem of scope) {
        if (elem != 'profile') {
          return res.redirect(redirectURI + `${uriParamPrefix}error=invalid_scope&error_description=${elem}${stateSuffix}`);
        }
      }

      if (responseType == 'token') {
        db.generateAccessToken(clientID, req.session['mc_UUID'], redirectURI, state, scope, (err, token) => {
          if (err) return res.redirect(redirectURI + `${uriParamPrefix}error=server_error&error_description=${Utils.logAndCreateError(err).message}${stateSuffix}`);

          return res.redirect(redirectURI + `${uriParamPrefix}access_token=${encodeURIComponent(token)}&token_type=${'Bearer'}&expires_in=${3600}&scope=${encodeURIComponent(scope.sort().join(' '))}${stateSuffix}`);
        });
      } else {
        db.setGrantResult(grant.id, agreed, (err) => {
          if (err) return res.redirect(redirectURI + `${uriParamPrefix}error=server_error&error_description=${Utils.logAndCreateError(err).message}${stateSuffix}`);

          if (!agreed) return res.redirect(redirectURI + `${uriParamPrefix}error=access_denied&error_description=resource_owner_denied_request${stateSuffix}`);

          return res.redirect(redirectURI + `${uriParamPrefix}code=${encodeURIComponent(grant.exchange_token)}&expires_in=${300}${stateSuffix}`);
        });
      }
    });
  });
});

router.get('/authorize', (req, res, next) => {
  if (!req.session['loggedIn']) return res.redirect(`${Utils.Storage.BASE_URL}/login?returnTo=${encodeURIComponent(Utils.Storage.BASE_URL + req.originalUrl)}`);

  const clientID = req.query['client_id'],
    redirectURI = req.query['redirect_uri'],
    state = req.query['state'],
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

          res.send(
            Utils.HTML.formatHTML(req, Utils.HTML.replaceVariables(req, username, Utils.Storage.AUTHORIZE, (str, args) => {
              return Utils.HTML.appVariableCallback(str, args[0]) || Utils.HTML.grantVariableCallback(str, args[1]);
            }, [[app, appOwner, false], [grant]]))
          );
        });
      });
    });
  });
});

module.exports = router;