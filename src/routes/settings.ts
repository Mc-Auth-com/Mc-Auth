import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { post as httpPost } from 'superagent';

import { db, cfg, getSecret, mailer, pageGenerator } from '..';
import { PageTemplate } from '../dynamicPageGenerator';
import { restful, stripLangKeyFromURL, isNumber, toNeutralString, isHttpURL, isValidEmail } from '../utils/utils';
import { ApiError, ApiErrs } from '../utils/errors';

const router = Router();
export const settingsRouter = router;

router.all('/', (req, res, next) => {
  restful(req, res, next, {
    get: () => res.redirect(`${pageGenerator.globals.url.base}/settings/account`)
  });
});

router.all('/confirm-email/:token', (req, res, next) => {
  jwt.verify(req.params.token, getSecret(256), { algorithms: ['HS256'] }, (err, data: any) => {
    if (err || data instanceof Buffer ||
      !data || !data.id || !data.email) return next(ApiError.create(ApiErrs.INVALID_OR_EXPIRED_MAIL_CONFIRMATION));

    db.getAccount(data.id)
      .then((account) => {
        if (!account || !account.emailPending ||
          account.emailPending.toLowerCase() != data.email.toLowerCase()) return next(ApiError.create(ApiErrs.INVALID_OR_EXPIRED_MAIL_CONFIRMATION, { account, data }));

        db.setAccountEmailAddress(data.id, data.email)
          .then(() => {
            if (account.email) {
              // TODO: Send information mail to old email
            }

            res.send('Your email has been successfully updated'); // TODO: Send html
          })
          .catch(next);
      })
      .catch(next);
  });
});

router.all('/account', (req, res, next) => {
  restful(req, res, next, {
    get: () => {
      if (!req.session?.loggedIn) return res.redirect(`${pageGenerator.globals.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

      db.getAccount(req.session?.mcProfile.id)
        .then((account) => {
          if (!account) return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR, { 'req.session?.mcProfile.id': req.session?.mcProfile.id }));

          res.type('html')
            .send(pageGenerator.renderPage(PageTemplate.SETTINGS_ACCOUNT, req, res, { account }));
        })
        .catch(next);
    },
    post: () => {
      if (req.body.updateMail == '1' && req.body.mailAddr) {
        if (!isValidEmail(req.body.mailAddr)) return next(new ApiError(400, 'Invalid email address', true, { body: req.body.mailAddr }));

        db.getAccount(req.session?.mcProfile.id)
          .then((account) => {
            if (!account) return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR, { 'req.session?.mcProfile.id': req.session?.mcProfile.id }));
            if (account.email?.toLowerCase() == req.body.mailAddr.toLowerCase()) return res.redirect(`${pageGenerator.globals.url.base}/settings/account`);  // nothing changed

            db.setAccountPendingEmailAddress(req.session?.mcProfile.id, req.body.mailAddr)
              .then(() => {
                mailer.sendConfirmEmail(account, req.body.mailAddr, res.locals.lang)
                  .then(() => {
                    res.redirect(`${pageGenerator.globals.url.base}/settings/account`);
                  })
                  .catch(next);
              })
              .catch(next);
          })
          .catch(next);
      } else {
        return next(new ApiError(400, 'Invalid request body', false, { body: req.body }));
      }
    }
  });
});

router.all('/security', (req, res, next) => {
  restful(req, res, next, {
    get: () => {
      if (!req.session?.loggedIn) return res.redirect(`${pageGenerator.globals.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

      res.type('html')
        .send(pageGenerator.renderPage(PageTemplate.SETTINGS_SECURITY, req, res));
    },
    // post: () => { } // TODO
  });
});

router.all('/notifications', (req, res, next) => {
  restful(req, res, next, {
    get: () => {
      if (!req.session?.loggedIn) return res.redirect(`${pageGenerator.globals.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

      res.type('html')
        .send(pageGenerator.renderPage(PageTemplate.SETTINGS_NOTIFICATIONS, req, res));
    },
    // post: () => { } // TODO
  });
});

router.all('/apps/create', (req, res, next) => {
  restful(req, res, next, {
    get: () => {
      if (!req.session?.loggedIn) return res.redirect(`${pageGenerator.globals.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

      res.type('html')
        .send(pageGenerator.renderPage(PageTemplate.SETTINGS_APPS_CREATE, req, res));
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
      if (!isHttpURL(toNeutralString(appWebsite))) return next(new ApiError(400, 'Application website is not a valid URL', false, { body: req.body }));

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
            .then((app) => res.redirect(`${pageGenerator.globals.url.base}/settings/apps/${app.id}`))
            .catch(next);
        });
    }
  });
});

router.all('/apps/:appID?', (req, res, next) => {
  const appID = req.params.appID || null;

  restful(req, res, next, {
    get: () => {
      if (!req.session?.loggedIn) return res.redirect(`${pageGenerator.globals.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

      if (appID == null) {
        db.getApps(req.session.mcProfile.id)
          .then((apps) => {
            res.type('html')
              .send(pageGenerator.renderPage(PageTemplate.SETTINGS_APPS, req, res, { apps }));
          })
          .catch(next);
      } else if (isNumber(appID)) {
        db.getApp(appID)
          .then((app) => {
            if (!app || app.deleted) return next(ApiError.create(ApiErrs.UNKNOWN_APPLICATION));
            if (app.owner != req.session?.mcProfile.id) return next(ApiError.create(ApiErrs.FORBIDDEN));

            res.type('html')
              .send(pageGenerator.renderPage(PageTemplate.SETTINGS_APPS_APP, req, res, { apps: [app] }));
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
          } else if (req.body.deleteApp == '1') {
            let otp = req.body.deleteAppOTP;

            if (typeof otp != 'string' ||
              !isNumber(otp = otp.replace(/ /g, ''))) return next(new ApiError(400, 'Invalid One-Time-Password', false, { appID: app.id, otp }));

            db.invalidateOneTimePassword(app.owner, otp)
              .then((valid) => {
                if (!valid) return next(new ApiError(400, 'Invalid One-Time-Password', false, { appID: app.id, otp }));

                db.setAppDeleted(app.id)
                  .then(() => {
                    res.redirect(`${pageGenerator.globals.url.base}/settings/apps`)
                  })
                  .catch(next);
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
                res.redirect(`${pageGenerator.globals.url.base}/settings/apps/${app.id}`);
              })
              .catch(next);
          }
        })
        .catch(next);
    }
  });
});