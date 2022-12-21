import express from 'express';
import { constants } from 'node:http2';
import { createApiRouterVersion2 } from './ApiRoutes/v2/Version2Router';

export function createApiRouter(): express.Router {
  const router = express.Router();

  router.use((req, res, next) => {
    res.locals.sendJSON = true;
    next();
  });

  router.use('/v2', createApiRouterVersion2());

  router.use('/v1', (req, res) => {
    res.status(constants.HTTP_STATUS_GONE)
        .send('API v1 is no longer supported – please update your client');
  });

  return router;
}
