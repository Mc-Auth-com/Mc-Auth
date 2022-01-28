import Fs from 'fs';
import { createServer, Server } from 'http';
import Path from 'path';

import * as rfs from 'rotating-file-stream';
import { getCfg } from './Constants';
import { mcAuthDbCfg } from './global';
import { ApiError } from './utils/ApiError';
import { ConfigFile } from './utils/ConfigFile';
import { DbUtils } from './utils/DbUtils';
import { MailUtils } from './utils/MailUtils';
import WebServer from './WebServer';

export let dbCfg: ConfigFile<mcAuthDbCfg>;

let server: Server | null;
export let db: DbUtils;
export let mailer: MailUtils;

/* Init configuration files */
dbCfg = new ConfigFile<mcAuthDbCfg>(Path.join(process.cwd(), 'storage', 'db.json'), {
  host: '127.0.0.1',
  port: 5432,
  ssl: false,
  connectionPoolSize: 6,

  user: 'user007',
  password: 's3cr3t!',
  database: 'skindb'
});

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

export const webAccessLogStream = rfs.createStream('access.log', {
      interval: '1d',
      maxFiles: 14,
      path: Path.join(process.cwd(), 'logs', 'access'),
      compress: true
    }),
    errorLogStream = rfs.createStream('error.log', {
      interval: '1d',
      maxFiles: 90,
      path: Path.join(process.cwd(), 'logs', 'error')
    });

main();

function main(): void {
  /* Prepare webserver */
  db = new DbUtils(dbCfg.data);
  mailer = new MailUtils(getCfg().data.smtp);

  webAccessLogStream.on('error', (err) => {
    ApiError.log(500, 'webAccessLogStream called error-event', true, {err});
  });
  errorLogStream.on('error', (err) => {
    ApiError.log(500, 'errorLogStream called error-event', true, {err});
  });

  (async () => {
    try {
      await db.isReady();
    } catch (err: any) {
      console.error(`Database is not ready! (${err?.message})`);
      process.exit(2);
    }

    server = createServer(WebServer.createWebServer());

    server.on('error', (err: { syscall: string, code: string }) => {
      if (err.syscall != 'listen') {
        throw err;
      }

      const errPrefix = getCfg().data.listen.usePath ? `path ${getCfg().data.listen.path}` : `port ${getCfg().data.listen.port}`;
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
      console.log(`Listening on ${getCfg().data.listen.usePath ? `path ${getCfg().data.listen.path}` : `port ${getCfg().data.listen.port}`}`);
    });

    if (getCfg().data.listen.usePath) {
      const unixSocketPath = getCfg().data.listen.path,
          unixSocketPIDPath = getCfg().data.listen.path + '.pid',
          parentDir = Path.dirname(unixSocketPath);

      if (!Fs.existsSync(parentDir)) {
        Fs.mkdirSync(parentDir, {recursive: true});
      }

      const isProcessRunning = (pid: number): boolean => {
        try {
          process.kill(pid, 0);
          return true;
        } catch (ex: any) {
          return ex?.code == 'EPERM';
        }
      };

      if (Fs.existsSync(unixSocketPath)) {
        let isRunning: boolean = false;
        let runningPID: number = -1;
        if (!Fs.existsSync(unixSocketPIDPath) || !(isRunning = isProcessRunning(runningPID = parseInt(Fs.readFileSync(unixSocketPIDPath, 'utf-8'))))) {
          Fs.unlinkSync(unixSocketPath);
        }

        if (isRunning) {
          console.error(`The process (PID: ${runningPID}) that created '${unixSocketPath}' is still running!`);
          process.exit(1);
        }
      }

      Fs.writeFileSync(unixSocketPIDPath, process.pid.toString());
      server.listen(unixSocketPath);
      Fs.chmodSync(unixSocketPath, '0777');
    } else {
      server.listen(getCfg().data.listen.port, getCfg().data.listen.host);
    }
  })();
}
