import { CookieOptions, Router } from 'express';
import DemoAuthorization from './DemoRoutes/DemoAuthorizationRoutes';
import DemoBaseRoutes from './DemoRoutes/DemoBaseRoutes';

export default class DemoRouter {
  static createRouter(): Router {
    const router = Router();
    const cookieOptions: CookieOptions = {httpOnly: true, path: '/', sameSite: 'lax'};

    DemoBaseRoutes.addRoutes(router, cookieOptions);
    DemoAuthorization.addRoutes(router, cookieOptions);

    return router;
  }
}
