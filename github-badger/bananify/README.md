# Bananify

Bananify brings three playful monkeys, a Banana Catch mini-game, banana parties, and public GitHub stats to your badge.

## Usage

Open **Bananify** from the badge menu to meet Sebastian, Mooch, and Henry.
Feed your friend, watch them hop and celebrate, and give them three snacks
for a short nap. Feeding a sleeping monkey wakes them up.

| Control | Playground | GitHub stats |
| --- | --- | --- |
| Left / Right | Move your monkey | - |
| Select | Feed / wake your monkey | Refresh public GitHub counts |
| Up | Switch monkey | - |
| Down | Cycle party mode | - |
| Back | Pause / resume animation | Return to hub |
| Menu | Open the hub | Return to hub |
| Home | Return to launcher | Return to launcher |

Menu opens a hub where Up/Down picks **Banana Catch**, **Playground**, or
**GitHub Stats**, Select opens it, and Back returns to the playground.

## Banana Catch

A 60-second score chase built for holding the badge upside down like a
gamepad (it works upright too). On the intro screen, Up switches monkey,
Down switches party theme, Select starts a 3-2-1 countdown, and Back returns
to the hub.

| Control | During a round |
| --- | --- |
| Left / Right | Run |
| Select | Jump (one per press; no double jump) |
| Back | Dash: a short burst in the held or facing direction, 1.2 s cooldown shown in the HUD |
| Menu | Pause (Resume or Quit round) |
| Home | Return to launcher; the unfinished round is discarded |

- Falling bananas are caught automatically when they reach your monkey's
  head and hands: **10 points**. A banana that hits the ground is a miss.
- Sparkly **bonus bunches** flash a "JUMP!" warning, then float across the
  canopy above your head. Only a jump reaches them: **30 points, 3 bananas**.
  A bunch that floats away does not break your combo.
- Every five catches in a row raises the multiplier, up to **x5**. A miss
  resets the multiplier but never subtracts points; there are no lives.
- Bananas fall faster and more often after 20 and 40 seconds.
- Turning the badge over mid-round pauses the game so the remapped buttons
  cannot trigger an accidental jump or dash.
- All three monkeys and all party themes play identically; themes only change
  the look, and Zen keeps the scenery still.

Results show score, bananas caught, misses, best combo, and your personal
best. Select plays again; Back returns to the hub. Best score, best combo,
rounds played, and lifetime game bananas are saved once per finished round
(separately from playground snacks); a failed save is shown on screen.

## Party modes

- **Grove:** warm banana-cream colors, a gentle banana shower, happy dancing.
- **Disco:** midnight colors, smooth moving lights, faster dancing and confetti;
  no strobe effects.
- **Banana Rain:** a bigger banana shower, with bounded particles.
- **Zen:** still scenery and a still monkey, with no shower or hopping.
  Feeding still shows a brief confetti celebration; Back freezes all animation.

The chosen monkey, party mode, total snacks, Banana Catch records, and last
refreshed public profile are saved with Badgeware `State`. Animation is time-based; HOME stays
launcher-owned and the logical controls follow badge orientation.

## GitHub stats and network requirements

The default account is **jamesmontemagno**. The initial bundled snapshot was
retrieved from GitHub's public user API on **2026-10-28 (UTC)**. The stats
screen explicitly labels this snapshot, a saved copy, or a successful refresh
from the current session. It shows public repositories, followers, following,
and public gists, **not** contributions, private repositories, or stars.

The playground, Banana Catch, and bundled stats work entirely offline. Select on the stats
screen uses firmware `fetch` and `wifi` to refresh asynchronously, with a
20-second UI timeout and at most one attempt per minute. Configure Wi-Fi in
the badge's Settings app; no GitHub token is required or read. The unauthenticated
GitHub API has a shared-IP rate limit. Connection failures, invalid responses,
timeouts, and failed saves are reported without replacing the last good counts.
The browser simulator's HTTP support depends on its runtime and browser CORS.

To target a different account, change `USERNAME` in `profile.py` and replace
`profile_seed.json` with that account's public API response plus an accurate
`snapshot_date`. Old saved data for a different login is ignored.

## Artwork

Part of [Bananify](https://github.com/jamesmontemagno/bananify): "A little
more banana, a little less ordinary." Sebastian (brown capuchin), Mooch
(black-and-white capuchin), and Henry (golden monkey) use the original Bananify
artwork by James Montemagno under the MIT license, reproduced in
`assets/LICENSE.txt`. Original SVGs are included beside the raster sprite
sheets. The menu icon is a 24x24 banana.

## Verification

Host tests (from the `github-badger` folder; Python 3.10+, no badge required):

```sh
python -m unittest discover -s tests -p test_bananify.py
```

In the 2026 simulator, exercise all three friends, all four party modes, movement,
feeding, the third-snack nap, waking, pause/resume, stats, and refresh failures.
For Banana Catch, check the hub, intro, countdown, ground catches, a jump-only
bonus bunch, dash cooldown, pause/quit, a full round's results, and rotating
the badge mid-round.
Before calling this hardware-verified, install through USB Disk Mode and check
the menu icon visually, HOME/re-open persistence, both orientations, all controls,
Wi-Fi refresh, offline behavior, and smooth animation on the physical badge.
