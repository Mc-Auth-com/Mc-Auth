import { Router } from 'express';
import { post as httpPost } from 'superagent';

import { db, cfg } from '..';
import { global, PageParts, renderPage } from '../dynamicPageGenerator';
import { restful, stripLangKeyFromURL, isNumber, toNeutralString, isHttpURL } from '../utils/utils';
import { ApiError, ApiErrs } from '../utils/errors';

const router = Router();
export const settingsRouter = router;

router.all('/', (req, res, next) => {
  restful(req, res, next, {
    get: () => res.redirect(`${global.url.base}/settings/account`)
  });
});

router.all('/account', (req, res, next) => {
  restful(req, res, next, {
    get: () => {
      if (!req.session?.loggedIn) return res.redirect(`${global.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

      res.type('html')
        .send(renderPage(PageParts.SETTINGS_ACCOUNT, req, res));
    },
    // post: () => { } // TODO
  });
});

router.all('/security', (req, res, next) => {
  restful(req, res, next, {
    get: () => {
      if (!req.session?.loggedIn) return res.redirect(`${global.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

      res.type('html')
        .send(renderPage(PageParts.SETTINGS_SECURITY, req, res));
    },
    // post: () => { } // TODO
  });
});

router.all('/notifications', (req, res, next) => {
  restful(req, res, next, {
    get: () => {
      if (!req.session?.loggedIn) return res.redirect(`${global.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

      res.type('html')
        .send(renderPage(PageParts.SETTINGS_NOTIFICATIONS, req, res));
    },
    // post: () => { } // TODO
  });
});

router.all('/apps/create', (req, res, next) => {
  restful(req, res, next, {
    get: () => {
      if (!req.session?.loggedIn) return res.redirect(`${global.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

      res.type('html')
        .send(renderPage(PageParts.SETTINGS_APPS_CREATE, req, res));
    },
    post: () => {
      if (cfg.reCAPTCHA.private.length == 0) return next(ApiError.create(ApiErrs.NO_RECAPTCHA));
      if (!req.session?.loggedIn) return next(ApiError.create(ApiErrs.UNAUTHORIZED));

      const appName = req.body.name,
        appWebsite = req.body.website,
        appDesc = req.body.description ?? '',
        captcha = req.body['g-recaptcha-response'];

      /* User input validation */
      if (typeof appName != 'string' || appName.trim().length == 0) return next(new ApiError(400, 'Missing application name', false, { body: req.body }));
      if (toNeutralString(appName).length > 128) return next(new ApiError(400, 'Application name exceeds 128 characters', false, { body: req.body }));

      if (typeof appWebsite != 'string' || appWebsite.trim().length == 0) return next(new ApiError(400, 'Missing application website', false, { body: req.body }));
      if (toNeutralString(appWebsite).length > 512) return next(new ApiError(400, 'Application website exceeds 512 characters', false, { body: req.body }));
      if (isHttpURL(toNeutralString(appWebsite))) return next(new ApiError(400, 'Application website is not a valid URL', false, { body: req.body }));

      if (typeof appDesc != 'string') return next(new ApiError(400, 'Invalid application description', false, { body: req.body }));
      if (toNeutralString(appDesc).length > 512) return next(new ApiError(400, 'Application description exceeds 512 characters', false, { body: req.body }));

      if (typeof captcha != 'string' || captcha.length == 0) return next(new ApiError(400, 'reCAPTCHA failed', false, { body: req.body }));


      // Check if reCAPTCHA has been solved
      httpPost('https://www.google.com/recaptcha/api/siteverify')
        .field('secret', cfg.reCAPTCHA.private)
        .field('response', captcha)
        .end((err, httpRes) => {
          if (err) return next(err);

          if (httpRes.body?.success != true) return next(new ApiError(400, 'reCAPTCHA failed', false, { body: req.body, reCAPTCHA_body: httpRes.body }));

          db.createApp(req.session?.mcProfile.id, toNeutralString(appName), toNeutralString(appWebsite), toNeutralString(appDesc) || null)
            .then((app) => res.redirect(`${global.url.base}/settings/apps/${app.id}`))
            .catch(next);
        });
    }
  });
});

router.all('/apps/:appID?', (req, res, next) => {
  const appID = req.params.appID || null;

  restful(req, res, next, {
    get: () => {
      if (!req.session?.loggedIn) return res.redirect(`${global.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

      if (appID == null) {
        db.getApps(req.session.mcProfile.id)
          .then((apps) => {
            res.type('html')
              .send(renderPage(PageParts.SETTINGS_APPS, req, res, { apps }));
          })
          .catch(next);
      } else if (isNumber(appID)) {
        db.getApp(appID)
          .then((app) => {
            if (!app || app.deleted) return next(ApiError.create(ApiErrs.UNKNOWN_APPLICATION));
            if (app.owner != req.session?.mcProfile.id) return next(ApiError.create(ApiErrs.FORBIDDEN));

            res.type('html')
              .send(renderPage(PageParts.SETTINGS_APPS_APP, req, res, { apps: [app] }));
          })
          .catch(next);
      } else {
        return next(ApiError.create(ApiErrs.NOT_FOUND));
      }
    },
    post: () => {
      if (!req.session?.loggedIn) return next(ApiError.create(ApiErrs.UNAUTHORIZED));

      if (typeof appID != 'string' || !isNumber(appID)) return next(ApiError.create(ApiErrs.UNKNOWN_APPLICATION));

      db.getApp(appID)
        .then(async (app) => {
          if (!app || app.deleted) return next(ApiError.create(ApiErrs.UNKNOWN_APPLICATION));
          if (app.owner != req.session?.mcProfile.id) return next(ApiError.create(ApiErrs.FORBIDDEN));

          if (req.body.regenerateSecret == true) {
            db.regenerateAppSecret(app.id)
              .then((secret) => {
                if (!secret) return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR, { appID: app.id }));

                return res.send({ secret });
              })
              .catch(next);
          } else {
            const appName = req.body.name,
              appWebsite = req.body.website,
              appDesc = req.body.description,
              iconID = req.body.icon,
              rawRedirectURIs = req.body.redirect_uris;
            let redirectURIs: string[] = [];

            /* User input validation */
            if (typeof appName != 'string' || appName.trim().length == 0) return next(new ApiError(400, 'Missing application name', false, { body: req.body }));
            if (toNeutralString(appName).length > 128) return next(new ApiError(400, 'Application name exceeds 128 characters', false, { body: req.body }));

            if (typeof appWebsite != 'string' || appWebsite.trim().length == 0) return next(new ApiError(400, 'Missing application website', false, { body: req.body }));
            if (toNeutralString(appWebsite).length > 512) return next(new ApiError(400, 'Application website exceeds 512 characters', false, { body: req.body }));
            if (!isHttpURL(toNeutralString(appWebsite))) return next(new ApiError(400, 'Application website is not a valid URL', false, { body: req.body }));

            if (typeof appDesc != 'string') return next(new ApiError(400, 'Invalid application description', false, { body: req.body }));
            if (toNeutralString(appDesc).length > 512) return next(new ApiError(400, 'Application description exceeds 512 characters', false, { body: req.body }));

            if (typeof iconID != 'string' || (iconID.length != 0 && !isNumber(iconID))) return next(new ApiError(400, 'Invalid iconID', false, { body: req.body }));

            if (typeof rawRedirectURIs != 'string') return next(new ApiError(400, 'Invalid redirectURI', false, { body: req.body }));
            for (let uri of rawRedirectURIs.split(/\r?\n/)) {
              uri = toNeutralString(uri);

              if (uri.length == 0) continue;
              if (!isHttpURL(uri)) return next(new ApiError(400, `Invalid redirectURI: ${uri}`));

              if (!redirectURIs.includes(uri)) {
                redirectURIs.push(uri);
              }
            }

            try {
              if (iconID.length != 0 && !(await db.doesIconExist(iconID))) return next(new ApiError(400, 'Invalid iconID'));
            } catch (err) {
              return next(err);
            }

            // Update app
            const descLines: string[] = appDesc.trim().split(/\r?\n/);
            descLines.forEach(toNeutralString);

            db.setApp(app.id, toNeutralString(appName), toNeutralString(appWebsite), redirectURIs, descLines.join('\n') || null, iconID || null)
              .then(() => {
                res.redirect(`${global.url.base}/settings/apps/${app.id}`);
              })
              .catch(next);
          }
        })
        .catch(next);
    }
  });
});