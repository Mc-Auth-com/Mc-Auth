const Utils = require('../utils'),
  db = require('../db/DB');

const router = require('express').Router();

router.get('/', (req, res, _next) => {
  if (req.session['loggedIn']) {
    const returnTo = (req.query['returnTo'] || '').toLowerCase();

    return res.redirect(returnTo.startsWith(Utils.Storage.BASE_URL) ? returnTo : Utils.Storage.BASE_URL);
  }

  return Utils.Express.handleStaticDynamic(req, res, Utils.Storage.LOGIN);
});

router.get('/verify', (req, res, next) => {
  if (req.session['loggedIn']) return next(Utils.createError(400, 'You are already logged in!'));

  let uuid = req.query.uuid,
    otp = req.query.otp;

  if (!uuid || !Utils.isUUID(uuid)) return next(Utils.createError(400, 'Missing or invalid parameter: uuid'));
  if (!otp || typeof otp != 'string' || (otp = otp.replace(/ /g, '')).length != 6) return next(Utils.createError(400, 'Missing or invalid parameter: otp'));

  db.invalidateOneTimePassword(uuid, otp, (err, success) => {
    if (err) return next(Utils.logAndCreateError(err));

    if (success) {
      Utils.Minecraft.getUsername(uuid, (err, username) => {
        if (err) return next(Utils.logAndCreateError(err));

        req.session['loggedIn'] = true;
        req.session['mc_UUID'] = uuid;
        req.session['mc_Name'] = username;

        const keepLogin = !Utils.toBoolean(req.query.keepLogin) && req.query.keepLogin != 'on';
        if (!keepLogin) {
          req.session.cookie.expires = false; // false makes it a session-cookie (duration or user-agent)
        }

        const returnTo = (req.query['returnTo'] || '').toLowerCase();
        let returnURL = returnTo.startsWith(Utils.Storage.BASE_URL) ? returnTo : Utils.Storage.BASE_URL;

        return res.send({
          verified: success,
          url: returnURL
        });
      });
    } else {
      return res.send({
        verified: false
      });
    }
  });
});

module.exports = router;