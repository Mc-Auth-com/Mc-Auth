import { readFileSync } from 'fs';
import { join as joinPath } from 'path';
import { getPageGenerator } from './Constants';

import { getLocalization } from './Localization';

const dynamicMailPath = joinPath(__dirname, '..', 'resources', 'email');

export class DynamicMailGenerator {
  readonly mailTemplates: { [key in MailTemplate]: { html: string, txt: string } };
  readonly mailCache: { [key: string]: { html: string, txt: string } } = {};

  constructor() {
    this.mailTemplates = {
      CONFIRM_EMAIL: {
        html: getPageGenerator().renderEjs(readFileSync(joinPath(dynamicMailPath, 'confirm_email.html'), 'utf-8'), 0),
        txt: getPageGenerator().renderEjs(readFileSync(joinPath(dynamicMailPath, 'confirm_email.txt'), 'utf-8'), 0)
      }
    };

    // Generate HTML templates and cache them
    for (const langKey in getLocalization().languages) {
      for (const key in MailTemplate) {
        const html = this.mailTemplates[key as MailTemplate];

        this.mailCache[langKey + key] = {
          html: getPageGenerator().renderEjs1(html.html, langKey),
          txt: getPageGenerator().renderEjs1(html.txt, langKey)
        };
      }
    }
    Object.freeze(this.mailCache);  // Protect cache from accidental modification
  }

  renderMail(template: MailTemplate, langKey: string, mailData: MailData = {}): { html: string, txt: string } {
    const data: { page: MailData, con: { lang: string } } = {
      page: mailData,
      con: {
        lang: langKey
      }
    };

    return {
      html: getPageGenerator().renderEjs(this.mailCache[data.con.lang + template].html, 2, data),
      txt: getPageGenerator().renderEjs(this.mailCache[data.con.lang + template].txt, 2, data)
    };
  }
}

export enum MailTemplate {
  CONFIRM_EMAIL = 'CONFIRM_EMAIL'
}

interface MailData {
  confirm_mail?: { mcProfile: { id: string, name: string }, token: string };
}
