import { Router } from 'express';
import { getPageGenerator } from '../../Constants';
import { PageTemplate } from '../../DynamicPageGenerator';
import { stripLangKeyFromURL } from '../../utils/_old_utils';
import { handleRequestRestfully } from '@spraxdev/node-commons';

export default class SecuritySettingRoutes {
  static addRoutes(router: Router): void {
    router.all('/security', (req, res, next) => {
      handleRequestRestfully(req, res, next, {
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
