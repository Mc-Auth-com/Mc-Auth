import { Router } from 'express';

import { pageGenerator } from '..';
import { getReturnURL, restful } from '../utils/_old_utils';

const router = Router();
export const logoutRouter = router;

router.all('/', (req, res, next) => {
  restful(req, res, next, {
    get: () => {
      if (!req.session) return res.redirect(getReturnURL(req) ?? pageGenerator.globals.url.base);

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
          secure: cookie.secure
        });

        // Redirect User-Agent
        return res.redirect(getReturnURL(req) ?? pageGenerator.globals.url.base);
      });
    }
  });
});
