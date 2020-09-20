import * as ejs from 'ejs';
import * as express from 'express';
import moment, { Moment } from 'moment';
import { readFileSync } from 'fs';
import { join as joinPath } from 'path';

import { cfg } from '.';
import { stripLangKeyFromURL, stripParamsFromURL } from './utils/utils';
import { getLocalization, Localization } from './localization';
import { OAuthApp, Grant, mcAuthAccount } from './global';

const dynamicWebPath = joinPath(__dirname, '..', 'resources', 'web', 'dynamic');

export class DynamicPageGenerator {
  readonly globals: { url: { base: string, static: string, mcServer: string, docs: string }, reCaptchaPublic: string };
  readonly pageTemplates: { [key in PageTemplate]: string };
  readonly pagePartTemplates: { [key: string]: string };
  readonly htmlCache: { [key: string]: string } = {};

  constructor(localization: Localization) {
    this.globals = {
      url: {
        base: DynamicPageGenerator.generateUrlPrefix(cfg.web.urlPrefix.dynamicContentHost),
        static: DynamicPageGenerator.generateUrlPrefix(cfg.web.urlPrefix.staticContentHost),

        mcServer: 'mc-auth.com',
        docs: 'https://github.com/Mc-Auth-com/Mc-Auth-Web/wiki'
      },

      reCaptchaPublic: cfg.reCAPTCHA.public
    };

    /* Read HTML and apply level 0 rendering */

    this.pagePartTemplates = {
      _HEAD: this.renderEjs(readFileSync(joinPath(dynamicWebPath, '_head.html'), 'utf-8'), 0, { global: this.globals }),
      _HEADER: this.renderEjs(readFileSync(joinPath(dynamicWebPath, '_header.html'), 'utf-8'), 0, { global: this.globals }),
      _FOOTER: this.renderEjs(readFileSync(joinPath(dynamicWebPath, '_footer.html'), 'utf-8'), 0, { global: this.globals }),
      _SETTINGS_SIDEBAR: this.renderEjs(readFileSync(joinPath(dynamicWebPath, 'settings/_sidebar.html'), 'utf-8'), 0, { global: this.globals })
    };

    this.pageTemplates = {
      INDEX: this.renderEjs(readFileSync(joinPath(dynamicWebPath, 'index.html'), 'utf-8'), 0),
      LEGAL: this.renderEjs(readFileSync(joinPath(dynamicWebPath, 'legal.html'), 'utf-8'), 0),
      PRIVACY: this.renderEjs(readFileSync(joinPath(dynamicWebPath, 'privacy.html'), 'utf-8'), 0),

      DEMO: this.renderEjs(readFileSync(joinPath(dynamicWebPath, 'demo.html'), 'utf-8'), 0),

      LOGIN: this.renderEjs(readFileSync(joinPath(dynamicWebPath, 'login.html'), 'utf-8'), 0),
      AUTHORIZE: this.renderEjs(readFileSync(joinPath(dynamicWebPath, 'authorize.html'), 'utf-8'), 0),

      SETTINGS_ACCOUNT: this.renderEjs(readFileSync(joinPath(dynamicWebPath, 'settings/account.html'), 'utf-8'), 0),
      SETTINGS_SECURITY: this.renderEjs(readFileSync(joinPath(dynamicWebPath, 'settings/security.html'), 'utf-8'), 0),
      SETTINGS_NOTIFICATIONS: this.renderEjs(readFileSync(joinPath(dynamicWebPath, 'settings/notifications.html'), 'utf-8'), 0),

      SETTINGS_APPS: this.renderEjs(readFileSync(joinPath(dynamicWebPath, 'settings/apps/apps.html'), 'utf-8'), 0),
      SETTINGS_APPS_APP: this.renderEjs(readFileSync(joinPath(dynamicWebPath, 'settings/apps/edit.html'), 'utf-8'), 0),
      SETTINGS_APPS_CREATE: this.renderEjs(readFileSync(joinPath(dynamicWebPath, 'settings/apps/create.html'), 'utf-8'), 0)
    };

    // Apply level 0 and 1 rendering to localization
    for (const langKey in localization.languages) {
      const lang = localization.languages[langKey];

      for (const locKey in lang) {
        lang[locKey] = this.renderEjs1(this.renderEjs(lang[locKey], 0), langKey);
      }
    }

    // Generate HTML templates and cache them
    for (const langKey in getLocalization().languages) {
      for (const key in PageTemplate) {
        this.htmlCache[langKey + key] = this.renderEjs1(this.pageTemplates[key as PageTemplate], langKey);
      }
    }
    Object.freeze(this.htmlCache);  // Protect cache from accidental modification
  }

  renderPage(template: PageTemplate, req: express.Request, res: express.Response, pageData: PageData = {}): string {
    const data: { page: PageData, con: { query: { [key: string]: string }, isDarkTheme: boolean, lang: string, isLoggedIn: boolean, mcProfile: object /* FIXME type */, /*isAdmin: boolean, session: object, url: string, urlEncoded: string*/ currPath: string }, currLocalizedURL: { [key: string]: string }, currNonLocalizedURL: string, moment: Moment } = {
      page: pageData,
      con: {
        query: {},
        isDarkTheme: req.cookies.darkTheme == '1',
        lang: res.locals.lang,
        isLoggedIn: req.session && req.session.loggedIn,
        mcProfile: req.session?.loggedIn ? req.session.mcProfile : null,
        // isAdmin: req.session && req.session.data && req.session.data.id == '407b28ede7bd451693d93361fecb7889',
        // session: req.session ? req.session.data : null,
        currPath: stripParamsFromURL(req.originalUrl).toLowerCase()
      },
      currLocalizedURL: {},
      currNonLocalizedURL: this.globals.url.base + stripLangKeyFromURL(stripParamsFromURL(req.originalUrl)),
      moment: moment().locale(res.locals.lang)
    }

    for (const langKey in getLocalization().languages) {
      data.currLocalizedURL[langKey] = this.globals.url.base + '/' + langKey + stripLangKeyFromURL(stripParamsFromURL(req.originalUrl));
    }

    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        const value = req.query[key];

        if (typeof value == 'string') {
          data.con.query[key] = value;
        }
      }
    }

    return this.renderEjs(this.htmlCache[data.con.lang + template], 2, data);
  }

  /**
   * * **Level 0**: Used when inserting `global`s or `_HEAD`, `_HEADER`, ...
   * * **Level 1**: Used when inserting localization string
   * * **Level 2**: Used when inserting/generating dynamic content
   */
  renderEjs(str: string, level: 0 | 1 | 2, data?: ejs.Data): string {
    if (level == 0 && data == undefined) {
      data = {
        global: this.globals,

        _HEAD: this.pagePartTemplates._HEAD,
        _HEADER: this.pagePartTemplates._HEADER,
        _FOOTER: this.pagePartTemplates._FOOTER,
        _SETTINGS_SIDEBAR: this.pagePartTemplates._SETTINGS_SIDEBAR
      };
    }

    return ejs.render(str, data, { delimiter: `%${level}` }) as string;
  }

  /**
   * Calls #renderEjs(str, 1, data) with default data based on langKey
   *
   * @param langKey The language to use for localization
   */
  renderEjs1(str: string, langKey: string): string {
    // TODO: Provide getString(key: string): string {} as function that automatically calls loc.getString with langKey

    return this.renderEjs(str, 1, {
      loc: getLocalization(),
      langKey,
      global: {
        url: {
          baseLocalized: this.globals.url.base + (langKey != getLocalization().defaultLanguage ? `/${langKey}` : '')
        }
      },
    });
  }

  /**
   * Takes `host` and applies the chosen protocol from `cfg.web.urlPrefix.https`
   *
   * If the host is set to `auto`, host and port from `cfg.listen` are taken and used instead.
   * The port is automatically emitted when it is the default port for the chosen protocol
   *
   * @param host Should be `auto` or a hostname with optional port (`host[:port]`)
   */
  private static generateUrlPrefix(host: string | 'auto') {
    return `http${cfg.web.urlPrefix.https ? 's' : ''}://${host != 'auto' ? host : `${cfg.listen.host}${((cfg.web.urlPrefix.https && cfg.listen.port != 443) ||
      (!cfg.web.urlPrefix.https && cfg.listen.port != 80)) ? `:${cfg.listen.port}` : ''}`}`;
  }
}

export enum PageTemplate {
  INDEX = 'INDEX',
  LEGAL = 'LEGAL',
  PRIVACY = 'PRIVACY',

  DEMO = 'DEMO',

  LOGIN = 'LOGIN',
  AUTHORIZE = 'AUTHORIZE',

  SETTINGS_ACCOUNT = 'SETTINGS_ACCOUNT',
  SETTINGS_SECURITY = 'SETTINGS_SECURITY',
  SETTINGS_NOTIFICATIONS = 'SETTINGS_NOTIFICATIONS',

  SETTINGS_APPS = 'SETTINGS_APPS',
  SETTINGS_APPS_APP = 'SETTINGS_APPS_APP',
  SETTINGS_APPS_CREATE = 'SETTINGS_APPS_CREATE'
}

interface PageData {
  apps?: OAuthApp[],
  appOwner?: object, // TODO: rename or move into apps
  grant?: Grant,
  demo?: { err?: { name: string, info?: string }, mcProfile?: object },
  account?: mcAuthAccount
}