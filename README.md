<p align="center">
  <img alt="Mc-Auth Logo" width="128px" height="auto" src="./docs/images/Mc-Auth.svg">
</p>

<p align="center">
  <a href="https://sprax.me/discord">
    <img alt="Get Support on Discord"
         src="https://img.shields.io/discord/344982818863972352.svg?label=Get%20Support&logo=Discord&color=blue">
  </a>
  <a href="https://www.patreon.com/sprax">
    <img alt="Support me on Patreon"
         src="https://img.shields.io/badge/-Support%20me%20on%20Patreon-%23FF424D?logo=patreon&logoColor=white">
  </a>
</p>

<p align="center">
  <a href="https://github.com/Mc-Auth-com/Mc-Auth/actions?query=workflow%3A%22TypeScript+Compile%22">
    <img alt="TypeScript Compile" src="https://github.com/Mc-Auth-com/Mc-Auth/workflows/TypeScript%20Compile/badge.svg">
  </a>

  <a href="https://sonarcloud.io/dashboard?id=Mc-Auth-com_Mc-Auth">
    <img alt="Quality Gate Status"
         src="https://sonarcloud.io/api/project_badges/measure?project=Mc-Auth-com_Mc-Auth&metric=alert_status">
  </a>

  <a href="https://sonarcloud.io/dashboard?id=Mc-Auth-com_Mc-Auth">
    <img alt="Security Rating"
         src="https://sonarcloud.io/api/project_badges/measure?project=Mc-Auth-com_Mc-Auth&metric=security_rating">
  </a>
</p>

# Mc-Auth
Use your Minecraft account to easily log in, without giving your password or email to some random website!
Thanks to Mc-Auth, you can securely log in to third-party services without providing your sensitive data to Mc-Auth!

It aims to be highly transparent to users **and** developers.
Thanks to this transparency, it is easily compliant with most data protection laws
e.g. the **[GDPR](https://en.wikipedia.org/wiki/General_Data_Protection_Regulation)**.

### Another Authentication Service for Minecraft? Really?
I know there is *[minecraft.id](https://minecraft.id/) by inventivetalent* or
*[Minecraft oAuth](https://mc-oauth.net/) by Deftware* (and some more),
but I had something different in mind for my project [SkinDB.net](https://github.com/SkinDB).
They look nice and get the job done, but are lacking information about how your data is treated (e.g. GDPR compliant?).
Another feature I missed was full oAuth2 implementation.
What would normally be done by Mojang as account holders, but they didn't (until now).

So I started reading [RFC 6749](https://tools.ietf.org/html/rfc6749) to understand how oAuth2 works
and has to be implemented => Mc-Auth.com was born!

## How to use Mc-Auth?
If you are a developer, you can check [the documentation](https://github.com/Mc-Auth-com/Mc-Auth/wiki) and find out
more about using Mc-Auth.

If you are a normal Minecraft player and a website or application you are using might find this interesting,
feel free to contact them with a link to this project – While making the Minecraft Community a safer place!


## Setup
**You'll need [Node.js and npm](https://nodejs.org/en/download/package-manager/) and
access to a PostgreSQL instance on your machine**

1. Prepare your database by running `./database-setup.sql`
2. `npm install`
3. `npm run build` (needs to be rerun every time the app is updated)
4. `npm run start` Or you can use `npm run dev` to automatically recompile on file changes (not recommended for production)
4. Configure all files inside `./storage` (automatically generated)
6. Type `rs` into the console or restart the process

7. Visit [Mc-Auth-com/McAuth-BungeeCord](https://github.com/Mc-Auth-com/McAuth-BungeeCord) and continue by setting it up


## TODO
* **Complete Recode ([#70](https://github.com/Mc-Auth-com/Mc-Auth-Web/pull/70))**
  * Redesign how localization files look and move to Crowdin
  * [X] Recode demo page
  * [X] Cache HTML in memory (for every language)
* Finish settings pages
  * Account
    * Show public Minecraft account data (as an example)
    * [X] Adding and confirming an email address
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
* When uploading an app icon: Show notification that the user needs to use the 'Save' button
* Send 'Content Security Policy' header
* Allow users to report applications (inside authorization screen)
* Introduce rate limits
* Create documentation/wiki
* Create a Brand/Press Kit with images
  * With HTML Examples for buttons
* Replace 'Google Analytics'
* Admin Dashboard


## Thanks To... ✨
<table>
  <tr>
    <td align="center">
      <a href="https://github.com/JNSAPH">
        <img src="https://avatars3.githubusercontent.com/u/35976079" width="100px" alt="JNSAPH GitHub-Logo"><!--
        --><br><!--
        --><sub><b>Jonas</b></sub>
      </a>
      <br>
      🎨 Logo and Banner
    </td>
    <td align="center">
      <a href="https://github.com/briannastatic">
        <img src="https://avatars3.githubusercontent.com/u/26376600" width="100px" alt="briannastatic GitHub-Logo"><!--
        --><br><!--
        --><sub><b>Brianna O'Keefe</b></sub>
      </a>
      <br>
      🌍 English Translations
    </td>
  </tr>
</table>

<table>
  <tr>
    <td>
      <a href="https://www.cloudflare.com/" title="Improve page performance and availability">
        <img src="https://www.cloudflare.com/img/logo-cloudflare-dark.svg" width="100px" alt="CloudFlare branding"><!--
        --><br><!--
        --><sub><b>CloudFlare Free</b></sub>
      </a>
    </td>
    <td>
      <a href="https://www.jetbrains.com/" title="Provides great tools and IDEs">
        <img src="https://i.imgur.com/RISnfij.png" width="100px" alt="JetBrains branding"><!--
        --><br><!--
        --><sub><b>JetBrains OS License</b></sub>
      </a>
    </td>
  </tr>
</table>


## License
[MIT License](./LICENSE)