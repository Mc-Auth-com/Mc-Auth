const htmlEscape = require('escape-html');

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

        let result = Utils.replacer(Utils.Storage.SETTINGS_CREATE, '${', '}', (str) => {
          try {
            switch (str) {
              case 'HTML_HEADER': return Utils.Storage.HEADER;
              case 'HTML_FOOTER': return Utils.Storage.FOOTER;
              case 'HTML_HEAD_TOP': return Utils.Storage.HEAD_TOP;
              case 'HTML_HEAD_BOTTOM': return Utils.Storage.HEAD_BOTTOM;

              case 'URL_STATIC_CONTENT': return Utils.Storage.STATIC_CONTENT_URL;
              case 'URL_BASE': return Utils.Storage.BASE_URL;
              case 'URL_DOCS': return Utils.Storage.DOCS_URL;
              case 'MINECRAFT_HOST': return Utils.Storage.MINECRAFT_HOST;

              case 'Minecraft_Username': return (username || req.session['mc_Name']);
              case 'Minecraft_UUID': return req.session['mc_UUID'];

              default: break;
            }
          } catch (err) {
            Utils.logAndCreateError(err);
          }

          return '';
        });

        result = Utils.replacer(result, '?{', '?}', (str) => {
          if (str.startsWith('LoggedIn:')) {
            if (req.session['loggedIn']) {
              return str.substring('LoggedIn:'.length, str.lastIndexOf('?:'));
            } else {
              let index = str.lastIndexOf('?:');

              return index >= 0 ? str.substring(index + 2) : '';
            }
          }
        });

        res.send(result);
      });
    } else {
      if (!Utils.isNumber(appID)) return next(Utils.createError(404, 'ToDo: Invalid client_id'));

      db.getApplication(appID, (err, app) => {
        if (err && err.code != 22003 /* numeric_value_out_of_range */) return next(Utils.logAndCreateError(err));
        if (!app || app.deleted) return next(Utils.createError(404, 'ToDo: Invalid client_id'));

        Utils.Minecraft.getUsername(req.session['mc_UUID'], (err, username) => {
          if (err) Utils.logAndCreateError(err);

          let result = Utils.replacer(Utils.Storage.SETTINGS_APP, '${', '}', (str) => {
            try {
              switch (str) {
                case 'HTML_HEADER': return Utils.Storage.HEADER;
                case 'HTML_FOOTER': return Utils.Storage.FOOTER;
                case 'HTML_HEAD_TOP': return Utils.Storage.HEAD_TOP;
                case 'HTML_HEAD_BOTTOM': return Utils.Storage.HEAD_BOTTOM;

                case 'URL_STATIC_CONTENT': return Utils.Storage.STATIC_CONTENT_URL;
                case 'URL_BASE': return Utils.Storage.BASE_URL;
                case 'URL_DOCS': return Utils.Storage.DOCS_URL;
                case 'MINECRAFT_HOST': return Utils.Storage.MINECRAFT_HOST;

                case 'Minecraft_Username': return (username || req.session['mc_Name']);
                case 'Minecraft_UUID': return req.session['mc_UUID'];

                case 'APP_ID': return app.id;
                case 'APP_NAME': return htmlEscape(app.name);
                case 'APP_SECRET': return app.secret;
                case 'APP_DESCRIPTION': return htmlEscape(app.description) || 'Du hast keine Beschreibung verfasst';
                case 'APP_DESCRIPTION_RAW': return app.description || '';
                case 'APP_OWNER_NAME': return username;
                case 'APP_PUBLISHED': return new Date(app.created).toDateString().substring(4);
                case 'APP_REDIRECT_URIs': return (app.redirect_uris || []).join('\r\n');

                default: return '';
              }
            } catch (err) {
              Utils.logAndCreateError(err);
            }

            return '';
          });

          result = Utils.replacer(result, '?{', '?}', (str) => {
            if (str.startsWith('LoggedIn:')) {
              if (req.session['loggedIn']) {
                return str.substring('LoggedIn:'.length, str.lastIndexOf('?:'));
              } else {
                let index = str.lastIndexOf('?:');

                return index >= 0 ? str.substring(index + 2) : '';
              }
            }
          });

          res.send(result);
        });
      });
    }
  } else {
    db.getActiveApplications(req.session['mc_UUID'], (err, apps) => {
      if (err) return next(Utils.logAndCreateError(err));

      Utils.Minecraft.getUsername(req.session['mc_UUID'], (err, username) => {
        if (err) Utils.logAndCreateError(err);

        let result = Utils.replacer(Utils.Storage.SETTINGS, '${', '}', (str) => {
          try {
            switch (str) {
              case 'HTML_HEADER': return Utils.Storage.HEADER;
              case 'HTML_FOOTER': return Utils.Storage.FOOTER;
              case 'HTML_HEAD_TOP': return Utils.Storage.HEAD_TOP;
              case 'HTML_HEAD_BOTTOM': return Utils.Storage.HEAD_BOTTOM;

              case 'URL_STATIC_CONTENT': return Utils.Storage.STATIC_CONTENT_URL;
              case 'URL_BASE': return Utils.Storage.BASE_URL;
              case 'URL_DOCS': return Utils.Storage.DOCS_URL;
              case 'MINECRAFT_HOST': return Utils.Storage.MINECRAFT_HOST;

              case 'Minecraft_Username': return (username || req.session['mc_Name']);
              case 'Minecraft_UUID': return req.session['mc_UUID'];

              default: break;
            }
          } catch (err) {
            Utils.logAndCreateError(err);
          }

          return '';
        });

        result = Utils.replacer(result, '?{', '?}', (str) => {
          if (str.startsWith('LoggedIn:')) {
            if (req.session['loggedIn']) {
              return str.substring('LoggedIn:'.length, str.lastIndexOf('?:'));
            } else {
              let index = str.lastIndexOf('?:');

              return index >= 0 ? str.substring(index + 2) : '';
            }
          } else if (str.startsWith('HasApps:')) {
            if (apps && apps.length > 0) {
              let result = '';
              const template = str.substring('HasApps:'.length, str.lastIndexOf('?:'));

              for (const app of apps) {
                result += Utils.replacer(template, '$?{', '}', (str) => {
                  try {
                    switch (str) {
                      case 'APP_ID': return app.id;
                      case 'APP_NAME': return htmlEscape(app.name);
                      case 'APP_LOGO_URL': return app.image;

                      default: break;
                    }
                  } catch (err) {
                    Utils.logAndCreateError(err);
                  }

                  return '';
                });
              }

              return result;
            } else {
              let index = str.lastIndexOf('?:');

              return index >= 0 ? str.substring(index + 2) : '';
            }
          }
        });

        res.send(result);
      });
    });
  }
});

module.exports = router;