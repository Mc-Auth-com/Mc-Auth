import { Router } from 'express';
import { getPageGenerator } from '../../Constants';
import { PageTemplate } from '../../DynamicPageGenerator';
import { restful, stripLangKeyFromURL } from '../../utils/_old_utils';

export default class NotificationSettingRoutes {
  static addRoutes(router: Router): void {
    router.all('/notifications', (req, res, next) => {
      restful(req, res, next, {
        get: () => {
          if (!req.session?.loggedIn) return res.redirect(`${getPageGenerator().globals.url.base}/login?return=${encodeURIComponent(stripLangKeyFromURL(req.originalUrl))}`);

          res.type('html')
              .send(getPageGenerator().renderPage(PageTemplate.SETTINGS_NOTIFICATIONS, req, res));
        }
        // post: () => { } // TODO
      });
    });
  }
}
