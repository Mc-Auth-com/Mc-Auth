// TODO: Move this to own (public) npm package
import { get as getHttp } from 'superagent';

import { httpUserAgent } from './errors';

export class MojangAPI {
  // TODO: Define multiple backends (SpraxAPI (+Fallback), MojangAPI)
  // TODO: handle User-Agent, 429, connection errs, ...

  static async getProfile(uuid: string): Promise<object | null> {
    return new Promise((resolve, reject) => {
      getHttp(`https://api.sprax2013.de/mc/profile/${uuid}`)
          .set('User-Agent', httpUserAgent)
          .end((err, res) => {
            if (res.status == 200) return resolve(res.body);
            if (res.status == 204 || res.status == 404 || !err) return resolve(null);

            reject(err);
          });
    });
  }
}
