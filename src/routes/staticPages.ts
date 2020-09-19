import { Request, Response, NextFunction, Router } from 'express';

import { renderPage, PageTemplate } from '../dynamicPageGenerator';
import { restful } from '../utils/utils';

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
          .send(renderPage(pages[path], req, res));
      }
    });
  };
}