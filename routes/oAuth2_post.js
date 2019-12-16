const Utils = require('../utils'),
  db = require('../db/DB');

const router = require('express').Router();

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