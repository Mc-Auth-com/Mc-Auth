import { Router } from 'express';
import { getPageGenerator } from '../../Constants';
import { PageTemplate } from '../../DynamicPageGenerator';
import { restful, stripLangKeyFromURL } from '../../utils/_old_utils';

export default class SecuritySettingRoutes {
  static addRoutes(router: Router): void {
    router.all('/security', (req, res, next) => {
      restful(req, res, next, {
        get: () => {
          if (!req.session?.loggedIn) return res.redirect(`${getPageGenerator().globals.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

          res.type('html')
              .send(getPageGenerator().renderPage(PageTemplate.SETTINGS_SECURITY, req, res));
        }
        // post: () => { } // TODO
      });
    });
  }
}
