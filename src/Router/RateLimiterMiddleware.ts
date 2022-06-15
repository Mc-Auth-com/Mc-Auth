import express from 'express';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';

export function createRateLimiterMiddleware(points: number, durationInSeconds: number): (req: express.Request, res: express.Response, next: express.NextFunction) => void {
  const rateLimiter = new RateLimiterMemory({
    points,
    duration: durationInSeconds,
    blockDuration: durationInSeconds * 2
  });

  return (req, res, next) => {
    rateLimiter.consume(req.ip)
        .then((rateLimiterRes) => {
          setRateLimitHeader(res, points, rateLimiterRes);

          next();
        })
        .catch((errObj) => {
          if (!(errObj instanceof RateLimiterRes)) {
            return next(errObj);
          }

          setRateLimitHeader(res, points, errObj);
          res.status(429)
              .send('Too Many Requests');
        });
  };
}

function setRateLimitHeader(res: express.Response, totalPoints: number, rateLimiterRes: RateLimiterRes): void {
  res.setHeader('Retry-After', rateLimiterRes.msBeforeNext / 1000);
  res.setHeader('X-RateLimit-Limit', totalPoints);
  res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());
}
