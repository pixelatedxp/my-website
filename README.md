# Source for my Website!

Source for pixelis.dev, my personal site with projects, games, and tools.

Built with vanilla HTML, CSS, and JS. It's a static site, nothing special, but it means a lot to me <3

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
