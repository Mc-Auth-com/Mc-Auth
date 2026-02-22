import { Router } from 'express';
import { getPageGenerator } from '../../Constants';
import { PageTemplate } from '../../DynamicPageGenerator';
import { stripLangKeyFromURL } from '../../utils/_old_utils';
import handleRequestRestfully from '../../utils/old-node-commons/RestfulRequestHandler';

export default class NotificationSettingRoutes {
  static addRoutes(router: Router): void {
    router.all('/notifications', (req, res, next) => {
      handleRequestRestfully(req, res, next, {
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
