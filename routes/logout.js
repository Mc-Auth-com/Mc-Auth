const Utils = require('../utils');

const router = require('express').Router();

router.get('/', (req, res, next) => {
  delete req.session;

  res.redirect(Utils.Storage.BASE_URL); //TODO Zur Ursprungs-URL zurück und nur fallback ist BASE_URL
});

module.exports = router;