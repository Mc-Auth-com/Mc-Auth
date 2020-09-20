import { Router } from 'express';

import { ApiError, ApiErrs } from '../utils/errors';
import { db, pageGenerator } from '..';
import { PageTemplate } from '../dynamicPageGenerator';
import { MojangAPI } from '../utils/spraxapi';
import { restful, isNumber, stripLangKeyFromURL, stripParamsFromURL, appendParamsToURL } from '../utils/utils';

// TODO Add rate limiting
//  No confirmed mail: 5/second (burst, status 429), 100/hour (status 429)
//  Confirmed mail: 50/second (burst, 429), 15000/hour (status 429)
//  Verified mail: no rate limit (Don't make me regret this)

const validScopes = ['profile'];

const router = Router(),
  routerNoCookie = Router();
export const oAuthRouter = router,
  oAuthNoCookieRouter = routerNoCookie;

routerNoCookie.all('/token', (req, res, next) => {
  res.locals.sendJSON = true; // Used by Error-Handler

  restful(req, res, next, {
    post: () => {
      const clientID = req.body['client_id'],
        clientSecret = req.body['client_secret'],
        code = req.body['code'],
        redirectURI = req.body['redirect_uri'],
        grantType = req.body['grant_type'];

      if (!clientID || !clientSecret || !isNumber(clientID)) return next(ApiError.create(ApiErrs.INVALID_CLIENT_ID_OR_SECRET));

      db.getApp(clientID)
        .then((app) => {
          if (!app || app.deleted || app.secret != clientSecret) return next(ApiError.create(ApiErrs.INVALID_CLIENT_ID_OR_SECRET));
          if (!grantType || grantType.toLowerCase() != 'authorization_code') return next(ApiError.create(ApiErrs.INVALID_GRANT_TYPE));

          db.invalidateExchangeToken(clientID, code, redirectURI)
            .then(async (grant) => {
              if (!grant) return next(ApiError.create(ApiErrs.INVALID_CODE_FOR_TOKEN_EXCHANGE));
              if (!grant.accessToken) return next(ApiError.create(ApiErrs.SRV_GENERATING_ACCESS_TOKEN));

              const result = {
                access_token: grant.accessToken,
                token_type: 'Bearer',
                expires_in: 3600, /* 1h */
                scope: grant.scopes.join(' '),
                state: grant.state || undefined,
                data: {
                  uuid: grant.mcAccountId,
                  profile: undefined as any // TODO: use interfaces
                }
              };

              if (grant.scopes.includes('profile')) {
                try {
                  result.data.profile = await MojangAPI.getProfile(grant.mcAccountId) as object; // TODO: handle null value
                } catch (err) {
                  return next(ApiError.create(ApiErrs.SRV_FETCHING_MINECRAFT_PROFILE, { uuid: grant.mcAccountId }));
                }
              }

              return res.send(result);
            })
          // .catch(next);  // Not required as Proimises go down the chain when catch is missing?
        })
        .catch(next);
    }
  });
});

router.all('/authorize', (req, res, next) => {
  restful(req, res, next, {
    get: () => {
      if (!req.session?.loggedIn) return res.redirect(`${pageGenerator.globals.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

      const clientID = req.query.client_id,
        redirectURI = req.query.redirect_uri,
        state = req.query.state as string || null,
        responseType = (typeof req.query.response_type == 'string' ? req.query.response_type : '').toLowerCase(),
        scope = (typeof req.query.scope == 'string' ? req.query.scope : '').toLowerCase().split(' ').filter((elem) => { return !!elem; });

      /* Basic input validation */
      if (typeof clientID != 'string' || !isNumber(clientID)) return next(ApiError.create(ApiErrs.invalidQueryArg('client_id'), { typeof: typeof clientID, clientID }));
      if (typeof redirectURI != 'string' ||
        redirectURI.length == 0) return next(ApiError.create(ApiErrs.invalidQueryArg('redirect_uri'), { typeof: typeof redirectURI, redirectURI }));
      if (typeof state != 'string' && state != null) return next(ApiError.create(ApiErrs.invalidQueryArg('state'), { typeof: typeof redirectURI, redirectURI }));

      for (const str of scope) {
        if (!validScopes.includes(str)) {
          return next(ApiError.create(ApiErrs.invalidQueryArg('scope')));
        }
      }
      // Done with basic validation

      db.getApp(clientID)
        .then((app) => {
          if (!app || app.deleted) return next(ApiError.create(ApiErrs.UNKNOWN_APPLICATION, { clientID, exists: !!app, deleted: app ? app.deleted : '?' }));

          let validRedirectURI = false;
          const compareableURI = stripParamsFromURL(redirectURI).toLowerCase();
          for (const uri of app.redirectURIs) {
            if (stripParamsFromURL(uri).toLowerCase() == compareableURI) {
              validRedirectURI = true;
              break;
            }
          }

          if (!validRedirectURI) return next(ApiError.create(ApiErrs.INVALID_REDIRECT_URI_FOR_APP));
          if (responseType != 'code' && responseType != 'token') {
            return res.redirect(303,
              appendParamsToURL(redirectURI, [{ key: 'error', value: 'unsupported_response_type' }, { key: 'state', value: state }]));
          }

          db.createGrant(clientID, req.session?.mcProfile.id, redirectURI, responseType, state, scope.sort())
            .then((grant) => {
              MojangAPI.getProfile(app.owner)
                .then((appOwner) => {
                  res.type('html')
                    .send(pageGenerator.renderPage(PageTemplate.AUTHORIZE, req, res, { apps: [app], grant, appOwner: appOwner || undefined }));
                })
                .catch(next);
            })
            .catch(next);
        })
        .catch(next);
    },
    post: () => {
      res.locals.sendJSON = true; // Used by Error-Handler

      if (!req.session?.loggedIn) return res.redirect(`${pageGenerator.globals.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

      const grantID = req.body.authenticity_token,
        clientID = req.body.client_id,
        state = req.body.state || null,
        agreed = req.body.result == '1';

      /* Basic input validation */
      if (typeof grantID != 'string' || !isNumber(grantID)) return next(new ApiError(400, 'Invalid body parameter: authenticity_token', false, { body: req.body }));
      if (typeof clientID != 'string' || !isNumber(clientID)) return next(new ApiError(400, 'Invalid body parameter: client_id', false, { body: req.body }));
      if (typeof state != 'string' && state != null) return next(new ApiError(400, 'Invalid body parameter: state', false, { body: req.body }));
      if (typeof req.body.result != 'string') return next(new ApiError(400, 'Invalid body parameter: result', false, { body: req.body }));
      // Done with basic validation

      db.getGrant(grantID)
        .then((grant) => {
          if (!grant) return next(ApiError.create(ApiErrs.NOT_FOUND));
          if (grant.result != null || grant.issuedDuringLast24Hours != true) return next(new ApiError(400, 'Grant already fulfilled or expired', false, { grantID: grant.id }));

          db.getApp(clientID)
            .then(async (app): Promise<void> => {
              if (!app || app.deleted) return next(ApiError.create(ApiErrs.UNKNOWN_APPLICATION, { clientID }));

              try {
                await db.setGrantResult(grant.id, agreed);

                if (!agreed) {
                  return res.redirect(303,
                    // TODO: Write own URL-class to chain method calls to add params and reduce duplicate code/string (Use this class in multiples places below)
                    grant.responseType == 'token' ?
                      `${grant.redirectUri}#error=access_denied&error_description=resource_owner_denied_request&state=${encodeURIComponent(state ?? '')}` :
                      appendParamsToURL(grant.redirectUri,
                        [{ key: 'error', value: 'access_denied' },
                        { key: 'error_description', value: 'resource_owner_denied_request' },
                        { key: 'state', value: state }]));
                }

                if (grant.responseType == 'code') {
                  const token = await db.generateExchangeToken(grant.id);

                  if (!token) {
                    ApiError.log(500, 'Error generating exchange_token', true, { grantID: grant.id });  // log error

                    return res.redirect(303,
                      appendParamsToURL(grant.redirectUri,
                        [{ key: 'error', value: 'server_error' },
                        { key: 'state', value: state }]));
                  }

                  return res.redirect(303,
                    appendParamsToURL(grant.redirectUri,
                      [{ key: 'code', value: token },
                      { key: 'expires_in', value: '300' },
                      { key: 'state', value: state }]));
                } else if (grant.responseType == 'token') {
                  const token = await db.generateAccessToken(grant.id);

                  if (!token) {
                    ApiError.log(500, 'Error generating exchange_token', true, { grantID: grant.id });  // log error

                    return res.redirect(303, `${grant.redirectUri}#error=server_error&state=${encodeURIComponent(state ?? '')}`);
                  }

                  return res.redirect(303, `${grant.redirectUri}#access_token=${encodeURIComponent(token)}&token_type=${'Bearer'}` +
                    `&expires_in=${3600}&scope=${encodeURIComponent(grant.scopes.join(' '))}&state=${encodeURIComponent(state ?? '')}`);
                } else {
                  ApiError.log(500, 'Could not handle response_type', true, { grantID: grant.id, response_type: grant.responseType });  // Log error

                  return res.redirect(303,
                    grant.responseType == 'token' ?
                      `${grant.redirectUri}#error=server_error&error_description=${encodeURIComponent('Unsupported response_type - Please report this bug!')}` +
                      `&state=${encodeURIComponent(state ?? '')}` :
                      appendParamsToURL(grant.redirectUri,
                        [{ key: 'error', value: 'server_error' },
                        { key: 'error_description', value: 'Unsupported response_type - Please report this bug!' },
                        { key: 'state', value: state }]));
                }
              } catch (err) {
                ApiError.fromError(err, 500, true, { appID: app.id, grantID: grant.id, response_type: grant.responseType });  // Log error

                return res.redirect(303,
                  grant.responseType == 'token' ?
                    `${grant.redirectUri}#error=server_error&state=${encodeURIComponent(state ?? '')}` :
                    appendParamsToURL(grant.redirectUri,
                      [{ key: 'error', value: 'server_error' },
                      { key: 'state', value: state }]));
              }
            })
            .catch(next);
        })
        .catch(next);
    }
  });
});