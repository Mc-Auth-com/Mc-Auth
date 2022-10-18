import { Pool, PoolClient } from 'pg';

import { Grant, GrantType, mcAuthAccount, mcAuthDbCfg, OAuthApp, OAuthAppIcon } from '../global';
import { ApiError } from './ApiError';
import ApiErrs from './ApiErrs';

export class DbUtils {
  private pool: Pool | null = null;

  constructor(dbCfg: mcAuthDbCfg) {
    this.pool = new Pool({
      host: dbCfg.host,
      port: dbCfg.port,
      user: dbCfg.user,
      password: dbCfg.password,
      database: dbCfg.database,
      ssl: dbCfg.ssl ? {rejectUnauthorized: false} : false,
      max: dbCfg.connectionPoolSize
    });

    this.pool.on('error', (err, _client) => {
      ApiError.fromError(err, 500, true); // Log error
    });
  }

  /* Account */
  async updateAccount(mcUUID: string, mcName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query('INSERT INTO accounts(id,name,last_login) VALUES($1,$2,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name=$2,last_login=CURRENT_TIMESTAMP;',
          [mcUUID, mcName], (err, _res) => {
            if (err) return reject(err);

            resolve();
          });
    });
  }

  async setAccountEmailAddress(mcUUID: string, email: string | null): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query('UPDATE accounts SET email =$2,email_pending =NULL,email_pending_since =NULL WHERE id=$1;',
          [mcUUID, email], (err, _res) => {
            if (err) return reject(err);

            resolve();
          });
    });
  }

  async setAccountPendingEmailAddress(mcUUID: string, email: string | null): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query('UPDATE accounts SET email_pending =$2,email_pending_since =CURRENT_TIMESTAMP WHERE id=$1;', [mcUUID, email], (err, _res) => {
        if (err) return reject(err);

        resolve();
      });
    });
  }

  async getAccount(id: string): Promise<mcAuthAccount | null> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query('SELECT * FROM accounts WHERE id =$1;', [id], (err, res) => {
        if (err) return reject(err);

        resolve(res.rows.length > 0 ? RowUtils.toAccount(res.rows[0]) : null);
      });
    });
  }

  /* Apps */

  async createApp(mcUUID: string, name: string, website: string, description: string | null): Promise<OAuthApp> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query('INSERT INTO apps(owner,name,website,description) VALUES($1,$2,$3,$4) RETURNING *;', [mcUUID, name, website, description], (err, res) => {
        if (err) return reject(err);

        resolve(RowUtils.toApp(res.rows[0]));
      });
    });
  }

  async setApp(id: string, name: string, website: string, redirectURIs: string[], description: string | null, iconID: string | null): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query('UPDATE apps SET name =$2,website =$3,redirect_uris =$4,description =$5,icon =$6 WHERE id=$1;',
          [id, name, website, JSON.stringify(redirectURIs), description, iconID], (err, _res) => {
            if (err) return reject(err);

            resolve();
          });
    });
  }

  async setAppDeleted(id: string, deleted: boolean = true): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query('UPDATE apps SET deleted =$2 WHERE id=$1;', [id, deleted], (err, _res) => {
        if (err) return reject(err);

        resolve();
      });
    });
  }

  async getApp(id: string): Promise<OAuthApp | null> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query('SELECT * FROM apps WHERE id =$1;', [id], (err, res) => {
        if (err) return reject(err);

        resolve(res.rows.length > 0 ? RowUtils.toApp(res.rows[0]) : null);
      });
    });
  }

  async getApps(mcUUID: string, includeDeletedApps: boolean = false): Promise<OAuthApp[]> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query(`SELECT * FROM apps WHERE owner =$1 ${!includeDeletedApps ? 'AND deleted =FALSE' : ''};`, [mcUUID], (err, res) => {
        if (err) return reject(err);

        const result = [];

        for (const row of res.rows) {
          result.push(RowUtils.toApp(row));
        }

        resolve(result);
      });
    });
  }

  async regenerateAppSecret(id: string): Promise<OAuthApp['secret'] | null> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query('UPDATE apps SET secret =DEFAULT WHERE id =$1 RETURNING secret;', [id], (err, res) => {
        if (err) return reject(err);

        resolve(res.rows.length != 0 ? RowUtils.toApp(res.rows[0]).secret : null);
      });
    });
  }

  /* Icons */
  async createImage(mcUUID: string, orgImg: Buffer, optImg: Buffer): Promise<{ found: boolean, iconID: OAuthAppIcon['id'] }> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.connect((err, client, done) => {
        if (err) return reject(err);

        client.query('BEGIN', (err) => {
          if (this.shouldAbortTransaction(client, done, err)) return reject(err);

          client.query('LOCK TABLE icons IN ACCESS EXCLUSIVE MODE;', (err) => {
            if (this.shouldAbortTransaction(client, done, err)) return reject(err);

            client.query('SELECT id as original_id,' +
                '(SELECT i.id as added_by_duplicate_id FROM icons i WHERE (icons.id =i.id OR icons.id =i.duplicate_of) AND added_by =$1)' +
                'FROM icons WHERE original =$2 LIMIT 1;',
                [mcUUID, orgImg], (err, res) => {
                  if (this.shouldAbortTransaction(client, done, err)) return reject(err);

                  let insertQuery: string | null = null,
                      queryArgs: any[] | null = null;

                  try {
                    if (res.rows.length == 0) { // image not in database
                      insertQuery = 'INSERT INTO icons(optimized,original,added_by) VALUES($1,$2,$3) RETURNING id;';
                      queryArgs = [optImg, orgImg, mcUUID];
                    } else if (!res.rows[0].added_by_duplicate_id) {  // image in database but not uploaded by given user
                      insertQuery = 'INSERT INTO icons(duplicate_of,added_by) VALUES($1,$2) RETURNING id;';
                      queryArgs = [res.rows[0].added_by_duplicate_id, mcUUID];
                    }
                  } catch (err) {
                    return reject(err);
                  }

                  if (insertQuery != null && queryArgs != null) {
                    client.query(insertQuery, queryArgs, (err, insertRes) => {
                      if (this.shouldAbortTransaction(client, done, err)) return reject(err);

                      client.query('COMMIT', (err) => {
                        done();
                        if (err) return reject(err);

                        resolve({found: false, iconID: insertRes.rows[0].id});
                      });
                    });
                  } else {  // image already exists
                    client.query('ROLLBACK', (err) => {
                      done();
                      if (err) return reject(err);

                      resolve({found: true, iconID: res.rows[0].added_by_duplicate_id});
                    });
                  }
                });
          });
        });
      });
    });
  }

  async getIcon(id: string): Promise<OAuthAppIcon | null> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query('SELECT * FROM icons WHERE id =$1;', [id], (err, res) => {
        if (err) return reject(err);

        resolve(res.rows.length > 0 ? RowUtils.toAppIcon(res.rows[0]) : null);
      });
    });
  }

  async getOptimizedIconBuffer(id: string): Promise<OAuthAppIcon['optimizedImg'] | null> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query('SELECT icons.optimized as img1,i.optimized as img2 FROM icons LEFT JOIN icons i ON icons.duplicate_of =i.id WHERE icons.id =$1;', [id], (err, res) => {
        if (err) return reject(err);

        resolve(res.rows.length > 0 ? res.rows[0].img1 || res.rows[0].img2 : null);
      });
    });
  }

  async doesIconExist(id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query('SELECT EXISTS(SELECT FROM icons WHERE id =$1);', [id], (err, res) => {
        if (err) return reject(err);

        resolve(res.rows.length > 0 ? res.rows[0].exists : false);
      });
    });
  }

  /* OTPs */
  async invalidateOneTimePassword(mcUUID: string, otp: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query(`DELETE FROM otps WHERE account =$1 AND code =$2 AND issued >= CURRENT_TIMESTAMP - INTERVAL '5 MINUTES' RETURNING *;`, [mcUUID, otp], (err, res) => {
        if (err) return reject(err);

        resolve(res.rows.length > 0);
      });
    });
  }

  /* Grants */

  async createGrant(clientID: string, mcUUID: string, redirectURI: string, responseType: string, state: string | null, scopes: string[]): Promise<Grant> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query('INSERT INTO grants(app,account,redirect_uri,response_type,state,scopes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *;',
          [clientID, mcUUID, redirectURI.toLowerCase(), responseType, state, JSON.stringify(scopes)], (err, res) => {
            if (err) return reject(err);

            resolve(RowUtils.toGrant(res.rows[0]));
          });
    });
  }

  async setGrantResult(grantID: string, granted: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query(`UPDATE grants SET result ='${granted ? 'GRANTED' : 'DENIED'}'::"GrantResult" WHERE id =$1;`, [grantID], (err, res) => {
        if (err) return reject(err);

        return resolve();
      });
    });
  }

  async getGrant(grantID: string): Promise<Grant | null> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query(`SELECT *,(issued >= CURRENT_TIMESTAMP - INTERVAL '24 HOURS') as issued_during_last_24_hours FROM grants WHERE id =$1;`,
          [grantID], (err, res) => {
            if (err) return reject(err);

            return resolve(res.rows.length > 0 ? RowUtils.toGrant(res.rows[0]) : null);
          });
    });
  }

  async generateExchangeToken(grantID: string): Promise<Grant['exchangeToken']> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query('UPDATE grants SET exchange_token=random_string(32) WHERE id =$1 RETURNING exchange_token;', [grantID], (err, res) => {
        if (err) return reject(err);

        return resolve(RowUtils.toGrant(res.rows[0]).exchangeToken);
      });
    });
  }

  async generateAccessToken(grantID: string): Promise<Grant['accessToken']> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));


      this.pool.query(`UPDATE grants SET access_token=random_string(32),result='GRANTED'::"GrantResult" WHERE id =$1 RETURNING access_token;`, [grantID], (err, res) => {
        if (err) return reject(err);

        return resolve(RowUtils.toGrant(res.rows[0]).accessToken);
      });
    });
  }

  async invalidateExchangeToken(appId: string, exchange_token: string, redirect_uri: string): Promise<Grant | null> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject(ApiError.create(ApiErrs.NO_DATABASE, {pool: this.pool}));

      this.pool.query(`UPDATE grants SET access_token =random_string(32) WHERE app =$1 AND access_token IS NULL AND exchange_token =$2 AND lower(redirect_uri) =lower($3) AND result ='GRANTED'::"GrantResult" AND issued >= CURRENT_TIMESTAMP - INTERVAL '5 MINUTES' RETURNING *;`,
          [appId, exchange_token, redirect_uri], (err, res) => {
            if (err) return reject(err);

            resolve(res.rows.length > 0 ? RowUtils.toGrant(res.rows[0]) : null);
          });
    });
  }

  /* Helper */

  isAvailable(): boolean {
    return this.pool != null;
  }

  async isReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.pool == null) return reject();

      this.pool.query('SELECT NOW();')
          .then(() => resolve())
          .catch((err) => reject(err));
    });
  }

  getPool(): Pool | null {
    return this.pool;
  }

  async shutdown(): Promise<void> {
    if (this.pool == null) {
      return new Promise((resolve) => resolve());
    }

    const result = this.pool.end();
    this.pool = null;

    return result;
  }

  private shouldAbortTransaction(client: PoolClient, done: (release?: any) => void, err: Error): boolean {
    if (err) {
      client.query('ROLLBACK', (rollbackErr) => {
        done();

        if (rollbackErr) {
          ApiError.log(500, 'Error rolling back pg-client', true, {rollbackErr, lastQueryErr: err});  // log error
        }
      });
    }

    return !!err;
  }
}

class RowUtils {
  static toApp(row: any): OAuthApp {
    return {
      id: row.id,
      owner: row.owner,
      name: row.name,
      description: row.description,
      website: row.website,
      iconID: row.icon,
      redirectURIs: row.redirect_uris,
      secret: row.secret,
      verified: row.verified,
      deleted: row.deleted,
      created: row.created
    };
  }

  static toAccount(row: any): mcAuthAccount {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      emailPending: row.email_pending,
      emailPendingSince: row.email_pending_since,
      lastLogin: row.last_login
    };
  }

  static toAppIcon(row: any): OAuthAppIcon {
    return {
      id: row.id,
      optimizedImg: row.optimized,
      originalImg: row.original,
      duplicateOf: row.duplicate_of,
      addedBy: row.added_by,
      added: row.added
    };
  }

  static toGrant(row: any): Grant {
    return {
      id: row.id,
      appId: row.app,
      mcAccountId: row.account,
      result: row.result as GrantType | null,
      scopes: row.scopes,
      responseType: row.response_type,
      state: row.state,
      accessToken: row.access_token,
      exchangeToken: row.exchange_token,
      redirectUri: row.redirect_uri,
      issued: row.issued,
      issuedDuringLast24Hours: row.issued_during_last_24_hours
    };
  }
}


// original code below
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
