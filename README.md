# Source for my Website!

Source for pixelis.dev, my personal site with projects, games, and tools.

Built with vanilla HTML, CSS, and JS. It's a static site, nothing special, but it means a lot to me <3

## 2026 redesign (scrapbook)

The homepage, postcard wall, arcade and 404 page use the light "scrapbook" design.

| File | What it does |
| --- | --- |
| `site.css` | The whole design system: graph-paper background, polaroids, postcards, buttons, forms. |
| `index.html` + `home.js` | Homepage: hero, live presence, postmark picker, latest 9 short postcards (120 characters or less; long ones stay on the full wall). To keep a specific postcard off the homepage, add its id to `HOME_HIDDEN` in `home.js`., hall of fame, contents, contact. |
| `presence.js` | Live Discord / Spotify / game presence from Lanyard (see below). |
| `postcards.js` | Shared postcard renderer and the list of postmark badges. |
| `notes.html` + `notes.js` | The postcard wall and the "write one" form (badge, stamp colour, doodle, Turnstile). |
| `games/index.html` | The arcade. |
| `404.html` | "Lost in the mail" page. |

The game pages (`games/*/`) keep their original game code. They load the old `styles.css` (which their markup still relies on), then `site.css` and `games/games.css`, which put the new header and footer around each game and show the game itself on a dark "arcade screen" panel.

### Legacy site

The whole previous site lives in `legacy/` and is reachable from the **legacy site** badge in the header (and from the table of contents). Everything still works there: Pixie, the music player, achievements, easter eggs, the old games and the old notes wall. It uses the same notes API and the same browser storage as the new site, so postcards sent from either page land in the same moderation queue and drafts carry over between them. Every legacy page has a "back to the new one" link and `noindex` so search engines prefer the new pages.

Files that only the old site uses (music, `cat.js`, `easter-eggs.js`, `music-player.js`, `script.js`, `currently.js`, hall of fame screenshots) now live only under `legacy/`.

### Hall of fame photos

Drop each friend's picture in `assets/friends/` with these names (square works best, at least 400×400):

`ali-asghar.png`, `hashir-pookie.png`, `awais-zahid.png`, `evrin.png`, `waqar-haider.png`, `kohprosh.png`, `hoku-yume.png`, `ali-usman.png`, `snowy.png`, `aryan.png`

Until a file exists, the polaroid shows a coloured initial instead.

## Right now (presence)

The homepage reads the public Discord presence for the ID in `#presence` through [Lanyard](https://github.com/Phineas/lanyard). Join [Lanyard's Discord server](https://discord.gg/lanyard) with that account to enable the feed. Joining makes the presence shared with Lanyard publicly readable through its API. Spotify and games must also be shared in Discord for them to appear.

It refreshes every 30 seconds while the page is visible and shows: Discord status and custom status, the Spotify song with album art and a live progress bar, and the current game with its icon (Discord activity art, then the game's Discord app icon, then local art in `assets/games/`, then a controller icon). The avatar in the polaroid switches to the live Discord avatar when it loads; `assets/pfp.png` is the fallback.

Pixel's local time is shown as "it's 7:08 PM for Pixel, and evening where you are" without naming a place. The time zone comes from `data-timezone` on `#presence`. No Discord token is used or stored.

## Postmark badges

Visitors pick a postmark (cat, ghost, star, heart, controller, music note) when they write a postcard. The choice on the homepage is remembered and preselected on the wall. The badge appears in the postmark circle and next to the sender's name. Older postcards without a badge show a dated postmark.

The badge list lives in two places that must match: `BADGES` in `postcards.js` and `BADGES` in `backend/src/validation.mjs`.

**Deploy order for the badge change:** apply the new migration before deploying the Worker, or new submissions will fail to save.

```sh
cd backend
npx wrangler d1 migrations apply pixelis-notes --remote   # adds notes.badge (0004_postmark_badge.sql)
npm run deploy
```

The frontend can go live before or after; older Workers simply ignore the badge.

## Tests

```sh
node --test tests/*.test.cjs        # site scripts
cd backend && npm test              # notes Worker
```
