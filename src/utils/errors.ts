import { post as httpPost } from 'superagent';
import { type as osType } from 'os';

import { appVersion, cfg } from '..';

export const httpUserAgent = `MC-Auth.org/${appVersion} (${osType()}; ${process.arch}; ${process.platform}) (+https://github.com/Mc-Auth-com/Mc-Auth-Web#readme)`;

export class ApiError extends Error {
  private static webhookRequestsLeft: number = 10;

  readonly httpCode: number;
  readonly internalDetails: object | null;

  constructor(httpCode: number, message: string, logErr: boolean | 'console' | 'discord' = false, internalDetails: object | null = null, stack?: string) {
    super(message);

    if (typeof stack == 'string') {
      this.stack = stack;
    }

    this.httpCode = httpCode;
    this.internalDetails = internalDetails;

    ApiError.log(this.httpCode, this.message, logErr, this.internalDetails, this.stack)
      .catch(console.error);
  }

  static fromError(err: Error, httpCode: number = 500, logErr: boolean | 'console' | 'discord' = true, internalDetails: object | null = null): ApiError {
    if (err.message) {
      if (!internalDetails) {
        internalDetails = { message: err.message };
      } else {
        const key = (internalDetails as any).message ? `message_${Date.now()}` : 'message';

        (internalDetails as any)[key] = err.message;
      }
    }

    return new ApiError(httpCode, 'An error occurred', logErr, internalDetails, err.stack);
  }

  static create(err: ApiErrTemplate, internalDetails: object | null = null): ApiError {
    return new ApiError(err.httpCode, err.message, err.logErr, internalDetails);
  }

  static async log(httpCode: number, message: string, logMode: boolean | 'console' | 'discord' = false, internalDetails: object | null = null, stack?: string): Promise<void> {
    return new Promise((resolve, _reject) => {
      if (!logMode) return resolve();

      if (logMode == true || logMode == 'console') {
        console.error(`[Error] ${message} (${JSON.stringify({ srvTime: new Date().toUTCString(), stack: stack?.split('\n'), details: internalDetails }, null, 2)})`);
      }

      if (logMode == true || logMode == 'discord') {
        if (ApiError.webhookRequestsLeft > 0 && cfg && cfg.logging.discordErrorWebHookURL) {
          httpPost(cfg.logging.discordErrorWebHookURL)
            .set('Content-Type', 'application/json')
            .set('Accept', 'application/json')
            .set('User-Agent', httpUserAgent)
            .send({
              username: 'Mc-Auth.org (Error-Reporter)',
              avatar_url: 'https://cdn.discordapp.com/attachments/541917740135350272/743868648611119204/Mc-Auth-4096px.png',
              embeds: [
                {
                  title: 'An error occurred',
                  fields: [
                    {
                      name: 'HTTP-Code',
                      value: httpCode,
                      inline: true
                    },
                    {
                      name: 'Message',
                      value: message,
                      inline: true
                    },
                    {
                      name: 'Details',
                      value: internalDetails ? '```JS\n' + JSON.stringify(internalDetails, null, 2).replace(/\\r?\\n/g, '\n') + '\n```' : '-'
                    }
                  ]
                }
              ]
            })
            .end((err, res) => {
              if (err) return console.error('Discord WebHook err:', err);
              // TODO: write to 'webhookRequestsLeft' and use setTimeout() to automatically set it when RateLimit is over (https://discord.com/developers/docs/topics/rate-limits#header-format)
              console.log(`Discord WebHook (${res.status}):`, res.text); // TODO: remove debug
            });
        }
      }
    });
  }
}

export class ApiErrs {
  /* 4xx */
  static readonly NOT_FOUND: ApiErrTemplate = { httpCode: 404, message: 'The requested page does not exist', logErr: false };
  static readonly UNAUTHORIZED: ApiErrTemplate = { httpCode: 401, message: 'Unauthorized', logErr: false };
  static readonly FORBIDDEN: ApiErrTemplate = { httpCode: 403, message: 'Forbidden', logErr: false };
  static readonly METHOD_NOT_ALLOWED: ApiErrTemplate = { httpCode: 405, message: 'Method Not Allowed (check Allow-Header)', logErr: false };

  static readonly UNKNOWN_APPLICATION: ApiErrTemplate = { httpCode: 404, message: 'Unknown application', logErr: false };
  static readonly INVALID_CLIENT_ID_OR_SECRET: ApiErrTemplate = { httpCode: 400, message: 'client_id does not exist or does not match client_secret', logErr: false };
  static readonly INVALID_REDIRECT_URI_FOR_APP: ApiErrTemplate = { httpCode: 400, message: 'Invalid redirect_uri - Please contact the administrator of the page that sent you here', logErr: false };
  static readonly INVALID_GRANT_TYPE: ApiErrTemplate = { httpCode: 400, message: 'Invalid grant_type', logErr: false };
  static readonly INVALID_CODE_FOR_TOKEN_EXCHANGE: ApiErrTemplate = { httpCode: 400, message: 'Invalid code! expired? Wrong redirect_uri?', logErr: false };

  static readonly INVALID_OR_EXPIRED_MAIL_CONFIRMATION: ApiErrTemplate = { httpCode: 400, message: 'Invalid or expired email confirmation token', logErr: false };

  /* 5xx */
  static readonly INTERNAL_SERVER_ERROR: ApiErrTemplate = { httpCode: 500, message: 'An unknown server error occurred', logErr: true };
  static readonly NO_DATABASE: ApiErrTemplate = { httpCode: 500, message: 'No database connection', logErr: true };
  static readonly NO_RECAPTCHA: ApiErrTemplate = { httpCode: 500, message: 'reCAPTCHA has not been configured', logErr: true };
  static readonly SRV_GENERATING_ACCESS_TOKEN: ApiErrTemplate = { httpCode: 500, message: 'Failed generating access_token', logErr: true };
  static readonly SRV_FETCHING_MINECRAFT_PROFILE: ApiErrTemplate = { httpCode: 500, message: 'Failed fetching minecraft profile', logErr: true };

  /* dynamic errors */
  static invalidQueryArg(queryArg: string): ApiErrTemplate {
    return { httpCode: 400, message: `Invalid value for query argument ${queryArg}`, logErr: false };
  }
}

export interface ApiErrTemplate {
  httpCode: number;
  message: string;
  logErr: boolean;
}