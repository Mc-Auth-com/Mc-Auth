const Utils = require('../utils'),
  db = require('../db/DB');

const router = require('express').Router();

router.get('/', (req, res, _next) => {
  Utils.Minecraft.getUsername(req.session['mc_UUID'], (err, username) => {
    if (err) Utils.logAndCreateError(err);

    return res.send(Utils.HTML.formatHTML(req, Utils.HTML.replaceVariables(req, username, Utils.Storage.LOGIN)));
  });
});

router.get('/verify', (req, res, next) => {
  if (req.session['loggedIn']) return next(Utils.createError(400, 'You are already logged in!'));

  let uuid = req.query.uuid,
    otp = req.query.otp;

  if (!uuid || !Utils.isUUID(uuid)) return next(Utils.createError(400, 'Missing or invalid parameter: uuid'));
  if (!otp || typeof otp != 'string' || otp.length != 6) return next(Utils.createError(400, 'Missing or invalid parameter: otp'));

  db.invalidateOneTimePassword(uuid, otp, (err, success) => {
    if (err) return next(Utils.logAndCreateError(err));

    if (success) {
      req.session['loggedIn'] = true;
      req.session['mc_UUID'] = uuid;

      if (!Utils.toBoolean(req.query.keepLogin) && req.query.keepLogin != 'on') {
        req.session.cookie.expires = false; // Make the cookie a session-cookie (duration)
      }
    }

    Utils.Minecraft.getUsername(uuid, (err, username) => {
      if (err) return next(Utils.logAndCreateError(err));

      req.session['mc_Name'] = username;

      res.json({
        verified: success,
        url: Utils.Storage.BASE_URL   //TODO Zur Ursprungs-URL zurück und nur fallback ist BASE_URL
      });
    });
  });
});

module.exports = router;