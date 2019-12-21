let cfg;
let server;

function shutdownHook() {
  console.log('Shutting down...');

  const ready = async () => {
    try {
      await require('./db/DB').pool.end();
    } catch (ex) { }

    process.exit();
  };

  server.close((err) => {
    if (err && err.message != 'Server is not running.') console.error(err);

    ready();
  });
}

process.on('SIGTERM', shutdownHook);
process.on('SIGINT', shutdownHook);
process.on('SIGQUIT', shutdownHook);
process.on('SIGHUP', shutdownHook);
process.on('SIGUSR2', shutdownHook);  // The package 'nodemon' is using this signal

initStorage(() => {
  cfg = require('./storage/config.json');

  server = require('http').createServer(require('./server'));
  server.on('error', (err) => {
    if (err.syscall !== 'listen') {
      throw err;
    }

    switch (err.code) {
      case 'EACCES':
        console.error(
          ((cfg.listen.usePath || process.env.UNIX_PATH) ? `path ${process.env.UNIX_PATH || cfg.listen.path}` : `port ${process.env.PORT || cfg.listen.port}`) +
          ' requires elevated privileges'
        );
        process.exit(1);
        break;
      case 'EADDRINUSE':
        console.error(
          ((cfg.listen.usePath || process.env.UNIX_PATH) ? `path ${process.env.UNIX_PATH || cfg.listen.path}` : `port ${process.env.PORT || cfg.listen.port}`) +
          ' is already in use'
        );
        process.exit(1);
        break;
      default:
        throw err;
    }
  });

  server.on('listening', () => {
    console.log('Listening on ' +
      ((cfg.listen.usePath || process.env.UNIX_PATH) ? `path ${process.env.UNIX_PATH || cfg.listen.path}` : `port ${process.env.PORT || cfg.listen.port}`)
    );
  });

  if (cfg.listen.usePath || process.env.UNIX_PATH) {
    const fs = require('fs');

    const unixSocketPath = process.env.UNIX_PATH || cfg.listen.path,
      unixSocketPIDPath = (process.env.UNIX_PATH || cfg.listen.path) + '.pid',
      parentDir = require('path').dirname(unixSocketPath);

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    if (fs.existsSync(unixSocketPath)) {
      let isRunning = false;
      if (!fs.existsSync(unixSocketPIDPath) || !(isRunning = isProcessRunning(parseInt(fs.readFileSync(unixSocketPIDPath, 'utf-8'))))) {
        fs.unlinkSync(unixSocketPath);
      }

      if (isRunning) {
        console.error(`It looks like the process that created '${unixSocketPath}' is still running!`);
        process.exit(1);
      }
    }

    fs.writeFileSync(unixSocketPIDPath, process.pid);
    server.listen(unixSocketPath);
    fs.chmodSync(unixSocketPath, 0777);
  } else {
    server.listen(process.env.PORT || cfg.listen.port, process.env.HOST || cfg.listen.host);
  }
});

async function initStorage(callback) {
  const fs = require('fs');

  if (!fs.existsSync('./storage/')) {
    fs.mkdirSync('./storage/');
  }

  if (!fs.existsSync('./storage/config.json')) {
    fs.writeFileSync('./storage/config.json', JSON.stringify(
      {
        listen: {
          usePath: false,
          path: './mcAuth.unixSocket',

          host: '127.0.0.1',
          port: 8091
        },
        trustProxy: false,
        secureCookies: 'auto'
      }
      , null, 4));

    console.log('./storage/config.json has been created!');
  }

  if (!fs.existsSync('./storage/db.json')) {
    fs.writeFileSync('./storage/db.json', JSON.stringify(
      {
        host: '127.0.0.1',
        port: 5432,
        user: 'mcAuth',
        password: 's3cr3t!',
        ssl: false,

        database: 'mcAuth'
      }
      , null, 4));

    console.log('./storage/db.json has been created!');
  }

  if (!fs.existsSync('./storage/misc.json')) {
    fs.writeFileSync('./storage/misc.json', JSON.stringify(
      {
        CookieSecret: require('crypto').createHash('sha256').update(require('uuid/v4')()).update(require('crypto').randomBytes(256)).digest('hex')
      }
      , null, 4));

    console.log('./storage/misc.json has been created!');
  }

  if (callback) {
    callback();
  }
}

function isProcessRunning(pid) {
  try {
    return process.kill(pid, 0);
  } catch (ex) {
    return ex.code === 'EPERM';
  }
}