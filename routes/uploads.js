const sharp = require('sharp');

const Utils = require('../utils'),
  db = require('../db/DB');

const router = require('express').Router();

router.get('/:fileName', (req, res, next) => {
  const fileName = req.params['fileName'].toLowerCase();
  let imgID = fileName.substring(0, fileName.length - 4);

  if (!fileName || !imgID || !fileName.endsWith('.png') || !Utils.isNumber(imgID)) return res.sendStatus(404);

  if (imgID.startsWith('0')) {
    while (imgID.startsWith('0')) {
      imgID = imgID.substring(1);
    }

    if (imgID.length > 0) {
      return res.redirect(301, `${Utils.Storage.BASE_URL}/uploads/${imgID}.png`);
    }

    return res.sendStatus(404);
  }

  db.getOptimizedImage(imgID, (err, img) => {
    if (err) return next(Utils.logAndCreateError(err));
    if (!img) return res.sendStatus(404);

    res.type('png').send(img);
  });
});

router.post('/new', (req, res, next) => {
  if (!req.session['loggedIn']) return next(Utils.createError(401, 'You are not logged in!'));

  if (!req.body || !(req.body instanceof Buffer) || req.body.length == 0) return next(Utils.createError(400, 'Missing or invalid image'));

  sharp(req.body).png().resize(128, 128, { kernel: 'nearest' }).toBuffer((err, buffer, info) => {
    if (err) return next(Utils.createError(400, 'Invalid image', true));
    if (info.width < 64 || info.height < 64) return next(Utils.createError(400, 'Invalid image dimensions', true));

    db.createImage(buffer, req.body, (err, imageID) => {
      if (err) return next(Utils.logAndCreateError(err));

      const imgURL = `${Utils.Storage.BASE_URL}/uploads/${imageID}.png`;

      res.status(201) // TODO: Differ 'Created'(201) and 'Found/OK'(200)
        .location(imgURL)
        .send({ id: imageID, url: imgURL });
    });
  });
});

module.exports = router;