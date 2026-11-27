# XIFO: the XI: Forever Offline phone app

![XIFO](assets/splash-icon.png)

The phone app for [XI: Forever Offline](https://github.com/Hurami89/xi-forever-offline). Five tabs:

- **Home**: the newest version and the start of its patch notes, who is in the chat room, The Hub, the Hall of Hardcore and links.
- **Chat**: Stinkshell, the one chat room shared by players in game, on xiforever.com and on phones (you show as `mobile: Name`).
- **Play**: three games behind a switch at the top, with your own characters. **Fishing**: portable fishing at the game's real fishing spots. **Ventures**: send squad mates off to level at the era's exp camps. **Cards**: Tetra Master with your character's cards. What they earn arrives in the game at the launcher's next PLAY.
- **Wiki**: the guide, built in so it works offline, refreshed from this repo's `wiki/` folder whenever you're online.
- **Me**: your characters as the launcher synced them (pair the phone with PAIR APP on the launcher's Characters page).

**Get it:**
- **No install, any device:** [xiforever.com/app](https://xiforever.com/app)
- **Android:** [XIFO.apk](https://github.com/Hurami89/xifo-app/releases/latest/download/XIFO.apk). Open it on your phone and allow installing from your browser when asked. Updates install over the old version, and the app tells you when there's a new one.
- **Windows / Linux:** the newest release's `XIFO-Setup-<version>.exe` or `XIFO-<version>.AppImage`. The PC app shows the live xiforever.com/app, so it is always up to date.

Four looks, behind the gear at the top right (Settings): **Dark Fantasy** (the default), **Online 2003**, **Vana'diel 2006** and **Frutiger Aero**. A look is colours, lettering and pictures; the layout is the same in all four (`src/Desktop.tsx` is the frame, `src/ui.tsx` the parts, `src/theme.ts` the looks).

## Editing the wiki
Edit or add a page in `wiki/` (markdown) and list it in `wiki/index.json`. Phones pick up the change the next time they open the WIKI tab; the next APK also carries it inside. Pictures: `![](banner_1)` ... `banner_5`, `hub`, `hc_cards`, `hc_iron`, `hc_steel`, `hc_silver`, `hc_random`.

## Releasing (one tag updates everywhere)
Raise `version` and `android.versionCode` in `app.json`, commit, and push a tag (`v1.2.0`). The *Release* workflow builds the Android APK, the Windows and Linux PC apps (`desktop/`, Electron) and the web version, and publishes them as one release. The hub (`dev/armory/update_app_web.py` in the kit repo) puts the web version on xiforever.com/app within 10 minutes; the PC app shows that page, so it updates with it; Android shows "a new version is out". The release key comes from the repo's Actions secrets (`XIFO_KEYSTORE_BASE64`, `XIFO_KEYSTORE_PASSWORD`, `XIFO_KEY_ALIAS`, `XIFO_KEY_PASSWORD`).

On a PC: `npm install`, then `npm run wiki` and `npx expo start` to try it in Expo Go or a browser.

## Fishing data
`src/fishData.json` comes from the game server's own fishing tables: `python tools/make_fish_data.py <xi-forever-offline-server checkout>` (era zones only). The rules are in `src/fishing/engine.ts` (hook chances, losses and skill-ups follow the server's `fishingutils.cpp`); `node tools/sim_fishing.js` plays a few hundred casts with them.

## Character pages
ME and FISH talk to the armory on xiforever.com (`dev/armory/armory_service.py` in the kit repo), which also serves the character pages, the Armory and the Hall of Fame.

## Art
`art/make_ui_icons.py` draws the small one-colour icons of the tab bar and the top bar (`assets/ui`); the app tints them with the look's colours.

`art/make_app_art.py` draws the app icons, buddy icons and emoticons (and the taskbar and 88x31 buttons of the old desktop layout, which the app no longer shows) with the launcher's Aero art code (`art-src/scripts/aero_lib.py` in the kit repo), and copies the Aero banners, The Hub banner and the hardcore shields and cards from the kit. Lettering: Selawik (SIL Open Font License, `assets/fonts/OFL-selawik.txt`).

The Ventures squad mates (`assets/ventures/gm`, a file for each job and race look, and `src/ventures/gen_art.ts`) are cut by `art/gen_mates.py` from sprite sheets made with an AI image tool. `art/gen/PROMPT.md` has the prompt, what a sheet must look like and how to add or replace one; the raw sheets are about 3 MB each and stay out of the repository.

## License
GPL-3.0, like the rest of XI: Forever Offline. XI: Forever Offline is an unofficial fan project, not affiliated with or endorsed by Square Enix. FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd. FINAL FANTASY XI © SQUARE ENIX CO., LTD.
