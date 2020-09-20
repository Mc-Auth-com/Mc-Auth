import jwt from 'jsonwebtoken';
import Mail from 'nodemailer/lib/mailer';
import nodemailer from 'nodemailer';

import { mcAuthAccount } from '../global';
import { getLocalization } from '../localization';
import { getSecret, mailGenerator } from '..';
import { MailTemplate } from '../dynamicEmailGenerator';

/*
TODO: Allow users to add their email to a blacklist and only be removed when
        contacting admin using that email
        (in case you are getting 'confirm your e-mail address'
        but did not request them yourself)

TODO: temporarily blacklist mails when returned with 'hard bounce'?
        A bounce is an email that can’t be delivered.
        There are two kinds: a hard bounce, which means the email address is not valid,
        and a soft bounce, which means the mailbox is temporarily rejecting messages,
        perhaps due to a full mailbox or a server problem.
*/

export class mailUtils {
  private mailer: Mail;

  constructor(options: { host: string, port: number, secure: boolean, auth: { username: string, password: string } }) {
    this.mailer = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: {
        user: options.auth.username,
        pass: options.auth.password
      }
    }, { from: 'no-reply@mc-auth.com' });
  }

  async send(name: string, email: string, subject: string, html: string, text?: string): Promise<{ accepted: string[], rejected: string[], response: string, messageId: string }> {
    return new Promise((resolve, reject) => {
      this.mailer.sendMail({ to: `${name} <${email}>`, subject, html, text }, (err, info) => {
        if (err) return reject(err);

        console.log(`[INFO] Sent mail ${info.messageId} to ${name} with subject ${subject}`);
        resolve(info);
      });
    });
  }

  async sendConfirmEmail(account: mcAuthAccount, newEmail: string, langKey: string): Promise<object> {
    const content = mailGenerator.renderMail(MailTemplate.CONFIRM_EMAIL, langKey, {
      confirm_mail: {
        mcProfile: { id: account.id, name: account.name },
        token: jwt.sign({ id: account.id, email: newEmail }, getSecret(256), { expiresIn: '2d' })
      }
    });

    return this.send(account.name, newEmail, getLocalization().getString(langKey, 'email.confirm_email.subject'), content.html, content.txt);
  }
}