import { Router } from 'express';
import { getPageGenerator } from '../../Constants';
import { PageTemplate } from '../../DynamicPageGenerator';
import { db } from '../../index';
import { restful, stripLangKeyFromURL } from '../../utils/_old_utils';
import { ApiError } from '../../utils/ApiError';
import ApiErrs from '../../utils/ApiErrs';
import Utils from '../../utils/Utils';

export default class AppEditRoutes {
  static addRoutes(router: Router): void {
    router.all<{ appID?: string }>('/apps/:appID?', (req, res, next) => {
      const appID = req.params['appID'] || null;

      restful(req, res, next, {
        get: () => {
          if (!req.session?.loggedIn) return res.redirect(`${getPageGenerator().globals.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);
          if (!req.session?.mcProfile?.id) return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR, {'req.session?.mcProfile?.id': req.session?.mcProfile?.id}));

          if (appID == null) {
            db.getApps(req.session?.mcProfile?.id)
                .then((apps) => {
                  res.type('html')
                      .send(getPageGenerator().renderPage(PageTemplate.SETTINGS_APPS, req, res, {apps}));
                })
                .catch(next);
          } else if (Utils.isNumeric(appID)) {
            db.getApp(appID)
                .then((app) => {
                  if (!app || app.deleted) return next(ApiError.create(ApiErrs.UNKNOWN_APPLICATION));
                  if (app.owner != req.session?.mcProfile?.id) return next(ApiError.create(ApiErrs.FORBIDDEN));

                  res.type('html')
                      .send(getPageGenerator().renderPage(PageTemplate.SETTINGS_APPS_APP, req, res, {apps: [app]}));
                })
                .catch(next);
          } else {
            return next(ApiError.create(ApiErrs.NOT_FOUND));
          }
        },
        post: () => {
          if (!req.session?.loggedIn) return next(ApiError.create(ApiErrs.UNAUTHORIZED));

          if (typeof appID != 'string' || !Utils.isNumeric(appID)) return next(ApiError.create(ApiErrs.UNKNOWN_APPLICATION));

          db.getApp(appID)
              .then(async (app) => {
                if (!app || app.deleted) return next(ApiError.create(ApiErrs.UNKNOWN_APPLICATION));
                if (app.owner != req.session?.mcProfile?.id) return next(ApiError.create(ApiErrs.FORBIDDEN));

                if (req.body.regenerateSecret == true) {
                  db.regenerateAppSecret(app.id)
                      .then((secret) => {
                        if (!secret) return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR, {appID: app.id}));

                        return res.send({secret});
                      })
                      .catch(next);
                } else if (req.body.deleteApp == '1') {
                  let otp = req.body.deleteAppOTP;

                  if (typeof otp != 'string' ||
                      !Utils.isNumeric(otp = otp.replace(/ /g, ''))) return next(new ApiError(400, 'Invalid One-Time-Password', false, {
                    appID: app.id,
                    otp
                  }));

                  db.invalidateOneTimePassword(app.owner, otp)
                      .then((valid) => {
                        if (!valid) return next(new ApiError(400, 'Invalid One-Time-Password', false, {
                          appID: app.id,
                          otp
                        }));

                        db.setAppDeleted(app.id)
                            .then(() => {
                              res.redirect(`${getPageGenerator().globals.url.base}/settings/apps`);
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
                  if (typeof appName != 'string' || appName.trim().length == 0) return next(new ApiError(400, 'Missing application name', false, {body: req.body}));
                  if (Utils.normalizeWhitespaceChars(appName).length > 128) return next(new ApiError(400, 'Application name exceeds 128 characters', false, {body: req.body}));

                  if (typeof appWebsite != 'string' || appWebsite.trim().length == 0) return next(new ApiError(400, 'Missing application website', false, {body: req.body}));
                  if (Utils.normalizeWhitespaceChars(appWebsite).length > 512) return next(new ApiError(400, 'Application website exceeds 512 characters', false, {body: req.body}));
                  if (!Utils.looksLikeHttpUrl(Utils.normalizeWhitespaceChars(appWebsite))) return next(new ApiError(400, 'Application website is not a valid URL', false, {body: req.body}));

                  if (typeof appDesc != 'string') return next(new ApiError(400, 'Invalid application description', false, {body: req.body}));
                  if (Utils.normalizeWhitespaceChars(appDesc).length > 512) return next(new ApiError(400, 'Application description exceeds 512 characters', false, {body: req.body}));

                  if (typeof iconID != 'string' || (iconID.length != 0 && !Utils.isNumeric(iconID))) return next(new ApiError(400, 'Invalid iconID', false, {body: req.body}));

                  if (typeof rawRedirectURIs != 'string') return next(new ApiError(400, 'Invalid redirectURI', false, {body: req.body}));
                  for (let uri of rawRedirectURIs.split(/\r?\n/)) {
                    uri = Utils.normalizeWhitespaceChars(uri);

                    if (uri.length == 0) continue;
                    if (!Utils.looksLikeHttpUrl(uri)) return next(new ApiError(400, `Invalid redirectURI: ${uri}`));

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
                  descLines.forEach(Utils.normalizeWhitespaceChars);

                  db.setApp(app.id, Utils.normalizeWhitespaceChars(appName), Utils.normalizeWhitespaceChars(appWebsite), redirectURIs, descLines.join('\n') || null, iconID || null)
                      .then(() => {
                        res.redirect(`${getPageGenerator().globals.url.base}/settings/apps/${app.id}`);
                      })
                      .catch(next);
                }
              })
              .catch(next);
        }
      });
    });
  }
}
