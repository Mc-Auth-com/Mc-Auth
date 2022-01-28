import { Router } from 'express';
import AccountSettingsRoutes from './SettingRoutes/AccountSettingsRoutes';
import AppCreateRoutes from './SettingRoutes/AppCreateRoutes';
import AppEditRoutes from './SettingRoutes/AppEditRoutes';
import ConfirmMailRoutes from './SettingRoutes/ConfirmMailRoutes';
import NotificationSettingRoutes from './SettingRoutes/NotificationSettingRoutes';
import SecuritySettingRoutes from './SettingRoutes/SecuritySettingRoutes';
import SettingsBaseRoutes from './SettingRoutes/SettingsBaseRoutes';

export default class SettingsRouter {
  static createRouter(): Router {
    const router = Router();

    SettingsBaseRoutes.addRoutes(router);
    ConfirmMailRoutes.addRoutes(router);
    AccountSettingsRoutes.addRoutes(router);
    SecuritySettingRoutes.addRoutes(router);
    NotificationSettingRoutes.addRoutes(router);
    AppCreateRoutes.addRoutes(router);
    AppEditRoutes.addRoutes(router);

    return router;
  }
}
