import { Router } from 'express';

import { renderPage, PageParts } from '../dynamicPageGenerator';
import { restful } from '../utils/utils';

const router = Router();
export const staticPagesRouter = router;

const pages: { [key: string]: string } = {
  '/': PageParts.INDEX,
  '/legal': PageParts.LEGAL,
  '/privacy': PageParts.PRIVACY
};

for (const path in pages) {
  router.all(path, (req, res, next) => {
    restful(req, res, next, {
      get: () => {
        res.type('html')
          .send(renderPage(pages[path], req, res));
      }
    });
  });
}