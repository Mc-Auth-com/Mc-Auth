import { Router } from 'express';
import { getPageGenerator } from '../../Constants';
import { restful } from '../../utils/_old_utils';

export default class SettingsBaseRoutes {
  static addRoutes(router: Router): void {
    router.all('/', (req, res, next) => {
      restful(req, res, next, {
        get: () => res.redirect(`${getPageGenerator().globals.url.base}/settings/account`)
      });
    });
  }
}
