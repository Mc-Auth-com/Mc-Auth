import { NextFunction, Request, Response, Router } from 'express';

import { pageGenerator } from '..';
import { PageTemplate } from '../dynamicPageGenerator';
import { restful } from '../utils/_old_utils';

const router = Router();
export const staticPagesRouter = router;

const pages: { [key: string]: PageTemplate } = {
  '/': PageTemplate.INDEX,
  '/legal': PageTemplate.LEGAL,
  '/privacy': PageTemplate.PRIVACY
};

for (const path in pages) {
  router.all(path, createHandler(path));
}

function createHandler(path: string): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    restful(req, res, next, {
      get: () => {
        res.type('html')
            .send(pageGenerator.renderPage(pages[path], req, res));
      }
    });
  };
}
