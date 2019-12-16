const Utils = require('../utils');

const router = require('express').Router();

router.get('/', (req, res, _next) => {
  Utils.Minecraft.getUsername(req.session['mc_UUID'], (err, username) => {
    if (err) Utils.logAndCreateError(err);

    return res.send(Utils.HTML.formatHTML(req, Utils.HTML.replaceVariables(req, username, Utils.Storage.LEGAL)));
  });
});

module.exports = router;