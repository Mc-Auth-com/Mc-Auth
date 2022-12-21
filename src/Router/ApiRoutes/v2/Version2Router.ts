import express from 'express';
import handleApiAuthorization from '../Middlewares/AuthorizationMiddleware';
import assertRequestGrantScope from '../Middlewares/GrantScopeAsserterMiddleware';
import handleProfileRequest from './ProfileRoute';

export function createApiRouterVersion2(): express.Router {
  const router = express.Router();

  router.use(handleApiAuthorization);
  router.use('/profile', assertRequestGrantScope('profile'), handleProfileRequest);

  return router;
}
