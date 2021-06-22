import expressSessionPG from 'connect-pg-simple';
import cookieParser from 'cookie-parser';
import express from 'express';
import expressSession from 'express-session';
import morgan from 'morgan';
import { join as joinPath } from 'path';

import { cfg, dbCfg, pageGenerator, webAccessLogStream } from '.';
import { getLocalization } from './localization';
import { demoRouter } from './routes/demo';
import { loginRouter } from './routes/login';
import { logoutRouter } from './routes/logout';
import { oAuthNoCookieRouter, oAuthRouter } from './routes/oAuth';
import { settingsRouter } from './routes/settings';
import { staticPagesRouter } from './routes/staticPages';
import { uploadsNoCookieRouter, uploadsRouter } from './routes/uploads';
import { dbUtils } from './utils/database';
import { ApiError, ApiErrs } from './utils/errors';
import { stripLangKeyFromURL } from './utils/utils';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', cfg.trustProxy);

app.use((req, res, next) => {
  res.locals.sendJSON = true;
  next();
});

/* Logging webserver request */
app.use(morgan(cfg.logging.accessLogFormat, {stream: webAccessLogStream}));
if (process.env.NODE_ENV == 'production') {
  app.use(morgan('dev', {skip: (_req, res) => res.statusCode < 500}));
} else {
  app.use(morgan('dev'));
}

// Force the last query param instead of allowing multiple as string[]
app.use((req, _res, next) => {
  for (const key in req.query) {
    if (req.query.hasOwnProperty(key)) {
      const value = req.query[key];

      if (Array.isArray(value)) {
        let newValue = value.pop();

        if (typeof newValue != 'undefined') {
          req.query[key] = newValue;
        } else {
          delete req.query[key];
        }
      }
    }
  }

  next();
});

// Default response headers
// app.use((_req, res, next) => {
//   res.set({
//     'Access-Control-Allow-Origin': '*',
//     'Access-Control-Allow-Headers': 'User-AgentIf-None-Match,Content-Type,If-Unmodified-Since',

//     'Cache-Control': 'private, max-age=0'
//   });

//   next();
// });

/* Prepare Request (only call the ones needed by the NoCookie-Routes for now) */
const jsonMiddleware = express.json();
app.use((req, res, next) => {
  jsonMiddleware(req, res, (err) => {
    if (err) {
      next(ApiError.create(ApiErrs.INVALID_JSON_BODY));
    } else {
      next();
    }
  });
});

/* Non-Cookie Routes */
app.use('/oauth2', oAuthNoCookieRouter);
app.use('/uploads', uploadsNoCookieRouter);

app.use((req, res, next) => {
  res.locals.sendJSON = false;
  next();
});

// Optional: Serving static files too
if (cfg.web.serveStatic) {
  app.use(express.static(joinPath(__dirname, '..', 'resources', 'web', 'static')));
}

/* Prepare Request (calling the other middlewares) */
app.use(express.urlencoded({extended: false}));
app.use(express.raw({type: ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'], limit: '3MB'}));
app.use(cookieParser());
app.use(expressSession({
  name: 'sessID',
  store: new (expressSessionPG(expressSession))({
    tableName: 'sessions',
    pruneSessionInterval: 60 * 60 * 24, /* 24h */
    pool: new dbUtils({
      host: dbCfg.host,
      port: dbCfg.port,
      ssl: dbCfg.ssl,
      connectionPoolSize: 12,

      user: dbCfg.user,
      password: dbCfg.password,
      database: dbCfg.database
    }).getPool() ?? undefined
  }),
  secret: cfg.secret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  unset: 'destroy',
  cookie: {secure: cfg.cookies.secure, httpOnly: true, sameSite: 'lax', maxAge: 60 * 24 * 60 * 60 * 1000 /* 60d */}
}));

// Determine language to use
app.use((req, res, next) => {
  res.locals.lang = getLocalization().defaultLanguage;

  const redirect = req.method == 'GET';

  if (req.url.match(/^\/[a-z]{2}(\/|$)/gi)) {
    const langKey = req.url.substring(1, 3);

    if (getLocalization().isAvailable(langKey)) {
      res.locals.lang = langKey;
      res.cookie('lang', res.locals.lang, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: cfg.cookies.secure,
        maxAge: 12 * 30 * 24 * 60 * 60 * 1000 /* 12mo */
      });

      req.url = req.url.length == 3 ? '/' : req.url.substring(3);
    }
  } else if (req.cookies.lang) {
    const langKey = req.cookies.lang;

    if (typeof langKey == 'string' &&
        langKey != getLocalization().defaultLanguage &&
        getLocalization().isAvailable(langKey)) {
      return redirect ? res.redirect(pageGenerator.globals.url.base + '/' + langKey + stripLangKeyFromURL(req.originalUrl)) : next();
    }
  } else {
    const acceptedLanguages = req.header('Accept-Language');

    if (typeof acceptedLanguages == 'string') {
      for (const arg of acceptedLanguages.split(',')) {
        const langKey = arg.split(';')[0].substring(0, 2).toLowerCase();

        if (getLocalization().isAvailable(langKey)) {
          if (getLocalization().defaultLanguage == langKey) break;

          return redirect ? res.redirect(pageGenerator.globals.url.base + '/' + langKey + stripLangKeyFromURL(req.originalUrl)) : next();
        }
      }
    }
  }

  next();
});

/* Try fulfilling request */

// Handle all the basic pages (index.html, legal.html, ...)
app.use(staticPagesRouter);

app.use('/oauth2', oAuthRouter);
app.use('/login', loginRouter);
app.use('/logout', logoutRouter);
app.use('/settings', settingsRouter);
app.use('/uploads', uploadsRouter);
app.use('/demo', demoRouter);

/* Error handling */
app.use((req, _res, next) => {
  next(ApiError.create(ApiErrs.NOT_FOUND, {url: `${req.protocol}://${req.hostname}/${req.originalUrl}`}));
});

app.use((errRaw: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  let err;

  if (errRaw == undefined) {
    err = new ApiError(500, 'The error handler has been called without providing an error', true,
        {
          typeof: typeof errRaw,
          err: errRaw
        });
  } else if (typeof errRaw != 'object' || !(errRaw instanceof Error)) {
    err = new ApiError(500, 'The error handler has been called with an invalid error', true,
        {
          typeof: typeof errRaw,
          errRaw
        });
  } else if (!(errRaw instanceof ApiError)) {
    err = ApiError.fromError(errRaw);
  } else {
    err = errRaw;
  }

  if (res.headersSent) return next(err);  // Calls express default handler

  res.status(err.httpCode)
      .send(
          res.locals.sendJSON ?
              {error: err.httpCode, message: err.message} :
              `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Error ${err.httpCode}</title></head><body><h1>${err.httpCode} - ${err.message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>\n')}</h1></body></html>`);
  // TODO: Send html based on templates
});
// TODO: Set caching headers on routes
