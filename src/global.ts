/* SpraxAPI */
export interface mcAuthCfg {
  readonly listen: {
    readonly usePath: boolean,
    readonly path: string,

    readonly host: string,
    readonly port: number
  }

  readonly trustProxy: boolean;

  readonly logging: {
    readonly accessLogFormat: string;
    readonly discordErrorWebHookURL: string | null;
  }

  readonly web: {
    readonly serveStatic: boolean;

    readonly urlPrefix: {
      readonly https: boolean;
      readonly dynamicContentHost: string | 'auto';
      readonly staticContentHost: string | 'auto';
    }
  }

  readonly cookies: {
    readonly secure: boolean;
    readonly secret: string;
  }

  readonly reCAPTCHA: {
    readonly public: string;
    readonly private: string;
  }
}

export interface mcAuthDbCfg {
  readonly host: string;
  readonly port: number;
  readonly ssl: boolean;
  readonly connectionPoolSize: number;

  readonly user: string;
  readonly password: string;
  readonly database: string;
}

export interface OAuthApp {
  readonly id: string;
  readonly owner: string;

  readonly name: string;
  readonly description: string | null;
  readonly website: string;

  readonly iconID: string | null;
  readonly redirectURIs: string[];

  readonly secret: string | null;

  readonly verified: boolean;
  readonly deleted: boolean;

  readonly created: Date;
}

export interface OAuthAppIcon {
  readonly id: string;

  readonly optimizedImg: Buffer | null;
  readonly originalImg: Buffer | null;

  readonly duplicateOf: string | null;

  readonly addedBy: string;
  readonly added: Date;
}

export interface Grant {
  readonly id: string;
  readonly appId: string;
  readonly mcAccountId: string;
  readonly result: GrantType | null;
  readonly scopes: string[];
  readonly responseType: string;
  readonly state: string | null;
  readonly accessToken: string | null;
  readonly exchangeToken: string | null;
  readonly redirectUri: string;
  readonly issued: Date;

  readonly issuedDuringLast24Hours: boolean | null;
}

export enum GrantType {
  GRANTED = 'GRANTED',
  DENIED = 'DENIED',
  REVOKED = 'REVOKED'
}