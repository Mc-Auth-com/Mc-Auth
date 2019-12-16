const Utils = require('../utils');

const { Pool } = require('pg');
const pool = new Pool({
  host: require('./../storage/db.json')['host'],
  port: require('./../storage/db.json')['port'],
  user: require('./../storage/db.json')['user'],
  password: require('./../storage/db.json')['password'],
  database: require('./../storage/db.json')['database'],
  ssl: require('./../storage/db.json')['ssl'],
  max: 8
});
pool.on('error', (err, _client) => {
  console.error('Unexpected error on idle client:', err);
});

module.exports = {
  pool,

  /* OTPs (Minecraft) */

  /**
   * @param {String} uuid 
   * @param {Number} otp 
   * @param {Function} callback err (Error), success (Boolean)
   */
  invalidateOneTimePassword(uuid, otp, callback) {
    pool.query(`DELETE FROM otp WHERE minecraft =$1::UUID AND code =$2 AND issued >= CURRENT_TIMESTAMP - INTERVAL '5 MINUTES' RETURNING *;`,
      [uuid, otp], (err, res) => {
        if (err) return callback(err);

        callback(null, res.rows.length > 0);
      });
  },

  /* Applications */

  /**
   * @param {String} clientID 
   * @param {Function} callback 
   */
  getApplication(clientID, callback) {
    pool.query(`SELECT * FROM applications WHERE id =$1::BIGINT;`,
      [clientID], (err, res) => {
        if (err) return callback(err);

        return callback(null, res.rowCount > 0 ? res.rows[0] : null);
      });
  },

  /**
   * @param {String} clientID 
   * @param {String} mcUUID
   * @param {Function} callback 
   */
  getApplicationForOwner(clientID, mcUUID, callback) {
    pool.query(`SELECT * FROM applications WHERE id =$1::BIGINT AND owner =$2::UUID;`,
      [clientID, mcUUID], (err, res) => {
        if (err) return callback(err);

        return callback(null, res.rowCount > 0 ? res.rows[0] : null);
      });
  },

  /**
   * @param {String} mcUUID 
   * @param {Function} callback 
   */
  getActiveApplications(mcUUID, callback) {
    pool.query(`SELECT * FROM applications WHERE owner =$1::UUID AND deleted =FALSE;`,
      [mcUUID], (err, res) => {
        if (err && err.code != 22003 /* numeric_value_out_of_range */) return callback(err);

        const result = [];

        for (const row of res.rows) {
          result.push(row);
        }

        return callback(null, result);
      });
  },

  /**
   * @param {String} clientID 
   * @param {String} name 
   * @param {String} description 
   * @param {String} redirectURIs 
   * @param {Function} callback 
   */
  updateApplication(clientID, name, description, redirectURIs, callback) {
    pool.query(`UPDATE applications SET name =$2, description =$3, redirect_uris =$4 WHERE id =$1;`,
      [clientID, name, description, JSON.stringify(redirectURIs)], (err, _res) => {
        return callback(err || null);
      });
  },

  /**
   * @param {String} name 
   * @param {String} description
   * @param {String} secret
   * @param {String} mcUUID
   * @param {Function} callback 
   */
  createApplication(name, description, mcUUID, callback) {
    pool.query(`INSERT INTO applications(name,description,owner) VALUES ($1,$2,$3) RETURNING *;`,
      [name, description, mcUUID], (err, res) => {
        if (err) return callback(err);

        callback(null, res.rows[0]);
      });
  },

  /**
   * @param {String} clientID 
   * @param {Function} callback 
   */
  regenerateApplicationSecret(clientID, callback) {
    pool.query(`UPDATE applications SET secret =DEFAULT WHERE id =$1 RETURNING secret;`,
      [clientID], (err, res) => {
        if (err) return callback(err);

        callback(null, res.rows[0]);
      });
  },

  /* Grants */

  /**
   * @param {String} grantID 
   * @param {Function} callback 
   */
  getGrant(grantID, callback) {
    pool.query(`SELECT * FROM grants WHERE id =$1::BIGINT;`,
      [grantID], (err, res) => {
        if (err) return callback(err);

        return callback(null, res.rowCount > 0 ? res.rows[0] : null);
      });
  },

  /**
   * @param {String} clientID 
   * @param {String} mcUUID
   * @param {String} redirect_uri
   * @param {String} state
   * @param {String[]} scope
   * @param {Function} callback 
   */
  generateGrant(clientID, mcUUID, redirect_uri, state, scope, callback) {
    pool.query(`INSERT INTO grants(application,mc_uuid,redirect_uri,state,scope) VALUES ($1,$2,$3,$4,$5) RETURNING *;`,
      [clientID, mcUUID, redirect_uri.toLowerCase(), state, JSON.stringify(scope)], (err, res) => {
        if (err) return callback(err);

        callback(null, res.rows[0]);
      });
  },

  /**
   * @param {String} clientID 
   * @param {String} mcUUID
   * @param {String} redirect_uri
   * @param {String} state
   * @param {String[]} scope
   * @param {Function} callback 
   */
  generateAccessToken(clientID, mcUUID, redirect_uri, state, scope, callback) {
    pool.query(`INSERT INTO grants(application,mc_uuid,redirect_uri,state,scope,access_token) VALUES ($1,$2,$3,$4,$5,random_string(32)) RETURNING access_token;`,
      [clientID, mcUUID, redirect_uri.toLowerCase(), state, JSON.stringify(scope)], (err, res) => {
        if (err) return callback(err);

        callback(null, res.rows[0]['access_token']);
      });
  },

  /**
   * @param {String} clientID 
   * @param {String} mcUUID
   * @param {String} redirect_uri
   * @param {String} state
   * @param {String[]} scope
   * @param {Function} callback 
   */
  generateExchangeToken(clientID, mcUUID, redirect_uri, state, scope, callback) {
    pool.query(`INSERT INTO grants(application,mc_uuid,redirect_uri,state,scope) VALUES ($1,$2,$3,$4,$5) RETURNING exchange_token;`,
      [clientID, mcUUID, redirect_uri.toLowerCase(), state, JSON.stringify(scope)], (err, res) => {
        if (err) return callback(err);

        callback(null, res.rows[0]['exchange_token']);
      });
  },

  /**
   * @param {String} clientID 
   * @param {String} redirect_uri
   * @param {Function} callback err (Error), success (Boolean)
   */
  invalidateExchangeToken(clientID, exchangeToken, redirect_uri, callback) {
    pool.query(`UPDATE grants SET access_token =random_string(32), issued =CURRENT_TIMESTAMP WHERE application =$1 AND access_token IS NULL AND exchange_token =$2 AND redirect_uri =$3 AND issued >= CURRENT_TIMESTAMP - INTERVAL '5 MINUTES' RETURNING *;`,
      [clientID, exchangeToken, redirect_uri.toLowerCase()], (err, res) => {
        if (err) return callback(err);

        callback(null, res.rows.length > 0 ? res.rows[0] : null);
      });
  }
};

/* Maintenance */

setInterval(async () => {
  pool.query(`DELETE FROM grants WHERE issued < CURRENT_TIMESTAMP - INTERVAL '24 HOUR' RETURNING *;`,
    [], (err, res) => {
      if (err) return Utils.logAndCreateError(err);

      console.log(`Deleted ${res.rowCount} stale grants`);
    });

  pool.query(`DELETE FROM otp WHERE issued < CURRENT_TIMESTAMP - INTERVAL '24 HOUR' RETURNING *;`,
    [], (err, res) => {
      if (err) return Utils.logAndCreateError(err);

      console.log(`Deleted ${res.rowCount} stale one-time-passwords`);
    });
}, 3 * 24 * 60 * 60 * 1000 /* 3d */);