import HttpClient from '@spraxdev/node-commons/dist/HttpClient';
import Fs from 'fs';
import MinecraftApi from 'minecraft-api-client';
import Path from 'path';
import { DynamicMailGenerator } from './DynamicMailGenerator';
import { DynamicPageGenerator } from './DynamicPageGenerator';
import { mcAuthCfg } from './global';
import { getLocalization } from './Localization';
import { ConfigFile } from './utils/ConfigFile';

export const APP_VERSION: string = JSON.parse(Fs.readFileSync(Path.join(__dirname, '..', 'package.json'), 'utf-8')).version ?? 'UNKNOWN_APP_VERSION';

let cfg: ConfigFile<mcAuthCfg>;

let minecraftApi: MinecraftApi;
let mailGenerator: DynamicMailGenerator;
let pageGenerator: DynamicPageGenerator;

export function getCfg(): ConfigFile<mcAuthCfg> {
  if (cfg == null) {
    cfg = new ConfigFile<mcAuthCfg>(Path.join(process.cwd(), 'storage', 'config.json'), {
      listen: {
        usePath: false,
        path: './mcAuth.unixSocket',

        host: '0.0.0.0',
        port: 8080
      },
      trustProxy: false,

      logging: {
        accessLogFormat: '[:date[web]] :remote-addr by :remote-user | :method :url :status with :res[content-length] bytes | ":user-agent" referred from ":referrer" | :response-time[3] ms',
        discordErrorWebHookURL: null
      },
      web: {
        serveStatic: true,
        urlPrefix: {
          https: false,
          dynamicContentHost: 'auto',
          staticContentHost: 'auto'
        }
      },
      cookies: {
        secure: false
      },
      demo: {
        mcAuth: {
          client_id: 'Create an app at Mc-Auth.com/settings/apps',
          client_secret: ''
        }
      },
      reCAPTCHA: {
        public: '',
        private: ''
      },
      smtp: {
        host: '127.0.0.1',
        port: 465,

        secure: true,

        auth: {
          username: 'user007',
          password: 's3cr3t!'
        },

        from: 'Mc-Auth <mc-auth@localhost>'
      },
      secret: (() => require('crypto').randomBytes(1024).toString('base64')) as any
    });
  }

  return cfg;
}

export function getMinecraftApi(): MinecraftApi {
  if (minecraftApi == null) {
    minecraftApi = new MinecraftApi(HttpClient.generateUserAgent('Mc-Auth.com', APP_VERSION, true, 'https://github.com/Mc-Auth-com/Mc-Auth#readme'));
  }

  return minecraftApi;
}

// TODO: This should be made redundant and turned into static methods on the DynamicPageGenerator class
export function getPageGenerator(): DynamicPageGenerator {
  if (pageGenerator == null) {
    pageGenerator = new DynamicPageGenerator(getLocalization());
  }

  return pageGenerator;
}

// TODO: This should be made redundant and turned into static methods on the DynamicMailGenerator class
export function getMailGenerator() {
  if (mailGenerator == null) {
    mailGenerator = new DynamicMailGenerator();
  }

  return mailGenerator;
}
