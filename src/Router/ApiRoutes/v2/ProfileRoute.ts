import { handleRequestRestfully } from '@spraxdev/node-commons';
import Express from 'express';
import { getMinecraftApi } from '../../../Constants';
import { Grant } from '../../../global';
import { ApiError } from '../../../utils/ApiError';
import ApiErrs from '../../../utils/ApiErrs';

export default function handleProfileRequest(req: Express.Request, res: Express.Response, next: Express.NextFunction): void {
  handleRequestRestfully(req, res, next, {
    get: async (): Promise<void> => {
      const grant = res.locals.grant as Grant;
      if (grant == null) {
        throw new Error('res.locals.grant is null (authorization middleware not run?)');
      }

      try {
        const profile = await getMinecraftApi().getProfile(grant.mcAccountId) as object; // TODO: handle null value
        res.send(profile);
      } catch (err) {
        throw ApiError.create(ApiErrs.SRV_FETCHING_MINECRAFT_PROFILE, {uuid: grant.mcAccountId, error: err});
      }
    }
  });
}
