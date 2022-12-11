import StringValidators from '@spraxdev/node-commons/dist/strings/StringValidators';
import { Router } from 'express';
import { getCfg, getHttpClient, getPageGenerator } from '../../Constants';
import { PageTemplate } from '../../DynamicPageGenerator';
import { db } from '../../index';
import { restful, stripLangKeyFromURL } from '../../utils/_old_utils';
import { ApiError } from '../../utils/ApiError';
import ApiErrs from '../../utils/ApiErrs';
import Utils from '../../utils/Utils';

export default class AppCreateRoutes {
  static addRoutes(router: Router): void {
    router.all('/apps/create', (req, res, next) => {
      restful(req, res, next, {
        get: () => {
          if (!req.session?.loggedIn) return res.redirect(`${getPageGenerator().globals.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

          res.type('html')
              .send(getPageGenerator().renderPage(PageTemplate.SETTINGS_APPS_CREATE, req, res));
        },
        post: () => {
          if (getCfg().data.reCAPTCHA.private.length == 0) return next(ApiError.create(ApiErrs.NO_RECAPTCHA));
          if (!req.session?.loggedIn) return next(ApiError.create(ApiErrs.UNAUTHORIZED));

          const appName = req.body.name,
              appWebsite = req.body.website,
              appDesc = req.body.description ?? '',
              captcha = req.body['g-recaptcha-response'];

          /* User input validation */
          if (typeof appName != 'string' || appName.trim().length == 0) return next(new ApiError(400, 'Missing application name', false, {body: req.body}));
          if (Utils.normalizeWhitespaceChars(appName).length > 128) return next(new ApiError(400, 'Application name exceeds 128 characters', false, {body: req.body}));

          if (typeof appWebsite != 'string' || appWebsite.trim().length == 0) return next(new ApiError(400, 'Missing application website', false, {body: req.body}));
          if (Utils.normalizeWhitespaceChars(appWebsite).length > 512) return next(new ApiError(400, 'Application website exceeds 512 characters', false, {body: req.body}));
          if (!StringValidators.looksLikeHttpUrl(Utils.normalizeWhitespaceChars(appWebsite))) return next(new ApiError(400, 'Application website is not a valid URL', false, {body: req.body}));

          if (typeof appDesc != 'string') return next(new ApiError(400, 'Invalid application description', false, {body: req.body}));
          if (Utils.normalizeWhitespaceChars(appDesc).length > 512) return next(new ApiError(400, 'Application description exceeds 512 characters', false, {body: req.body}));

          if (typeof captcha != 'string' || captcha.length == 0) return next(new ApiError(400, 'reCAPTCHA failed', false, {body: req.body}));

          const reCaptchaBody = `secret=${encodeURIComponent(getCfg().data.reCAPTCHA.private)}&response=${encodeURIComponent(captcha)}`;
          getHttpClient()
              .post('https://www.google.com/recaptcha/api/siteverify', {'Content-Type': 'application/x-www-form-urlencoded'}, reCaptchaBody)
              .then((httpRes) => {
                const recaptchaResponse = JSON.parse(httpRes.body.toString('utf-8'));
                if (recaptchaResponse.success != true) {
                  return next(new ApiError(400, 'reCAPTCHA failed', false, {
                    requestBody: req.body,
                    reCaptchaBody: recaptchaResponse
                  }));
                }

                if (!req.session?.mcProfile?.id) {
                  return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR, {'req.session?.mcProfile?.id': req.session?.mcProfile?.id}));
                }

                db.createApp(
                    req.session?.mcProfile?.id,
                    Utils.normalizeWhitespaceChars(appName),
                    Utils.normalizeWhitespaceChars(appWebsite),
                    Utils.normalizeWhitespaceChars(appDesc) || null
                )
                    .then((app) => res.redirect(`${getPageGenerator().globals.url.base}/settings/apps/${app.id}`))
                    .catch(next);
              })
              .catch(next);
        }
      });
    });
  }
}
