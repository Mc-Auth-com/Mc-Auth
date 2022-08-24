export interface ApiErrTemplate {
  httpCode: number;
  message: string;
  logErr: boolean;
}

export default class ApiErrs {
  /* 4xx */
  static readonly NOT_FOUND: ApiErrTemplate = { httpCode: 404, message: 'The requested page does not exist', logErr: false };
  static readonly UNAUTHORIZED: ApiErrTemplate = { httpCode: 401, message: 'Unauthorized', logErr: false };
  static readonly FORBIDDEN: ApiErrTemplate = { httpCode: 403, message: 'Forbidden', logErr: false };
  static readonly METHOD_NOT_ALLOWED: ApiErrTemplate = { httpCode: 405, message: 'Method Not Allowed (check Allow-Header)', logErr: false };

  static readonly UNKNOWN_APPLICATION: ApiErrTemplate = { httpCode: 404, message: 'Unknown application', logErr: false };
  static readonly INVALID_JSON_BODY: ApiErrTemplate = { httpCode: 400, message: 'Invalid JSON body', logErr: false };
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
    return {httpCode: 400, message: `Invalid value for query argument ${queryArg}`, logErr: false};
  }

  static unsupportedBodyContentType(given: string, supported: string[]): ApiErrTemplate {
    return {httpCode: 400, message: `Provided Content-Type '${given}' must be one of the following: ${supported.join(', ')}`, logErr: false};
  }
}
