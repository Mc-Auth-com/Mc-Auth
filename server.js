const Utils = require('./utils');

const express = require('express'),
  morgan = require('morgan');

const logFormat = '[:date[web]] :remote-addr by :remote-user | :method :url :status with :res[content-length] bytes | ":user-agent" referred from ":referrer" | :response-time[3] ms';
const accessLogStream = require('rotating-file-stream').createStream('access.log', {
  interval: '1d',
  maxFiles: 7,
  path: require('path').join(__dirname, 'logs', 'access')
}),
  errorLogStream = require('rotating-file-stream').createStream('error.log', {
    interval: '1d',
    maxFiles: 90,
    path: require('path').join(__dirname, 'logs', 'error')
  });

accessLogStream.on('error', (err) => {
  console.error(err); // Don't crash whole application, just print
  // once this event is emitted, the stream will be closed as well
});
errorLogStream.on('error', (err) => {
  console.error(err); // Don't crash whole application, just print
  // once this event is emitted, the stream will be closed as well
});

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', require('./storage/config.json')['trustProxy']);

// Log to console and file
app.use(morgan('dev'));
// app.use(morgan('dev', { skip(req, res) { return res.statusCode < 400 || res.hideFromConsole || req.originalUrl.startsWith('/.well-known/acme-challenge/'); } }));
app.use(morgan(logFormat, { stream: accessLogStream }));
app.use(morgan(logFormat, { skip(req, res) { return res.statusCode < 400 || res.hideFromConsole || req.originalUrl.startsWith('/.well-known/acme-challenge/'); }, stream: errorLogStream }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Remove duplicate query-params (Last one wins)
app.use((req, _res, next) => {
  for (const key in req.query) {
    if (req.query.hasOwnProperty(key)) {
      const elem = req.query[key];

      if (Array.isArray(elem)) {
        req.query[key] = elem.pop();
      }
    }
  }

  next();
});

const pool = new (require('pg').Pool)({
  host: require('./storage/db.json')['host'],
  port: require('./storage/db.json')['port'],
  user: require('./storage/db.json')['user'],
  password: require('./storage/db.json')['password'],
  database: require('./storage/db.json')['database'],
  ssl: require('./storage/db.json')['ssl'],
  max: 8
});
pool.on('error', (err, _client) => {
  console.error('Unexpected error on idle client:', err);
});

// Default response headers
app.use((_req, res, next) => {
  res.set({
    // 'Access-Control-Allow-Origin': '*',
    // 'Access-Control-Allow-Headers': 'User-Agent,Content-Type',

    'Cache-Control': 'private, max-age=0'
  });

  next();
});

/* Non-Cookie Routes */
app.use('/oauth2', require('./routes/oAuth2_post'));

/* Cookie Routes */
app.use(require('express-session')({
  name: 'sessID',
  store: new (require('connect-pg-simple')(require('express-session')))({
    pool,
    pruneSessionInterval: 60 * 60 * 24 /* 24h */
  }),
  secret: require('./storage/misc').CookieSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  unset: 'destroy',
  cookie: { secure: require('./storage/config.json')['secureCookies'], httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 /* 30d */ }
}));

// ToDo Set caching headers on routes
app.use('/', require('./routes/index'));
app.use('/login', require('./routes/login'));
app.use('/logout', require('./routes/logout'));
app.use('/legal', require('./routes/legal'));
app.use('/privacy', require('./routes/privacy'));
app.use('/oauth2', require('./routes/oAuth2'));
app.use('/settings', require('./routes/settings'));
app.use('/demo', (_req, res, _next) => { res.send('Work In Progress!'); });

// Prepare 404
app.use((_req, _res, next) => {
  next(Utils.createError(404, 'The requested resource could not be found.'));
});

// Send Error
app.use((err, _req, res, _next) => {
  if (!err || !(err instanceof Error)) {
    if (err) console.error('Invalid Error provided:', err);

    err = Utils.createError();
  }

  if (!err.hideFromConsole && (!err.status || (err.status >= 500 && err.status < 600))) {
    console.error(err); // Log to file
  }

  if (err.hideFromConsole) res.hideFromConsole = true;

  if (!res.headersSent) {
    res.status(err.status || 500)
      .json({
        status: err.status,
        msg: err.message
      });
  }
});

module.exports = app;