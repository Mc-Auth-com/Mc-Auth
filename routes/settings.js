const Utils = require('../utils'),
  db = require('../db/DB');

const router = require('express').Router();

router.post('/create', (req, res, next) => {
  if (!req.session['loggedIn']) return next(Utils.createError(400, 'ToDo: Not logged in'));

  if (!req.body.name) return Utils.createError(400, 'Missing Application-Name');
  if (req.body.name.length > 128) return Utils.createError(400, 'Application-Name exceed 128 characters');
  if (req.body.desc && req.body.desc.length > 512) return Utils.createError(400, 'Application-Description exceed 512 characters');

  db.createApplication(Utils.toNeutralString(req.body.name), Utils.toNeutralString(req.body.desc), req.session['mc_UUID'], (err, app) => {
    if (err) return next(Utils.logAndCreateError(err));

    res.redirect(`${Utils.Storage.BASE_URL}/settings/${app.id}`);
  });
});

router.post('/:appID', (req, res, next) => {
  if (!req.session['loggedIn']) return next(Utils.createError(400, 'ToDo: Not logged in'));

  const appID = req.body.client_id,
    name = Utils.toNeutralString(req.body.name || ''),
    desc = Utils.toNeutralString(req.body.desc || ''),
    redirectURIs = (req.body.redirect_uris || '').split(/\r?\n/).filter((el) => { return el; });

  if (!appID || !Utils.isNumber(appID)) return next(Utils.createError(404, 'ToDo: Invalid client_id'));

  if (!req.body.name) return Utils.createError(400, 'Missing Application-Name');
  if (req.body.name.length > 128) return Utils.createError(400, 'Application-Name exceed 128 characters');
  if (req.body.desc && req.body.desc.length > 512) return Utils.createError(400, 'Application-Description exceed 512 characters');

  let removedURIs = 0;
  const newRedirectURIs = redirectURIs.filter((el) => {
    if (!Utils.isAbsoluteURL(el)) {
      removedURIs++;

      return false;
    }

    return true;
  });
  newRedirectURIs.forEach((el) => { return Utils.toNeutralString(el) });

  db.getApplicationForOwner(appID, req.session['mc_UUID'], (err, app) => {
    if (err && err.code != 22003 /* numeric_value_out_of_range */) return next(Utils.logAndCreateError(err));
    if (!app || app.deleted) return next(Utils.createError(403, 'ToDo: Invalid client_id or not the owner'));

    db.updateApplication(app.id, name, desc, newRedirectURIs, (err) => {
      if (err) return next(Utils.logAndCreateError(err));

      const note = removedURIs > 0 ? (`&note=${encodeURIComponent('Removed ' + removedURIs + ' invalid redirect URI' + (removedURIs != 1 ? 's' : ''))}`) : '';
      res.redirect(`${Utils.Storage.BASE_URL}/settings/${app.id}?success=true${note}`);  //TODO: Beim Seitenaufruf mit ?success und note auch eine Meldung zeigen
    });
  });
});

router.get('/:appID?', (req, res, next) => {
  if (!req.session['loggedIn']) return next(Utils.createError(400, 'ToDo: Not logged in'));

  const appID = req.params.appID;

  if (appID) {
    if (appID.toLowerCase() == 'create') {
      Utils.Minecraft.getUsername(req.session['mc_UUID'], (err, username) => {
        if (err) Utils.logAndCreateError(err);

        return res.send(Utils.HTML.formatHTML(req, Utils.HTML.replaceVariables(req, username, Utils.Storage.SETTINGS_CREATE)));
      });
    } else {
      if (!Utils.isNumber(appID)) return next(Utils.createError(404, 'ToDo: Invalid client_id'));

      db.getApplication(appID, (err, app) => {
        if (err && err.code != 22003 /* numeric_value_out_of_range */) return next(Utils.logAndCreateError(err));
        if (!app || app.deleted) return next(Utils.createError(404, 'ToDo: Invalid client_id'));

        Utils.Minecraft.getUsername(req.session['mc_UUID'], (err, username) => {
          if (err) Utils.logAndCreateError(err);

          return res.send(
            Utils.HTML.formatHTML(req,
              Utils.HTML.replaceVariables(req, username, Utils.Storage.SETTINGS_APP, Utils.HTML.appVariableCallback, [app, username, true])
            )
          );
        });
      });
    }
  } else {
    db.getActiveApplications(req.session['mc_UUID'], (err, apps) => {
      if (err) return next(Utils.logAndCreateError(err));

      Utils.Minecraft.getUsername(req.session['mc_UUID'], (err, username) => {
        if (err) Utils.logAndCreateError(err);

        res.send(
          Utils.HTML.formatHTML(req, Utils.HTML.replaceVariables(req, username, Utils.Storage.SETTINGS), Utils.HTML.appsFormatCallback, [apps])
        );
      });
    });
  }
});

module.exports = router;