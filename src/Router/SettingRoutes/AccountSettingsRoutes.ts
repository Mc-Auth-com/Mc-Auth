import StringValidators from '@spraxdev/node-commons/dist/strings/StringValidators';
import { Router } from 'express';
import { getPageGenerator } from '../../Constants';
import { PageTemplate } from '../../DynamicPageGenerator';
import { db, mailer } from '../../index';
import {  stripLangKeyFromURL } from '../../utils/_old_utils';
import { ApiError } from '../../utils/ApiError';
import ApiErrs from '../../utils/ApiErrs';
import { handleRequestRestfully } from '@spraxdev/node-commons';

export default class AccountSettingsRoutes {
  static addRoutes(router: Router): void {
    router.all('/account', (req, res, next) => {
      handleRequestRestfully(req, res, next, {
        get: () => {
          if (!req.session?.loggedIn) return res.redirect(`${getPageGenerator().globals.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);
          if (!req.session?.mcProfile?.id) return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR, {'req.session?.mcProfile?.id': req.session?.mcProfile?.id}));

          db.getAccount(req.session?.mcProfile?.id)
              .then((account) => {
                if (!account) return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR, {'req.session?.mcProfile?.id': req.session?.mcProfile?.id}));

                res.type('html')
                    .send(getPageGenerator().renderPage(PageTemplate.SETTINGS_ACCOUNT, req, res, {account}));
              })
              .catch(next);
        },

        post: () => {
          if (req.body.updateMail == '1' && req.body.mailAddr) {
            if (!req.session?.mcProfile?.id) return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR, {'req.session?.mcProfile?.id': req.session?.mcProfile?.id}));
            if (!StringValidators.looksLikeValidEmail(req.body.mailAddr)) return next(new ApiError(400, 'Invalid email address', true, {body: req.body.mailAddr}));

            db.getAccount(req.session?.mcProfile?.id)
                .then((account) => {
                  if (!account || !req.session?.mcProfile?.id) return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR, {'req.session?.mcProfile?.id': req.session?.mcProfile?.id}));
                  if (account.email?.toLowerCase() == req.body.mailAddr.toLowerCase()) return res.redirect(`${getPageGenerator().globals.url.base}/settings/account`);  // nothing changed

                  db.setAccountPendingEmailAddress(req.session?.mcProfile?.id, req.body.mailAddr)
                      .then(() => {
                        mailer.sendConfirmEmail(account, req.body.mailAddr, res.locals.lang)
                            .then(() => {
                              res.redirect(`${getPageGenerator().globals.url.base}/settings/account`);
                            })
                            .catch(next);
                      })
                      .catch(next);
                })
                .catch(next);
          } else {
            return next(new ApiError(400, 'Invalid request body', false, {body: req.body}));
          }
        }
      });
    });
  }
}
