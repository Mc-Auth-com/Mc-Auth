import fs = require('fs');
import rfs = require('rotating-file-stream');
import { createServer, Server } from 'http';
import { join as joinPath } from 'path';
import { DynamicMailGenerator } from './dynamicEmailGenerator';
import { DynamicPageGenerator } from './dynamicPageGenerator';

import { mcAuthCfg, mcAuthDbCfg } from './global';
import { getLocalization } from './localization';
import { loadConfig } from './utils/config';
import { dbUtils } from './utils/database';
import { ApiError } from './utils/errors';
import { mailUtils } from './utils/mail';

export let cfg: mcAuthCfg = {
  listen: {
    usePath: false,
    path: './mcAuth.unixSocket',

    host: '127.0.0.1',
    port: 8091
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
  secret: require('crypto').randomBytes(1024).toString('base64')
};
export let dbCfg: mcAuthDbCfg = {
  host: '127.0.0.1',
  port: 5432,
  ssl: false,
  connectionPoolSize: 6,

  user: 'user007',
  password: 's3cr3t!',
  database: 'skindb'
};

let server: Server | null;
export let db: dbUtils;
export let mailer: mailUtils;

export let pageGenerator: DynamicPageGenerator;
export let mailGenerator: DynamicMailGenerator;

export const appVersion: string = JSON.parse(fs.readFileSync(joinPath(__dirname, '..', 'package.json'), 'utf-8')).version ?? 'UNKNOWN_APP_VERSION';

/* Init configuration files */
cfg = loadConfig(cfg, joinPath(process.cwd(), 'storage', 'config.json')) as mcAuthCfg;
dbCfg = loadConfig(dbCfg, joinPath(process.cwd(), 'storage', 'db.json')) as mcAuthDbCfg;

/* Register shutdown hook */
function shutdownHook() {
  console.log('Shutting down...');

  const ready = async () => {
    try {
      if (db) {
        await db.shutdown();
      }
    } catch (ex) {
      console.error(ex);
    }

    process.exit();
  };

  if (server != null) {
    server.close((err) => {
      if (err && err.message != 'Server is not running.') console.error(err);

      ready();
    });
    server = null;
  }
}

process.on('SIGTERM', shutdownHook);
process.on('SIGINT', shutdownHook);
process.on('SIGQUIT', shutdownHook);
process.on('SIGHUP', shutdownHook);
process.on('SIGUSR2', shutdownHook);  // The package 'nodemon' is using this signal

/* Prepare webserver */
db = new dbUtils(dbCfg);
mailer = new mailUtils(cfg.smtp);

pageGenerator = new DynamicPageGenerator(getLocalization());
mailGenerator = new DynamicMailGenerator();

export const webAccessLogStream = rfs.createStream('access.log', { interval: '1d', maxFiles: 14, path: joinPath(process.cwd(), 'logs', 'access'), compress: true }),
  errorLogStream = rfs.createStream('error.log', { interval: '1d', maxFiles: 90, path: joinPath(process.cwd(), 'logs', 'error') });

webAccessLogStream.on('error', (err) => {
  ApiError.log(500, 'webAccessLogStream called error-event', true, {err});
});
errorLogStream.on('error', (err) => {
  ApiError.log(500, 'errorLogStream called error-event', true, {err});
});

(async () => {
  try {
    await db.isReady();
  } catch (err) {
    console.error(`Database is not ready! (${err.message})`);
    process.exit(2);
  }

  server = createServer(require('./server').app);

  server.on('error', (err: { syscall: string, code: string }) => {
    if (err.syscall != 'listen') {
      throw err;
    }

    const errPrefix = cfg.listen.usePath ? `path ${cfg.listen.path}` : `port ${cfg.listen.port}`;
    switch (err.code) {
      case 'EACCES':
        console.error(`${errPrefix} requires elevated privileges`);
        process.exit(1);
        break;
      case 'EADDRINUSE':
        console.error(`${errPrefix} is already in use`);
        process.exit(1);
        break;
      default:
        throw err;
    }
  });
  server.on('listening', () => {
    console.log(`Listening on ${cfg.listen.usePath ? `path ${cfg.listen.path}` : `port ${cfg.listen.port}`}`);
  });

  if (cfg.listen.usePath) {
    const unixSocketPath = cfg.listen.path,
        unixSocketPIDPath = cfg.listen.path + '.pid',
        parentDir = require('path').dirname(unixSocketPath);

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, {recursive: true});
    }

    const isProcessRunning = (pid: number): boolean => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (ex) {
        return ex.code == 'EPERM';
      }
    };

    if (fs.existsSync(unixSocketPath)) {
      let isRunning: boolean = false;
      let runningPID: number = -1;
      if (!fs.existsSync(unixSocketPIDPath) || !(isRunning = isProcessRunning(runningPID = parseInt(fs.readFileSync(unixSocketPIDPath, 'utf-8'))))) {
        fs.unlinkSync(unixSocketPath);
      }

      if (isRunning) {
        console.error(`The process (PID: ${runningPID}) that created '${unixSocketPath}' is still running!`);
        process.exit(1);
      }
    }

    fs.writeFileSync(unixSocketPIDPath, process.pid.toString());
    server.listen(unixSocketPath);
    fs.chmodSync(unixSocketPath, '0777');
  } else {
    server.listen(cfg.listen.port, cfg.listen.host);
  }
})();

export function getSecret(maxLength: number = 1024): Buffer {
  return Buffer.from(cfg.secret, 'base64').subarray(0, maxLength);
}
