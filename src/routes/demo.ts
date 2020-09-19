import { CookieOptions, Router } from 'express';
import jwt from 'jsonwebtoken';
import { post as httpPost } from 'superagent';

import { cfg } from '..';
import { global, PageTemplate, renderPage } from '../dynamicPageGenerator';
import { ApiError, ApiErrs } from '../utils/errors';
import { restful } from '../utils/utils';

const cookieOptions: CookieOptions = { httpOnly: true, path: '/', sameSite: 'strict' };
const demoSecret = Buffer.from(cfg.demo.cookieSecret, 'base64');

const router = Router();
export const demoRouter = router;

const redirectURI = global.url.base + '/demo/login';

router.all('/', (req, res, next) => {
  restful(req, res, next, {
    get: async (): Promise<void> => {
      // Error? => Failed login
      if (req.query.error) {
        if (req.cookies.demoSession) {  // delete old login if needed
          res.clearCookie('demoSession', cookieOptions);
        }

        // Send html with error message
        res.type('html')
          .send(renderPage(PageTemplate.DEMO, req, res, {
            demo: {
              err: {
                name: req.query.error as string,
                info: req.query.error_description as string || undefined
              }
            }
          }));
      } else {
        try {
          // Verify if logged in (cookie exists) and is valid (we don't want to render user-input on the client)
          const demoData = req.cookies.demoSession ?
            await jwt.verify(req.cookies.demoSession, demoSecret, { algorithms: ['HS256'] }) as { iat: number, mcProfile: object } :
            null;

          res.type('html')
            .send(renderPage(PageTemplate.DEMO, req, res, { demo: { mcProfile: demoData?.mcProfile || undefined } }));
        } catch (err) {
          return next(err);
        }
      }
    }
  });
});

router.all('/login', (req, res, next) => {
  restful(req, res, next, {
    get: () => {
      if (req.query.error) {  // User did authenticate but Mc-Auth sends us an error
        return res.redirect(`${global.url.base}/demo?error=${req.query.error}${req.query.error_description ? `&error_description=${req.query.error_description}` : ''}`);
      } else if (!req.query.code) {  // User did not authenticate yet, redirecting to Mc-Auth.com
        const authReqURL =
          global.url.base + // use 'https://Mc-Auth.com' instead
          '/oAuth2/authorize' +
          '?client_id=' + // Your client_id from https://mc-auth.com/de/settings/apps
          cfg.demo.mcAuth.client_id +
          '&redirect_uri=' + // Where should Mc-Auth.com redirect the client to (needs to be whitelisted inside your app settings)
          encodeURIComponent(redirectURI) +
          '&scope=profile' + // Optional. Tells Mc-Auth that we want the public profile (so we don't have to contact Mojang ourself)
          '&response_type=code'; // 'token' is supported too

        res.redirect(authReqURL);
      } else {
        const exchangeReqURL =
          global.url.base + // use 'https://Mc-Auth.com' instead
          '/oAuth2/token';

        httpPost(exchangeReqURL)
          .set('Accept', 'application/json')
          .set('Content-Type', 'application/json')
          // .set('User-Agent', '') // TODO
          .send({
            // client_secret from Mc-Auth to authenticate our request
            client_id: cfg.demo.mcAuth.client_id,
            client_secret: cfg.demo.mcAuth.client_secret,

            code: req.query.code,             // The code that Mc-Auth told the user to give us (redirect)
            redirect_uri: redirectURI,        // The same URL we redirected the user to
            grant_type: 'authorization_code'  // REQUIRED. See oAuth2 specs
          })
          .end((err, httpBody) => {
            if (err) return next(err);  // An error occurred
            if (!httpBody.body.access_token) return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR)); // Should not be possible but just in case

            // Authentication was successful!!

            // I use a temporary cookie as it hold no sensitive data and this is supposed to be a demo page
            res.cookie('demoSession',
              jwt.sign({
                mcProfile: {
                  id: httpBody.body.data.profile.id,
                  name: httpBody.body.data.profile.name
                }
              }, demoSecret, { algorithm: 'HS256' }), cookieOptions);

            return res.redirect(`${global.url.base}/demo`);
          });
      }
    }
  });
});

router.all('/logout', (req, res, next) => {
  restful(req, res, next, {
    get: () => {
      res.clearCookie('demoSession', cookieOptions);

      res.redirect(`${global.url.base}/demo`);
    }
  });
});