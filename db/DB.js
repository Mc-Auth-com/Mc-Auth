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
      [clientID, mcUUID, redirect_uri, state, scope], (err, res) => {
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
      [clientID, mcUUID, redirect_uri, state, scope], (err, res) => {
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
      [clientID, mcUUID, redirect_uri, state, scope], (err, res) => {
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
      [clientID, exchangeToken, redirect_uri], (err, res) => {
        if (err) return callback(err);

        callback(null, res.rows.length > 0 ? res.rows[0] : null);
      });
  },

  /* Queue: UserAgent */
  /**
   * @param {String} userAgent 
   * @param {Boolean} internal 
   * @param {Function} callback 
   */
  // getAgentID(userAgent, internal, callback) {
  //   if (userAgent && userAgent.length > 255) {
  //     userAgent = userAgent.substring(0, 252) + '...';
  //   }

  //   pool.connect((err, con, done) => {
  //     if (err) return callback(err);

  //     con.query(`SELECT "ID" FROM "QueuingAgents" WHERE "Agent"=$1 AND "Internal"=$2;`,
  //       [userAgent, internal], (err, res) => {
  //         if (err) {
  //           done();
  //           return callback(err);
  //         }

  //         if (res.rowCount <= 0) {
  //           return con.query(`INSERT INTO "QueuingAgents" ("Agent","Internal") VALUES ($1,$2) RETURNING "ID";`,
  //             [userAgent, internal], (err, res) => {
  //               done();

  //               if (err) return callback(err);

  //               callback(null, res.rows[0]['ID']);
  //             });
  //         }
  //         done();

  //         return callback(null, res.rows[0]['ID']);
  //       });
  //   });
  // }
};