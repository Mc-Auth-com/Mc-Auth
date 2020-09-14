import express from 'express';
import expressSession from 'express-session';
import expressSessionPG from 'connect-pg-simple';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { join as joinPath } from 'path';

import { cfg, webAccessLogStream, dbCfg } from '.';
import { ApiError, ApiErrs } from './utils/errors';
import { loginRouter } from './routes/login';
import { oAuthNoCookieRouter, oAuthRouter } from './routes/oAuth';
import { staticPagesRouter } from './routes/staticPages';
import { global } from './dynamicPageGenerator';
import { stripLangKeyFromURL } from './utils/utils';
import { getLocalization } from './localization';
import { logoutRouter } from './routes/logout';
import { dbUtils } from './utils/database';
import { settingsRouter } from './routes/settings';
import { uploadsRouter, uploadsNoCookieRouter } from './routes/uploads';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', cfg.trustProxy);

/* Logging webserver request */
app.use(morgan(cfg.logging.accessLogFormat, { stream: webAccessLogStream }));
if (process.env.NODE_ENV == 'production') {
  app.use(morgan('dev', { skip: (_req, res) => res.statusCode < 500 }));
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
app.use(express.json());

/* Non-Cookie Routes */
app.use('/oauth2', oAuthNoCookieRouter);
app.use('/uploads', uploadsNoCookieRouter);

// Optional: Serving static files too
if (cfg.web.serveStatic) {
  app.use(express.static(joinPath(__dirname, '..', 'resources', 'web', 'static')));
}

/* Prepare Request (calling the other middlewares) */
app.use(express.urlencoded({ extended: false }));
app.use(express.raw({ type: ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'], limit: '3MB' }));
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
  secret: cfg.cookies.secret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  unset: 'destroy',
  cookie: { secure: cfg.cookies.secure, httpOnly: true, sameSite: 'strict', maxAge: 60 * 24 * 60 * 60 * 1000 /* 60d */ }
}));

// Determin language to use
app.use((req, res, next) => {
  res.locals.lang = getLocalization().defaultLanguage;

  const redirect = req.method == 'GET';

  if (req.url.match(/^\/[a-z]{2}(\/|$)/gi)) {
    const langKey = req.url.substring(1, 3);

    if (getLocalization().isAvailable(langKey)) {
      res.locals.lang = langKey;
      res.cookie('lang', res.locals.lang, { httpOnly: true, path: '/', sameSite: 'strict', secure: cfg.cookies.secure, maxAge: 12 * 30 * 24 * 60 * 60 * 1000 /* 12mo */ });

      req.url = req.url.length == 3 ? '/' : req.url.substring(3);
    }
  } else if (req.cookies.lang) {
    const langKey = req.cookies.lang;

    if (typeof langKey == 'string' &&
      langKey != getLocalization().defaultLanguage &&
      getLocalization().isAvailable(langKey)) {
      return redirect ? res.redirect(global.url.base + '/' + langKey + stripLangKeyFromURL(req.originalUrl)) : next();
    }
  } else {
    const acceptedLanguages = req.header('Accept-Language');

    if (typeof acceptedLanguages == 'string') {
      for (const arg of acceptedLanguages.split(',')) {
        const langKey = arg.split(';')[0].substring(0, 2).toLowerCase();

        if (getLocalization().isAvailable(langKey)) {
          if (getLocalization().defaultLanguage == langKey) break;

          return redirect ? res.redirect(global.url.base + '/' + langKey + stripLangKeyFromURL(req.originalUrl)) : next();
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

/* Error handling */
app.use((req, _res, next) => {
  next(ApiError.create(ApiErrs.NOT_FOUND, { url: `${req.protocol}://${req.hostname}/${req.originalUrl}` }));
});

app.use((err: ApiError /* is 'any' or 'unknown' (using ApiError for IntelliSense etc.) */, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err == undefined || err == null) {
    err = new ApiError(500, 'The error handler has been called without providing an error', true, { typeof: typeof err, err });
  } else if (typeof err != 'object' || !(err instanceof Error)) {
    err = new ApiError(500, 'The error handler has been called with an invalid error', true, { typeof: typeof err, err });
  } else if (!(err instanceof ApiError)) {
    err = ApiError.fromError(err);
  }

  if (res.headersSent) return next(err);  // Calls express default handler

  res.status(err.httpCode)
    .send(
      res.locals.sendJSON ?
        { error: err.httpCode, message: err.message } :
        `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Error ${err.httpCode}</title></head><body><h1>${err.httpCode} - ${err.message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>\n')}</h1></body></html>`);
  // TODO: Send html based on templates
});

/* Original code below */

// // ToDo Set caching headers on routes

// /** dynamic **/
// app.use('/login', require('./routes/login'));
// app.use('/logout', require('./routes/logout'));
// app.use('/oauth2', require('./routes/oAuth2'));
// app.use('/settings', require('./routes/settings'));
// app.use('/uploads', require('./routes/uploads'));