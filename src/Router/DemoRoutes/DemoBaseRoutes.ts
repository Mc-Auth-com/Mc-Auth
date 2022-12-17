import { handleRequestRestfully } from '@spraxdev/node-commons';
import { CookieOptions, Router } from 'express';
import jwt from 'jsonwebtoken';
import { getPageGenerator } from '../../Constants';
import { PageTemplate } from '../../DynamicPageGenerator';
import { getPartOfSecret } from '../../utils/_old_utils';

export default class DemoBaseRoutes {
  static addRoutes(router: Router, cookieOptions: CookieOptions): void {
    router.all('/', (req, res, next) => {
      handleRequestRestfully(req, res, next, {
        get: () => {
          // Error? => Failed login
          if (req.query.error) {
            if (req.cookies.demoSession) {  // delete old login if needed
              res.clearCookie('demoSession', cookieOptions);
            }

            // Send html with error message
            res.type('html')
                .send(getPageGenerator().renderPage(PageTemplate.DEMO, req, res, {
                  demo: {
                    err: {
                      name: req.query.error as string,
                      info: req.query.error_description as string || undefined
                    }
                  }
                }));
          } else {
            let demoData;

            try {
              // Verify if logged in (cookie exists) and is valid (we don't want to render user-input on the client)
              demoData = req.cookies.demoSession ?
                  jwt.verify(req.cookies.demoSession, getPartOfSecret(256), {algorithms: ['HS256']}) as { iat: number, mcProfile: object } :
                  undefined;
            } catch (err) {
            }

            res.type('html')
                .send(getPageGenerator().renderPage(PageTemplate.DEMO, req, res, {demo: {mcProfile: demoData?.mcProfile || undefined}}));
          }
        }
      });
    });
  }
}
