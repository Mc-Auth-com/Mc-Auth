import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../../index';
import { getPartOfSecret } from '../../utils/_old_utils';
import { ApiError } from '../../utils/ApiError';
import ApiErrs from '../../utils/ApiErrs';
import { createRateLimiterMiddleware } from '../RateLimiterMiddleware';

export default class ConfirmMailRoutes {
  static addRoutes(router: Router): void {
    // TODO: Find better point and duration values
    // TODO: Maybe a better rate-limit strategy in general
    // TODO: add some kind of logging or metric for users hitting the rate-limit so we can see if it might be too high/low
    const rateLimiterMiddleware = createRateLimiterMiddleware(5, 60);

    router.get('/confirm-email/:token', rateLimiterMiddleware, (req, res, next) => {
      jwt.verify(req.params.token, getPartOfSecret(256), {algorithms: ['HS256']}, (err, data: any) => {
        if (err || data instanceof Buffer ||
            !data || !data.id || !data.email) return next(ApiError.create(ApiErrs.INVALID_OR_EXPIRED_MAIL_CONFIRMATION));

        db.getAccount(data.id)
            .then((account) => {
              if (!account || !account.emailPending ||
                  account.emailPending.toLowerCase() != data.email.toLowerCase()) return next(ApiError.create(ApiErrs.INVALID_OR_EXPIRED_MAIL_CONFIRMATION, {
                account,
                data
              }));

              db.setAccountEmailAddress(data.id, data.email)
                  .then(() => {
                    if (account.email) {
                      // TODO: Send information mail to old email
                    }

                    res.send('Your email has been successfully updated'); // TODO: Send html
                  })
                  .catch(next);
            })
            .catch(next);
      });
    });
  }
}
