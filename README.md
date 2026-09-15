# Source for my Website!

Source for pixelis.dev, my personal site with projects, games, and tools.

Built with vanilla HTML, CSS, and JS. It's a static site, nothing special, but it means a lot to me <3

## Currently card

The homepage reads the public Discord presence for the ID in `#currentlyCard` through [Lanyard](https://github.com/Phineas/lanyard). Join [Lanyard's Discord server](https://discord.gg/lanyard) with that account to enable the feed. Joining makes the presence shared with Lanyard publicly readable through its API. Spotify and games must also be shared in Discord for them to appear.

The card refreshes every 30 seconds while the page is visible. It shows Discord presence and custom status, plus listening and playing activity together when both are available. Album art and game artwork come from Spotify/Discord, with icon fallbacks for missing or broken images. When Discord supplies song start/end timestamps, a read-only progress bar updates every second. The decorative listening bars indicate activity; they are not an audio spectrum and do not play or control the owner's music.

The card clears activity when offline and displays an unavailable state if the account is not monitored or the service cannot be reached. No Discord token is used or stored. The floating music player continues to control the visitor's soundtrack separately.
