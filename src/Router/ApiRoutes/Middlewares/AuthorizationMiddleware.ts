import Express from 'express';
import { constants } from 'node:http2';
import { db } from '../../../index';
import Tokens from '../../../utils/Tokens';
import { ApiError } from '../../../utils/ApiError';
import { ApiErrTemplate } from '../../../utils/ApiErrs';

const MISSING_OR_INVALID_TOKEN_SYNTAX: ApiErrTemplate = {
  httpCode: constants.HTTP_STATUS_UNAUTHORIZED,
  message: 'Missing or invalid access_token in Authorization header (Bearer)',
  logErr: false
};
const INVALID_OR_EXPIRED_TOKEN: ApiErrTemplate = {
  httpCode: constants.HTTP_STATUS_UNAUTHORIZED,
  message: 'Invalid or expired access_token',
  logErr: false
};

export default async function handleApiAuthorization(req: Express.Request, res: Express.Response, next: Express.NextFunction): Promise<void> {
  const accessToken = Tokens.extractBearerToken(req);
  if (accessToken == null || !Tokens.checkTokenSyntax(accessToken)) {
    return next(ApiError.create(MISSING_OR_INVALID_TOKEN_SYNTAX));
  }

  const grant = await db.getActiveGrantForAccessToken(accessToken);
  if (grant == null) {
    return next(ApiError.create(INVALID_OR_EXPIRED_TOKEN));
  }

  res.locals.grant = grant;
  next();
}
