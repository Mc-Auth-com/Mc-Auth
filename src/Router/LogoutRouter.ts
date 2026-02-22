import { Router } from 'express';
import { getPageGenerator } from '../Constants';
import { getReturnURL } from '../utils/_old_utils';
import handleRequestRestfully from '../utils/old-node-commons/RestfulRequestHandler';

export default class LogoutRouter {
  static createRouter(): Router {
    const router = Router();

    router.all('/', (req, res, next) => {
      handleRequestRestfully(req, res, next, {
        get: () => {
          if (!req.session) return res.redirect(getReturnURL(req) ?? getPageGenerator().globals.url.base);

          // Store cookie properties for manual deletion
          const cookie = req.session.cookie;
          cookie.maxAge = 0;

          // Destroy session
          req.session.destroy((err) => {
            if (err) return next(err);

            // Delete cookie
            res.clearCookie('sessID', {
              domain: cookie.domain,
              httpOnly: cookie.httpOnly,
              maxAge: 0,
              path: cookie.path,
              sameSite: cookie.sameSite,
              secure: cookie.secure == 'auto' ? req.secure : cookie.secure
            });

            // Redirect User-Agent
            return res.redirect(getReturnURL(req) ?? getPageGenerator().globals.url.base);
          });
        }
      });
    });

    return router;
  }
}
