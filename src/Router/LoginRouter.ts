import {StringUtils} from '@spraxdev/node-commons';
import { Router } from 'express';
import { getMinecraftApi, getPageGenerator } from '../Constants';
import { PageTemplate } from '../DynamicPageGenerator';
import { db } from '../index';
import { getReturnURL } from '../utils/_old_utils';
import { ApiError } from '../utils/ApiError';
import handleRequestRestfully from '../utils/old-node-commons/RestfulRequestHandler';

export default class LoginRouter {
  static createRouter(): Router {
    const router = Router();

    router.all('/', (req, res, next) => {
      handleRequestRestfully(req, res, next, {
        get: () => {
          if (req.session?.loggedIn) return res.redirect(getReturnURL(req) ?? getPageGenerator().globals.url.base);

          res.type('html')
              .send(getPageGenerator().renderPage(PageTemplate.LOGIN, req, res));
        },
        post: () => {
          const username: string | undefined = req.body.username,
              keepLoggedIn: boolean = typeof req.body.keepLogin == 'string' && req.body.keepLogin == 'on';
          let otp: string | undefined = req.body.otp; // valid otp may have up to 1 space: '### ###'

          if (typeof username != 'string' || username.length > 16) return next(new ApiError(401, 'You have to provide a valid username', false, {body: req.body}));
          if (typeof otp != 'string' || (otp = otp.replace(/ /, '')).length != 6 || !StringUtils.default.isNumeric(otp)) return next(new ApiError(401, 'Invalid One-Time-Password', false, {body: req.body}));

          getMinecraftApi().getProfile(username)
              .then(async (profile: any /* FIXME: type */): Promise<void> => {
                if (profile) db.updateAccount(profile.id, profile.name); // non-blocking

                const success = profile != null && await db.invalidateOneTimePassword(profile.id, otp as string);

                if (!success) return next(new ApiError(400, 'Username or One-Time-Password do not match', false, {
                  username,
                  otp,
                  keepLoggedIn,
                  profile
                }));
                if (req.session == undefined) return next(new ApiError(500, 'Session could be initialized', true, {
                  originalUrl: req.originalUrl,
                  username
                }));

                if (!keepLoggedIn) {
                  req.session.cookie.expires = undefined; // Should delete the cookie when terminating the User-Agent process
                }

                req.session.loggedIn = true;
                req.session.mcProfile = {
                  id: profile.id,
                  name: profile.name  // TODO: update periodically
                };

                req.session.save(() => {
                  return res.redirect(getReturnURL(req) ?? getPageGenerator().globals.url.base);
                });
              })
              .catch(next);
        }
      });
    });

    return router;
  }
}
