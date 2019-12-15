const Utils = require('../utils');

const router = require('express').Router();

router.get('/', (req, res, next) => {
  Utils.Minecraft.getUsername(req.session['mc_UUID'], (err, username) => {
    if (err) Utils.logAndCreateError(err);

    let result = Utils.replacer(Utils.Storage.INDEX, '${', '}', (str) => {
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

module.exports = router;