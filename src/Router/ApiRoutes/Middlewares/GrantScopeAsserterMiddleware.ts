import Express from 'express';
import { Grant } from '../../../global';
import { ApiError } from '../../../utils/ApiError';
import ApiErrs from '../../../utils/ApiErrs';

export default function assertRequestGrantScope(...scopes: ('profile')[]): Express.RequestHandler {
  return (req, res, next) => {
    const grant = res.locals.grant as Grant;
    if (grant == null) {
      return next(new Error('res.locals.grant is null (authorization middleware not run?)'));
    }

    for (const scope of scopes) {
      if (!grant.scopes.includes(scope)) {
        return next(ApiError.create(ApiErrs.missingScopeForAccessToken(scope)));
      }
    }

    next();
  };
}
