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

/* Helper */
function firstRow(res, key = null) {
  const result = res.rows.length > 0 ? res.rows[0] : null;

  return (result && key) ? result[key] : result;
}

/* exports */
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
    pool.query(`SELECT * FROM applications WHERE id =$1;`, [clientID], (err, res) => {
      if (err) return callback(err);

      return callback(null, firstRow(res));
    });
  },

  /**
   * @param {String} clientID 
   * @param {String} mcUUID
   * @param {Function} callback 
   */
  getApplicationForOwner(clientID, mcUUID, callback) {
    pool.query(`SELECT * FROM applications WHERE id =$1 AND owner =$2::UUID;`,
      [clientID, mcUUID], (err, res) => {
        if (err) return callback(err);

        return callback(null, firstRow(res));
      });
  },

  /**
   * @param {String} mcUUID 
   * @param {Function} callback 
   */
  getActiveApplications(mcUUID, callback) {
    pool.query(`SELECT * FROM applications WHERE owner =$1::UUID AND deleted =FALSE ORDER BY created DESC;`,
      [mcUUID], (err, res) => {
        if (err) return callback(err);

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
  updateApplication(clientID, name, description, icon, redirectURIs, callback) {
    pool.query(`UPDATE applications SET name =$2, description =$3, icon =$4, redirect_uris =$5 WHERE id =$1;`,
      [clientID, name, description, icon, JSON.stringify(redirectURIs)], (err, _res) => {
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

        callback(null, firstRow(res));
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

        callback(null, firstRow(res));
      });
  },

  /* Grants */

  /**
   * @param {String} grantID 
   * @param {Function} callback 
   */
  getUnusedGrant(grantID, mcUUID, callback) {
    pool.query(`SELECT * FROM grants WHERE id =$1 AND result ='NONE'::"GrantResult" AND mc_uuid =$2 AND issued >= CURRENT_TIMESTAMP - INTERVAL '24 HOUR';`,
      [grantID, mcUUID], (err, res) => {
        if (err) return callback(err);

        return callback(null, firstRow(res));
      });
  },

  /**
   * @param {String} clientID 
   * @param {String} mcUUID
   * @param {String} redirectURI
   * @param {String} state
   * @param {String[]} scope
   * @param {Function} callback 
   */
  generateGrant(clientID, mcUUID, redirectURI, state, scope, callback) {
    pool.query(`INSERT INTO grants(application,mc_uuid,redirect_uri,state,scope) VALUES ($1,$2,$3,$4,$5) RETURNING *;`,
      [clientID, mcUUID, redirectURI.toLowerCase(), state, JSON.stringify(scope)], (err, res) => {
        if (err) return callback(err);

        callback(null, firstRow(res));
      });
  },

  /**
   * @param {String} clientID 
   * @param {String} mcUUID
   * @param {String} redirectURI
   * @param {String} state
   * @param {String[]} scope
   * @param {Function} callback 
   */
  generateAccessToken(clientID, mcUUID, redirectURI, state, scope, callback) {
    pool.query(`INSERT INTO grants(application,mc_uuid,redirect_uri,state,scope,access_token,result) VALUES ($1,$2,$3,$4,$5,random_string(32),'GRANTED'::"GrantResult") RETURNING access_token;`,
      [clientID, mcUUID, redirectURI.toLowerCase(), state, JSON.stringify(scope)], (err, res) => {
        if (err) return callback(err);

        callback(null, firstRow(res, 'access_token'));
      });
  },

  /**
   * @param {String} clientID 
   * @param {String} redirectURI
   * @param {Function} callback err (Error), success (Boolean)
   */
  invalidateExchangeToken(clientID, exchangeToken, redirectURI, callback) {
    pool.query(`UPDATE grants SET access_token =random_string(32) WHERE application =$1 AND access_token IS NULL AND exchange_token =$2 AND redirect_uri =$3 AND result ='GRANTED'::"GrantResult" AND issued >= CURRENT_TIMESTAMP - INTERVAL '5 MINUTES' RETURNING *;`,
      [clientID, exchangeToken, redirectURI.toLowerCase()], (err, res) => {
        if (err) return callback(err);

        callback(null, firstRow(res));
      });
  },

  /**
   * @param {String} grantID 
   * @param {Boolean} granted
   * @param {Function} callback err (Error)
   */
  setGrantResult(grantID, granted, callback) {
    pool.query(`UPDATE grants SET result ='${granted ? 'GRANTED' : 'DENIED'}'::"GrantResult" WHERE id =$1;`, [grantID], (err, _res) => {
      callback(err || null);
    });
  },

  /* Images */
  /**
   * @param {Buffer} png 
   * @param {Buffer} original 
   * @param {Function} callback 
   */
  createImage(png, original, callback) {  // What the actual fuck did I doe here o.0
    pool.connect((err, client, done) => {
      if (err) {
        done();
        return callback(err);
      }

      client.query(`SELECT id FROM images WHERE original =$1;`, [original], (err, res) => {
        if (err) {
          done();
          return callback(err);
        }

        if (firstRow(res, 'id')) {
          done();

          module.exports.getImageID(original, callback);
        } else {
          client.query(`INSERT INTO images(optimized,original) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id;`,
            [png, original], (err, res) => {
              if (err) {
                done();
                return callback(err);
              }

              if (firstRow(res, 'id')) {
                return callback(err, firstRow(res, 'id'));
              }

              this.getImageID(original, (err, id) => {
                done();
                if (err) return callback(err);

                return this.getOptimizedImage(id, callback);
              });
            });
        }
      });
    });
  },

  /**
   * @param {Buffer} original 
   * @param {Function} callback 
   */
  getImageID(original, callback) {
    pool.query(`SELECT id FROM images WHERE original =$1;`, [original], (err, res) => {
      if (err) return callback(err);

      callback(null, firstRow(res, 'id'));
    });
  },

  /**
   * @param {Number|String} id 
   * @param {Function} callback 
   */
  getOptimizedImage(id, callback) {
    pool.query(`SELECT optimized FROM images WHERE id =$1;`, [id], (err, res) => {
      if (err) return callback(err);

      callback(null, firstRow(res, 'optimized'));
    });
  }
};

/* Maintenance */

// setInterval(async () => {
  // pool.query(`DELETE FROM grants WHERE issued < CURRENT_TIMESTAMP - INTERVAL '24 HOUR' RETURNING *;`,
  //   [], (err, res) => {
  //     if (err) return Utils.logAndCreateError(err);

  //     console.log(`Deleted ${res.rowCount} stale grants`);
  //   });

  // pool.query(`DELETE FROM otp WHERE issued < CURRENT_TIMESTAMP - INTERVAL '24 HOUR' RETURNING *;`,
  //   [], (err, res) => {
  //     if (err) return Utils.logAndCreateError(err);

  //     console.log(`Deleted ${res.rowCount} stale one-time-passwords`);
  //   });
// }, 3 * 24 * 60 * 60 * 1000 /* 3d */);