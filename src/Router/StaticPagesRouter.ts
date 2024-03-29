import { NextFunction, Request, Response, Router } from 'express';
import { getPageGenerator } from '../Constants';
import { PageTemplate } from '../DynamicPageGenerator';
import { handleRequestRestfully } from '@spraxdev/node-commons';

const pages: { [key: string]: PageTemplate } = {
  '/': PageTemplate.INDEX,
  '/legal': PageTemplate.LEGAL,
  '/privacy': PageTemplate.PRIVACY
};

export default class StaticPagesRouter {
  static createRouter(): Router {
    const router = Router();

    for (const path in pages) {
      router.all(path, this.createHandler(path));
    }

    return router;
  }

  private static createHandler(path: string): (req: Request, res: Response, next: NextFunction) => void {
    return (req, res, next) => {
      handleRequestRestfully(req, res, next, {
        get: () => {
          res.type('html')
              .send(getPageGenerator().renderPage(pages[path], req, res));
        }
      });
    };
  }
}
