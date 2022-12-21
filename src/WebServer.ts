import expressSessionPG from 'connect-pg-simple';
import cookieParser from 'cookie-parser';
import express, { Express } from 'express';
import expressSession from 'express-session';
import morgan from 'morgan';
import { join as joinPath } from 'path';

import { dbCfg, webAccessLogStream } from '.';
import { getCfg, getPageGenerator } from './Constants';
import { getLocalization } from './Localization';
import { createApiRouter } from './Router/ApiRouter';
import DemoRouter from './Router/DemoRouter';
import LoginRouter from './Router/LoginRouter';
import LogoutRouter from './Router/LogoutRouter';
import OAuthRouter from './Router/OAuthRouter';
import SettingsRouter from './Router/SettingsRouter';
import StaticPagesRouter from './Router/StaticPagesRouter';
import UploadsRouter from './Router/UploadsRouter';
import { stripLangKeyFromURL } from './utils/_old_utils';
import { ApiError } from './utils/ApiError';
import ApiErrs from './utils/ApiErrs';
import { DbUtils } from './utils/DbUtils';

export default class WebServer {
  static createWebServer(): Express {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', getCfg().data.trustProxy);

    app.use((req, res, next) => {
      res.locals.sendJSON = true;
      next();
    });

    /* Logging webserver request */
    app.use(morgan(getCfg().data.logging.accessLogFormat, {stream: webAccessLogStream}));
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
    app.use(express.urlencoded({extended: false, parameterLimit: 100}));

    /* Non-Cookie Routes */
    app.use('/oauth2', OAuthRouter.createNonAuthorizedRouter());
    app.use('/uploads', UploadsRouter.createNonAuthorizedRouter());

    app.use((req, res, next) => {
      res.locals.sendJSON = false;
      next();
    });

    // Optional: Serving static files too
    if (getCfg().data.web.serveStatic) {
      app.use(express.static(joinPath(__dirname, '..', 'resources', 'web', 'static')));
    }


    /* Prepare Request (calling the other middlewares) */
    app.use(express.raw({type: ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'], limit: '3MB'}));
    app.use(cookieParser());
    app.use(expressSession({
      name: 'sessID',
      store: new (expressSessionPG(expressSession))({
        tableName: 'sessions',
        pruneSessionInterval: 60 * 60 * 24, /* 24h */
        pool: new DbUtils({
          host: dbCfg.data.host,
          port: dbCfg.data.port,
          ssl: dbCfg.data.ssl,
          connectionPoolSize: 12,

          user: dbCfg.data.user,
          password: dbCfg.data.password,
          database: dbCfg.data.database
        }).getPool() ?? undefined
      }),
      secret: getCfg().data.secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      unset: 'destroy',
      cookie: {
        secure: getCfg().data.cookies.secure,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 24 * 60 * 60 * 1000 /* 60d */
      }
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
            secure: getCfg().data.cookies.secure,
            maxAge: 12 * 30 * 24 * 60 * 60 * 1000 /* 12mo */
          });

          req.url = req.url.length == 3 ? '/' : req.url.substring(3);
        }
      } else if (req.cookies.lang) {
        const langKey = req.cookies.lang;

        if (typeof langKey == 'string' &&
            langKey != getLocalization().defaultLanguage &&
            getLocalization().isAvailable(langKey)) {
          return redirect ? res.redirect(getPageGenerator().globals.url.base + '/' + langKey + stripLangKeyFromURL(req.originalUrl)) : next();
        }
      } else {
        const acceptedLanguages = req.header('Accept-Language');

        if (typeof acceptedLanguages == 'string') {
          for (const arg of acceptedLanguages.split(',')) {
            const langKey = arg.split(';')[0].substring(0, 2).toLowerCase();

            if (getLocalization().isAvailable(langKey)) {
              if (getLocalization().defaultLanguage == langKey) break;

              return redirect ? res.redirect(getPageGenerator().globals.url.base + '/' + langKey + stripLangKeyFromURL(req.originalUrl)) : next();
            }
          }
        }
      }

      next();
    });

    /* Try fulfilling request */

    // Handle all the basic pages (index.html, legal.html, ...)
    app.use(StaticPagesRouter.createRouter());

    app.use('/api', createApiRouter());
    app.use('/oauth2', OAuthRouter.createAuthorizedRouter());
    app.use('/login', LoginRouter.createRouter());
    app.use('/logout', LogoutRouter.createRouter());
    app.use('/settings', SettingsRouter.createRouter());
    app.use('/uploads', UploadsRouter.createAuthorizedRouter());
    app.use('/demo', DemoRouter.createRouter());

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

    return app;
  }
}
