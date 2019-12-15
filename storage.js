const BASE_URL = 'http://localhost:8091',  // lowercase and no trailing '/' !
  STATIC_CONTENT_URL = 'https://mc-auth.com',
  DOCS_URL = 'https://github.com/Mc-Auth-com/Mc-Auth-Web/wiki',
  MINECRAFT_HOST = 'mc-auth.com';

const ERR = require('fs').readFileSync('./html/err.html', { encoding: 'UTF-8' }),

  HEAD_TOP = (require('fs').readFileSync('./html/_head_top.html', { encoding: 'UTF-8' })),
  HEAD_BOTTOM = (require('fs').readFileSync('./html/_head_bottom.html', { encoding: 'UTF-8' })),

  HEADER = require('fs').readFileSync('./html/_header.html', { encoding: 'UTF-8' }),
  FOOTER = require('fs').readFileSync('./html/_footer.html', { encoding: 'UTF-8' }),

  INDEX = require('fs').readFileSync('./html/index.html', { encoding: 'UTF-8' }),
  LOGIN = require('fs').readFileSync('./html/login.html', { encoding: 'UTF-8' }),
  AUTHORIZE = require('fs').readFileSync('./html/authorize.html', { encoding: 'UTF-8' }),

  LEGAL = require('fs').readFileSync('./html/legal.html', { encoding: 'UTF-8' }),
  PRIVACY = require('fs').readFileSync('./html/privacy.html', { encoding: 'UTF-8' });

module.exports = {
  BASE_URL, STATIC_CONTENT_URL, DOCS_URL, MINECRAFT_HOST,

  ERR,

  HEAD_TOP, HEAD_BOTTOM,
  HEADER, FOOTER,

  INDEX,
  LOGIN,
  AUTHORIZE,


  LEGAL,
  PRIVACY
};