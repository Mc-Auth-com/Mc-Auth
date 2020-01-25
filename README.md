# Mc-Auth-Web [![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=Mc-Auth-com_Mc-Auth-Web&metric=ncloc)](https://sonarcloud.io/dashboard?id=Mc-Auth-com_Mc-Auth-Web) [![Discord-Chat](https://img.shields.io/discord/344982818863972352?label=Discord&logo=discord&logoColor=white)](https://sprax.me/discord)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Mc-Auth-com_Mc-Auth-Web&metric=alert_status)](https://sonarcloud.io/dashboard?id=Mc-Auth-com_Mc-Auth-Web) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Mc-Auth-com_Mc-Auth-Web&metric=security_rating)](https://sonarcloud.io/dashboard?id=Mc-Auth-com_Mc-Auth-Web) [![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=Mc-Auth-com_Mc-Auth-Web&metric=duplicated_lines_density)](https://sonarcloud.io/dashboard?id=Mc-Auth-com_Mc-Auth-Web)

Mc-Auth-Web is used for [mc-auth.com](https://mc-auth.com). You can easily login with your Minecraft-Account without giving your password or account e-mail away! This way you can securely login to third-party services that use [mc-auth.com](https://mc-auth.com).

It aims to be highly transparent to users **and** developers.
Thanks to this transparency it is easily compliant with most data protection laws e.g. the **[GDPR](https://en.wikipedia.org/wiki/General_Data_Protection_Regulation)**.

### Another Authentificatio Service for Minecraft? Really?
I know there is *[MCAuth](https://github.com/MC-Auth) by inventivetalent* or *[Minecraft oAuth](https://mc-oauth.net/) by Deftware* (and some more) but I wanted something different for my project [SkinDB.net](https://skindb.net).
They look neat and both work, but mentions nowhere what happens with your data (I live inside the EU, so I need to be GDPR compliant!).
Another problem would be that I wanted full oAuth2 implementation. What normally would be done by Mojang as account holders, but they didn't (at least until now).

So I read some [oAuth2 paper](https://tools.ietf.org/html/rfc6749) and started writeing down what [mc-auth.com](https://mc-auth.com) should be able to do and what the user should be able to do.

## Special Thanks To
**[@JonasAlpha](https://github.com/JonasAlpha)** Logo

**[@Songoda](https://github.com/Songoda)** English translation

## Setup
**You'll need [Node.js and npm](https://nodejs.org/en/download/package-manager/) on your machine and a PostgreSQL instance**

1. Prepare your PostgreSQL server by running the commands inside `./tables.sql`
2. `npm install`
3. `npm start`
4. Configure all files inside `./storage` (automatically generated)
5. Edit the first variables of the files `./storage.js` and `./.static/script-login.js`
6. Type `rs` into the console or restart the process

## TODO
* Settings: Show grants (accepted and denied ones)
* Create documentation/wiki
  * Create Brand/Press Kit with images
  * Create HTML-Button examples
* ~~Allow easy localization of HTML~~
  * ~~Functional Language-Switcher~~
  * Cache localized HTML
  * ~~Create english translation~~
  * ~~Create german translation~~
* Tell users that changes have been saved or that an upload failed/succeeded
* Rate-limit icon uploads
* Allow users to report applications (On grant-request)
* Add possibilities to be an verified application
* App-Settings
  * Allow deletion
  * Allow regenerating client_secret
  * fix text position
* Allow 2FA for Settings-Page (Applications)
  * Force for verified applications
* './.static/script-login.js' should not hold it's own `BASE_URL`
* Don't use Google Analytics (Something on webserver level is enough with a good dashboard)
* ~~Notify about cookies~~
* ~~Resize and crop uploaded images to fit inside 128px x 128px~~
* ~~Use reCAPTCHA when creating a new app~~
* ~~Cards (Login, Settings, App-Settings) go out of bounds when view-port is not high enough~~
* ~~App-Settings: Description looses line-breaks~~
* ~~Publish Demo-Application~~ 
* ~~When an application requests authorization and the user is not logged in, the user can't proceed as intended~~

## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FMc-Auth-com%2FMc-Auth-Web.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2FMc-Auth-com%2FMc-Auth-Web?ref=badge_large)
