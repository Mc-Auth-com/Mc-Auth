import { Router } from 'express';
import { readFileSync } from 'fs';
import { join as joinPath } from 'path';
import sharp from 'sharp';

import { db, pageGenerator } from '..';
import ApiErrs from '../utils/ApiErrs';
import { ApiError } from '../utils/errors';
import { restful } from '../utils/_old_utils';
import Utils from '../utils/Utils';

const router = Router(),
    routerNoCookie = Router();
export const uploadsRouter = router,
    uploadsNoCookieRouter = routerNoCookie;

const DEFAULT_ICON: Buffer = readFileSync(joinPath(__dirname, '..', '..', 'resources', 'web', 'static', 'uploads', 'default.png'));

// TODO Add rate limit to upload

routerNoCookie.all<{ fileID?: any }>('/:fileID?', (req, res, next) => {
  restful(req, res, next, {
    get: async () => {
      let fileID = req.params['fileID']?.toLowerCase() || null;

      // Validate user input
      if (typeof fileID != 'string' || !fileID.endsWith('.png') || fileID == '.png') return next(new ApiError(404, 'Not Found', false));

      // Prepare user input
      fileID = fileID.substring(0, fileID.lastIndexOf('.png'));

      let status = 200;

      if (Utils.isNumeric(fileID)) {
        try {
          const file = await db.getOptimizedIconBuffer(fileID);

          if (file != null && file.length != 0) {
            return res.type('png')
                .send(file);
          } else {
            status = 404;
          }
        } catch (err) {
          return next(err);
        }
      }

      return res.status(status)
          .type('png')
          .send(DEFAULT_ICON);
    },
    post: next  // Fallthrough and call non-noCookie router
  });
});

router.all('/', (req, res, next) => {
  restful(req, res, next, {
    post: () => {
      if (!req.session?.loggedIn) return next(ApiError.create(ApiErrs.UNAUTHORIZED));

      if (!req.body || !(req.body instanceof Buffer) || req.body.length == 0) return next(new ApiError(400, 'Invalid image', false));

      sharp(req.body)
          .png()
          .resize(128, 128, {fit: 'contain', kernel: 'nearest', background: {r: 0, g: 0, b: 0, alpha: 0}})
          .toBuffer((err, buffer, info) => {
            if (err) return next(new ApiError(400, 'Invalid image', false));
            if (info.width < 64 || info.height < 64) return next(new ApiError(400, 'Unsupported image dimensions', false));
            if (!req.session?.mcProfile?.id) return next(ApiError.create(ApiErrs.INTERNAL_SERVER_ERROR, {'req.session?.mcProfile?.id': req.session?.mcProfile?.id}));

            db.createImage(req.session?.mcProfile?.id, req.body, buffer)
                .then((appIcon) => {
                  const imgURL = `${pageGenerator.globals.url.base}/uploads/${appIcon.iconID}.png`;

                  if (!appIcon.found) {
                    res.location(imgURL);
                  }

                  res.status(appIcon.found ? 200 : 201)
                      .send({id: appIcon.iconID, url: imgURL});
                })
                .catch(next);
          });
    }
  });
});
