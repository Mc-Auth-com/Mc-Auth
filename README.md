# Mc-Auth-Web [![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=Mc-Auth-com_Mc-Auth-Web&metric=ncloc)](https://sonarcloud.io/dashboard?id=Mc-Auth-com_Mc-Auth-Web) [![Discord-Chat](https://img.shields.io/discord/344982818863972352?label=Discord&logo=discord&logoColor=white)](https://sprax.me/discord)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Mc-Auth-com_Mc-Auth-Web&metric=alert_status)](https://sonarcloud.io/dashboard?id=Mc-Auth-com_Mc-Auth-Web) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Mc-Auth-com_Mc-Auth-Web&metric=security_rating)](https://sonarcloud.io/dashboard?id=Mc-Auth-com_Mc-Auth-Web) [![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=Mc-Auth-com_Mc-Auth-Web&metric=duplicated_lines_density)](https://sonarcloud.io/dashboard?id=Mc-Auth-com_Mc-Auth-Web)

Mc-Auth-Web is used for [mc-auth.com](https://mc-auth.com). You can easily login with your Minecraft-Account without giving your password or account e-mail away! This way you can securely login to third-party services that use [mc-auth.com](https://mc-auth.com).

It aims to be highly transparent to users **and** developers.
Thanks to this transparency it is easily compliant with most data protection laws e.g. the **[GDPR](https://en.wikipedia.org/wiki/General_Data_Protection_Regulation)**.

### Another Authentication Service for Minecraft? Really?
I know there is *[MCAuth](https://github.com/MC-Auth) by inventivetalent* or *[Minecraft oAuth](https://mc-oauth.net/) by Deftware* (and some more) but I wanted something different for my project [SkinDB.net](https://skindb.net).
They look neat and both work, but mentions nowhere what happens with your data (I live inside the EU, so I need to be GDPR compliant!).
Another problem would be that I wanted full oAuth2 implementation. What normally would be done by Mojang as account holders, but they didn't (at least until now).

So I read some [oAuth2 paper](https://tools.ietf.org/html/rfc6749) and started writing down what [mc-auth.com](https://mc-auth.com) should be able to do and what the user should be able to do.

## Setup
**You'll need [Node.js and npm](https://nodejs.org/en/download/package-manager/) on your machine and a PostgreSQL instance**

1. Prepare your PostgreSQL server by running `./database-setup.sql`
2. `npm install`
3. `npm run build` (needs to be rerun every time the app is updated)
4. `npm run start` Or you can use `npm run dev` to automatically recompile on file changes (not recommended for production)
4. Configure all files inside `./storage` (automatically generated)
6. Type `rs` into the console or restart the process

## TODO
* **Complete Recode ([#70](https://github.com/Mc-Auth-com/Mc-Auth-Web/pull/70))**
  * Redesign how localization files look and move to Crowdin
  * [X] Recode demo page
  * [X] Cache HTML in memory (for every language)
* Finish settings pages
  * Account
    * Show public Minecraft account data (as example)
    * [X] Adding and confirming email address
    * Export account data
  * Account Security
    * Show active sessions (+IP, User-Agent, ...)
    * Show all apps that have been granted access
  * Notification
    * Allow enabling/disabling email notifications for specific events
  * oAuth Apps
    * [X] Delete button
* Allow grants to be temporary (60 days without activity by default)
* Fully implement verified applications
  * Force 2FA when editing verified apps
* When uploading an app icon: Show notification that user needs to use the 'Save' button
* Send 'Content Security Policy' header
* Allow users to report applications (in authorization screen)
* Introduce rate limits
* Create documentation/wiki
* Create Brand/Press Kit with images
  * With HTML Examples for buttons
* Replace 'Google Analytics'
* Admin Dashboard

## Contributors ✨
<table>
  <tr>
    <td align="center"><a href="https://github.com/JonasAlpha"><img src="https://avatars1.githubusercontent.com/u/35976079" width="100px" alt=""><br><sub><b>Jonas</b></sub></a><br>🎨 Logo and Banner</td>
    <td align="center"><a href="https://github.com/Songoda"><img src="https://avatars2.githubusercontent.com/u/26376600" width="100px" alt=""><br><sub><b>Brianna O'Keefe</b></sub></a><br>🌍 English Translations</td>
  </tr>
</table>

## License
[MIT License](./LICENSE)