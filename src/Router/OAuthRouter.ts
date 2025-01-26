import StringUtils from '@spraxdev/node-commons/dist/strings/StringUtils';
import { Router } from 'express';
import { getMinecraftApi, getPageGenerator } from '../Constants';
import { PageTemplate } from '../DynamicPageGenerator';
import { db } from '../index';
import { appendParamsToURL, stripLangKeyFromURL, stripParamsFromURL } from '../utils/_old_utils';
import { ApiError } from '../utils/ApiError';
import ApiErrs from '../utils/ApiErrs';
import { handleRequestRestfully } from '@spraxdev/node-commons';

// TODO Add rate limiting
//  No confirmed mail: 5/second (burst, status 429), 100/hour (status 429)
//  Confirmed mail: 50/second (burst, status 429), 15000/hour (status 429)
//  Verified mail: no rate limit (Don't make me regret this)

const validScopes = ['profile'];

export default class OAuthRouter {
  static createAuthorizedRouter(): Router {
    const router = Router();

    router.all('/authorize', (req, res, next) => {
      handleRequestRestfully(req, res, next, {
        get: () => {
          if (!req.session?.loggedIn) return res.redirect(`${getPageGenerator().globals.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}${typeof req.query['mcauth.username'] == 'string' ? `&username=${encodeURIComponent(req.query['mcauth.username'])}` : ''}`);
          if (!req.session?.mcProfile?.id) return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR, {'req.session?.mcProfile?.id': req.session?.mcProfile?.id}));

          const clientID = req.query.client_id,
              redirectURI = req.query.redirect_uri,
              state = req.query.state as string || null,
              responseType = (typeof req.query.response_type == 'string' ? req.query.response_type : '').toLowerCase(),
              scope = (typeof req.query.scope == 'string' ? req.query.scope : '').toLowerCase().split(' ').filter((elem) => {
                return !!elem;
              });

          function isParseableRedirectUriWithOrigin(uri: string): boolean {
            try {
              return new URL(uri).origin.length > 0;
            } catch (ex) {
              return false;
            }
          }

          /* Basic input validation */
          if (typeof clientID != 'string' || !StringUtils.isNumeric(clientID)) return next(ApiError.create(ApiErrs.invalidQueryArg('client_id'), {
            typeof: typeof clientID,
            clientID
          }));
          if (typeof redirectURI != 'string' || redirectURI.length == 0 || !isParseableRedirectUriWithOrigin(redirectURI)) return next(ApiError.create(ApiErrs.invalidQueryArg('redirect_uri'), {
            typeof: typeof redirectURI,
            redirectURI
          }));
          if (typeof state != 'string' && state != null) return next(ApiError.create(ApiErrs.invalidQueryArg('state'), {
            typeof: typeof redirectURI,
            redirectURI
          }));

          for (const str of scope) {
            if (!validScopes.includes(str)) {
              return next(ApiError.create(ApiErrs.invalidQueryArg('scope')));
            }
          }
          // Done with basic validation

          db.getApp(clientID)
              .then((app) => {
                if (!req.session?.mcProfile?.id) return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR, {'req.session?.mcProfile?.id': req.session?.mcProfile?.id}));
                if (!app || app.deleted) return next(ApiError.create(ApiErrs.UNKNOWN_APPLICATION, {
                  clientID,
                  exists: !!app,
                  deleted: app ? app.deleted : '?'
                }));

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
                      appendParamsToURL(redirectURI, [{key: 'error', value: 'unsupported_response_type'}, {
                        key: 'state',
                        value: state
                      }]));
                }

                db.createGrant(clientID, req.session?.mcProfile?.id, redirectURI, responseType, state, scope.sort())
                    .then((grant) => {
                      getMinecraftApi().getProfile(app.owner)
                          .then((appOwner) => {
                            res.type('html')
                                .send(getPageGenerator().renderPage(PageTemplate.AUTHORIZE, req, res, {
                                  apps: [app],
                                  grant,
                                  appOwner: appOwner || undefined
                                }));
                          })
                          .catch(next);
                    })
                    .catch(next);
              })
              .catch(next);
        },

        post: () => {
          if (!req.session?.loggedIn) return res.redirect(`${getPageGenerator().globals.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

          const grantID = req.body.authenticity_token,
              clientID = req.body.client_id,
              state = req.body.state || null,
              agreed = req.body.result == '1';

          /* Basic input validation */
          if (typeof grantID != 'string' || !StringUtils.isNumeric(grantID)) return next(new ApiError(400, 'Invalid body parameter: authenticity_token', false, {body: req.body}));
          if (typeof clientID != 'string' || !StringUtils.isNumeric(clientID)) return next(new ApiError(400, 'Invalid body parameter: client_id', false, {body: req.body}));
          if (typeof state != 'string' && state != null) return next(new ApiError(400, 'Invalid body parameter: state', false, {body: req.body}));
          if (typeof req.body.result != 'string') return next(new ApiError(400, 'Invalid body parameter: result', false, {body: req.body}));
          // Done with basic validation

          db.getGrant(grantID)
              .then((grant) => {
                if (!grant) return next(ApiError.create(ApiErrs.NOT_FOUND));
                if (grant.result != null || grant.issuedDuringLast24Hours != true) return next(new ApiError(400, 'Grant already fulfilled or expired', false, {grantID: grant.id}));

                db.getApp(clientID)
                    .then(async (app): Promise<void> => {
                      if (!app || app.deleted) return next(ApiError.create(ApiErrs.UNKNOWN_APPLICATION, {clientID}));

                      try {
                        await db.setGrantResult(grant.id, agreed);

                        if (!agreed) {
                          return res.redirect(303,
                              // TODO: Write own URL-class to chain method calls to add params and reduce duplicate code/string (Use this class in multiples places below)
                              grant.responseType == 'token' ?
                                  `${grant.redirectUri}#error=access_denied&error_description=resource_owner_denied_request&state=${encodeURIComponent(state ?? '')}` :
                                  appendParamsToURL(grant.redirectUri,
                                      [{key: 'error', value: 'access_denied'},
                                        {key: 'error_description', value: 'resource_owner_denied_request'},
                                        {key: 'state', value: state}]));
                        }

                        if (grant.responseType == 'code') {
                          const token = await db.generateExchangeToken(grant.id);

                          if (!token) {
                            ApiError.log(500, 'Error generating exchange_token', true, {grantID: grant.id});  // log error

                            return res.redirect(303,
                                appendParamsToURL(grant.redirectUri,
                                    [{key: 'error', value: 'server_error'},
                                      {key: 'state', value: state}]));
                          }

                          return res.redirect(303,
                              appendParamsToURL(grant.redirectUri,
                                  [{key: 'code', value: token},
                                    {key: 'expires_in', value: '300'},
                                    {key: 'state', value: state}]));
                        } else if (grant.responseType == 'token') {
                          const token = await db.generateAccessToken(grant.id);

                          if (!token) {
                            ApiError.log(500, 'Error generating exchange_token', true, {grantID: grant.id});  // log error

                            return res.redirect(303, `${grant.redirectUri}#error=server_error&state=${encodeURIComponent(state ?? '')}`);
                          }

                          return res.redirect(303, `${grant.redirectUri}#access_token=${encodeURIComponent(token)}&token_type=${'Bearer'}` +
                              `&expires_in=${3600}&scope=${encodeURIComponent(grant.scopes.join(' '))}&state=${encodeURIComponent(state ?? '')}`);
                        } else {
                          ApiError.log(500, 'Could not handle response_type', true, {
                            grantID: grant.id,
                            response_type: grant.responseType
                          });  // Log error

                          return res.redirect(303,
                              grant.responseType == 'token' ?
                                  `${grant.redirectUri}#error=server_error&error_description=${encodeURIComponent('Unsupported response_type - Please report this bug!')}` +
                                  `&state=${encodeURIComponent(state ?? '')}` :
                                  appendParamsToURL(grant.redirectUri,
                                      [{key: 'error', value: 'server_error'},
                                        {
                                          key: 'error_description',
                                          value: 'Unsupported response_type - Please report this bug!'
                                        },
                                        {key: 'state', value: state}]));
                        }
                      } catch (err: any) {
                        ApiError.fromError(err, 500, true, {
                          appID: app.id,
                          grantID: grant.id,
                          response_type: grant.responseType
                        });  // Log error

                        return res.redirect(303,
                            grant.responseType == 'token' ?
                                `${grant.redirectUri}#error=server_error&state=${encodeURIComponent(state ?? '')}` :
                                appendParamsToURL(grant.redirectUri,
                                    [{key: 'error', value: 'server_error'},
                                      {key: 'state', value: state}]));
                      }
                    })
                    .catch(next);
              })
              .catch(next);
        }
      });
    });

    return router;
  }

  static createNonAuthorizedRouter(): Router {
    const router = Router();

    router.all('/token', (req, res, next) => {
      const supportedBodyContentTypes = ['application/json', 'application/x-www-form-urlencoded'];

      handleRequestRestfully(req, res, next, {
        post: () => {
          if (!req.is(supportedBodyContentTypes)) {
            return next(ApiError.create(ApiErrs.unsupportedBodyContentType(req.header('Content-Type') ?? '', supportedBodyContentTypes)));
          }

          const clientID = req.body['client_id'],
              clientSecret = req.body['client_secret'],
              code = req.body['code'],
              redirectURI = req.body['redirect_uri'],
              grantType = req.body['grant_type'];

          if (!clientID || !clientSecret || !StringUtils.isNumeric(clientID)) return next(ApiError.create(ApiErrs.INVALID_CLIENT_ID_OR_SECRET));

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
                          (result.data as any)._warning = `WARNING: The 'data' field will be removed in the future. Please use /api/v2/profile instead! (https://github.com/Mc-Auth-com/Mc-Auth/issues/103)`;
                          result.data.profile = await getMinecraftApi().getProfile(grant.mcAccountId) as object; // TODO: handle null value
                        } catch (err) {
                          return next(ApiError.create(ApiErrs.SRV_FETCHING_MINECRAFT_PROFILE, {uuid: grant.mcAccountId}));
                        }
                      }

                      return res.send(result);
                    });
                // .catch(next);  // Not required as Proimises go down the chain when catch is missing?
              })
              .catch(next);
        }
      });
    });

    router.all('/alternate-code-exchange', (req, res, next) => {
      const supportedBodyContentTypes = ['application/json', 'application/x-www-form-urlencoded'];

      handleRequestRestfully(req, res, next, {
        post: () => {
          if (!req.is(supportedBodyContentTypes)) {
            return next(ApiError.create(ApiErrs.unsupportedBodyContentType(req.header('Content-Type') ?? '', supportedBodyContentTypes)));
          }

          const clientID = req.body['client_id'],
            clientSecret = req.body['client_secret'],
            mcId = req.body['mc_id'],
            code = req.body['code'];

          if (!clientID || !clientSecret || !mcId) return next(ApiError.create(ApiErrs.INVALID_CLIENT_ID_OR_SECRET));
          if (typeof mcId !== 'string' || mcId.replaceAll('-', '').length != 32) return next(ApiError.create(ApiErrs.INVALID_CODE_FOR_ALTERNATE_TOKEN_EXCHANGE));
          if (typeof code !== 'string' || code.replaceAll(' ', '').length != 7 || !StringUtils.isNumeric(code.replaceAll(' ', '').substring(1))) return next(ApiError.create(ApiErrs.INVALID_CODE_FOR_ALTERNATE_TOKEN_EXCHANGE));

          db.getApp(clientID)
            .then((app) => {
              if (!app || app.deleted || app.secret != clientSecret) return next(ApiError.create(ApiErrs.INVALID_CLIENT_ID_OR_SECRET));

              return db.invalidateAlternateOneTimePassword(mcId.replaceAll('-', ''), code.replaceAll(' ', '').charAt(0), code.replaceAll(' ', '').substring(1))
                .then(async (success) => {
                  if (!success) return next(ApiError.create(ApiErrs.INVALID_CODE_FOR_ALTERNATE_TOKEN_EXCHANGE));

                  return res.send({
                    _info: 'WARNING: This endpoint is subject to change in the future. This response will contain a "_warning" field (please add logging for it or join my Discord server https://sprax.me/discord for a notification).',
                    profile: await getMinecraftApi().getProfile(mcId)
                  });
                });
            })
            .catch(next);
        }
      });
    });

    return router;
  }
}
