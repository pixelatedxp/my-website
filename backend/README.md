# Notes backend

The existing GitHub Pages site serves `notes.html`. A Cloudflare Worker stores submissions in D1, validates Turnstile, and sends a Discord moderation embed. Discord buttons call the Worker's signed interactions endpoint; no continuously running Discord gateway process is needed.

## Current deployment

- API: `https://pixelis-notes.pixelis-notes-backend.workers.dev`
- Discord interactions endpoint: `https://pixelis-notes.pixelis-notes-backend.workers.dev/discord/interactions`
- D1: `pixelis-notes` (binding `DB`)
- Public frontend settings: `../notes-config.js`
- Worker settings and Discord IDs: `wrangler.jsonc`

Cloudflare Workers, D1, and Turnstile have free allocations. This setup uses those services without requiring a paid always-on server. Free quotas and availability still apply; monitor usage in Cloudflare. Public requests are not globally capped by this application, so public traffic can exhaust the platform's free daily allocation.

## Finish account setup

1. In Cloudflare, open **Workers & Pages → pixelis-notes → Settings → Variables and Secrets**. Add `DISCORD_BOT_TOKEN` and `TURNSTILE_SECRET_KEY` as **Secret** values and deploy. Never add them to frontend JavaScript or commit them. Optionally set `RATE_LIMIT_SALT` to a long random secret; otherwise the bot token is used for the private rate-limit hash.
2. In Turnstile, the widget must allow `pixelis.dev` and `www.pixelis.dev`. Its public site key belongs in `notes-config.js`. The backend independently checks the hostname and the `leave-note` action.
3. Invite the Discord application to the review server with View Channel, Send Messages, Embed Links, and Attach Files. It does not need Administrator or Message Content Intent. Check any channel-specific overrides.
4. In Discord Developer Portal → application → General Information, save the interactions endpoint above. Discord will verify it with a signed ping. The application public key in `wrangler.jsonc` must match that application's General Information page.
5. After the frontend is published, submit a short test note from the real site, check the Discord embed and image, click Approve using the configured moderator account, and refresh the wall. Use Unpublish to remove the test note afterward. Also test Reject: it must never appear publicly.

## Develop and deploy

From this directory, with Node.js 22.13 or newer:

```sh
npm ci
npm test
npm run check
npx wrangler login --device --browser=false --scopes account:read user:read workers:write workers_scripts:write d1:write
npx wrangler d1 migrations apply pixelis-notes --remote
npm run deploy
```

`npm run check` bundles into the ignored `dist/` folder without deploying. The test suite uses an in-memory SQLite D1 adapter and mocked Discord/Turnstile requests; it does not send real messages or spend production quotas. Existing site tests run separately from the repository root with `node --test tests/*.test.cjs`.

For local Worker development, use ignored `.dev.vars` for local secrets and explicit local hostname/origin overrides. Do not enable Turnstile test credentials or origin bypasses in production. Cloudflare's dashboard can deploy secret changes without storing credentials on disk.

Frontend deployment follows this repository's existing GitHub Pages process. Deploying this Worker does not publish the HTML/CSS/JS changes to GitHub Pages.

## Behavior and safeguards

- Server-enforced 250-character limit, 32-character name limit, and required rules agreement. Emoji sequences count as one visible character, with additional byte/size limits.
- Only text plus explicit bold/italic/underline flags are accepted. The page renders text nodes, never submitted HTML. Discord mentions are disabled.
- Anonymous names are replaced with `Anonymous` before sending and also on the server. The local browser may retain a previous name in its saved draft until submission succeeds.
- Doodles must be bounded 480×240 PNGs. The same validated bytes are shown in Discord and on the public wall. No image upload interface or SVG support.
- Only approved notes and their doodles have public endpoints. Pending and rejected notes stay in the database for the owner; there is no automatic deletion policy.
- Only the configured moderator, guild, channel, application, and stored Discord message can change a note. Discord requests require a valid Ed25519 signature and recent timestamp. Approved notes can be unpublished.
- The server records submission time. Visitors see it in their local timezone.
- The form stores a local draft and a random submission ID. Retries of the same request do not create duplicate notes. A successful save immediately shows the waiting-for-approval page; delivery to Discord can retry in the background.
- Per-IP rate limits: 5 attempts/hour and 20/day. Globally, up to 250 verified submissions/day. IP addresses are hashed with a daily salt context; raw IPs are not stored in D1. Turnstile receives the IP for verification.
- Discord delivery and embed updates retry on a five-minute scheduled trigger. Delivery uses a database lease and Discord's recent-message nonce deduplication. Repeated failures back off. Inspect Worker logs for delivery errors if a saved note does not arrive.
- Public wall responses and drawings use `no-store`; unpublishing stops future API access. This cannot erase copies already downloaded by visitors.

## Troubleshooting

- **Submissions not open:** verify the two Worker secrets are set.
- **Discord 403:** the bot has not joined the review server or is missing a channel permission.
- **Buttons do nothing:** verify the Discord interactions endpoint is saved and the moderator user ID is correct.
- **Spam check rejected:** verify widget hostnames, public site key, secret key, and configured action. Tokens expire and can only be used once; the UI resets the widget after an error.
- **Local preview cannot fetch the production API:** expected; production CORS permits only the configured real-site origins.
- **Saved note missing in Discord:** check Worker logs and the scheduled retry. Do not tell the visitor to submit a fresh copy.

For a database backup, use Cloudflare's D1 export tools and keep the export private: it includes pending and rejected notes.
