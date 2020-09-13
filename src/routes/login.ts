import { Router } from 'express';

import { renderPage, PageParts, global } from '../dynamicPageGenerator';
import { restful, isNumber, getReturnURL } from '../utils/utils';
import { ApiError } from '../utils/errors';
import { db } from '..';
import { MojangAPI } from '../utils/spraxapi';

const router = Router();
export const loginRouter = router;

router.all('/', (req, res, next) => {
  restful(req, res, next, {
    get: () => {
      if (req.session?.loggedIn) return res.redirect(getReturnURL(req) ?? global.url.base);

      res.type('html')
        .send(renderPage(PageParts.LOGIN, req, res));
    },
    post: () => {
      const username: string | undefined = req.body.username,
        keepLoggedIn: boolean = typeof req.body.keepLogin == 'string' && req.body.keepLogin == 'on';
      let otp: string | undefined = req.body.otp; // valid otp may have up to 1 space: '### ###'

      if (typeof username != 'string' || username.length > 16) return next(new ApiError(401, 'You have to provide a valid username', false, { body: req.body }));
      if (typeof otp != 'string' || (otp = otp.replace(/ /, '')).length != 6 || !isNumber(otp)) return next(new ApiError(401, 'Invalid One-Time-Password', false, { body: req.body }));

      MojangAPI.getProfile(username)
        .then(async (profile: any /* FIXME TYPE */): Promise<void> => {
          const success = profile != null && await db.invalidateOneTimePassword(profile.id, otp as string);

          if (!success) return next(new ApiError(400, 'Username or One-Time-Passwort do not match', false, { username, otp, keepLoggedIn, profile }));
          if (req.session == undefined) return next(new ApiError(500, 'Session could be initialized', true, { originalUrl: req.originalUrl, username }));

          if (!keepLoggedIn) {
            req.session.cookie.expires = false; // Should delete the cookie when terminating the User-Agent process
          }

          req.session.loggedIn = true;
          req.session.mcProfile = {
            id: profile.id,
            name: profile.name
          };

          req.session.save(() => {
            return res.redirect(getReturnURL(req) ?? global.url.base);
          });
        })
        .catch(next);
    }
  });
});