import { CookieOptions, Router } from 'express';
import jwt from 'jsonwebtoken';
import { getCfg, getHttpClient, getPageGenerator } from '../../Constants';
import { getPartOfSecret } from '../../utils/_old_utils';
import { ApiError } from '../../utils/ApiError';
import ApiErrs from '../../utils/ApiErrs';
import handleRequestRestfully from '../../utils/old-node-commons/RestfulRequestHandler';

// FIXME: Heavily refactor this class
export default class DemoAuthorizationRoutes {
  static addRoutes(router: Router, cookieOptions: CookieOptions): void {
    const redirectURI = getPageGenerator().globals.url.base + '/demo/login';

    router.all('/login', (req, res, next) => {
      handleRequestRestfully(req, res, next, {
        get: () => {
          if (req.query.error) {  // User did authenticate but Mc-Auth sends us an error
            return res.redirect(`${getPageGenerator().globals.url.base}/demo?error=${req.query.error}${req.query.error_description ? `&error_description=${req.query.error_description}` : ''}`);
          } else if (!req.query.code) {  // User did not authenticate yet, redirecting to Mc-Auth.com
            const authReqURL =
                getPageGenerator().globals.url.base + // use 'https://Mc-Auth.com' instead
                '/oAuth2/authorize' +
                '?client_id=' + // Your client_id from https://mc-auth.com/de/settings/apps
                getCfg().data.demo.mcAuth.client_id +
                '&redirect_uri=' + // Where should Mc-Auth.com redirect the client to (needs to be whitelisted inside your app settings)
                encodeURIComponent(redirectURI) +
                '&scope=profile' + // Optional. Tells Mc-Auth that we want the public profile (so we don't have to contact Mojang ourself)
                '&response_type=code'; // 'token' is supported too

            res.redirect(authReqURL);
          } else {
            const exchangeReqURL =
                getPageGenerator().globals.url.base + // use 'https://Mc-Auth.com' instead
                '/oAuth2/token';

            const requestHeaders = {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'User-Agent': 'Mc-Auth Demo'
            };
            const requestBody = {
              // client_secret from Mc-Auth to authenticate our request
              client_id: getCfg().data.demo.mcAuth.client_id,
              client_secret: getCfg().data.demo.mcAuth.client_secret,

              code: req.query.code,             // The code that Mc-Auth told the user to give us (redirect)
              redirect_uri: redirectURI,        // The same URL we redirected the user to
              grant_type: 'authorization_code'  // REQUIRED. See oAuth2 specs
            };

            getHttpClient().post(exchangeReqURL, {headers: requestHeaders, body: JSON.stringify(requestBody)})
                .then((httpRes) => {
                  const responseBody = JSON.parse(httpRes.body.toString('utf-8'));

                  // FIXME: This should be rendered in the Demo-Context instead of throwing a generic server error
                  if (!responseBody.access_token) return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR)); // Should not be possible but just in case

                  // Authentication was successful!!

                  // fetch the Minecraft profile
                  getHttpClient().get(getPageGenerator().globals.url.base + '/api/v2/profile', {
                    headers: {
                      Accept: 'application/json',
                      Authorization: `Bearer ${responseBody.access_token}`
                    }
                  })
                      .then((profileResponse) => {
                        if (!profileResponse.ok) {
                          throw new Error('Could not fetch profile, status code: ' + profileResponse.statusCode);
                        }

                        const profile = JSON.parse(profileResponse.body.toString('utf-8'));

                        // I use a temporary cookie as it hold no sensitive data and this is supposed to be a demo page
                        res.cookie('demoSession',
                            jwt.sign({
                              mcProfile: {
                                id: profile.id,
                                name: profile.name
                              }
                            }, getPartOfSecret(256), {algorithm: 'HS256', expiresIn: '12 hours'}), cookieOptions);

                        return res.redirect(`${getPageGenerator().globals.url.base}/demo`);
                      });
                })
                .catch(next);
          }
        }
      });
    });

    router.all('/logout', (req, res, next) => {
      handleRequestRestfully(req, res, next, {
        get: () => {
          res.clearCookie('demoSession', cookieOptions);

          res.redirect(`${getPageGenerator().globals.url.base}/demo`);
        }
      });
    });
  }
}
