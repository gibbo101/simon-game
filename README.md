# Simon

A small Simon memory game built with vanilla JavaScript and tested with Jest.

Live: <https://gibbo101.github.io/simon-game>

## How it works

Enter your initials (three letters, arcade style), hit **New game**, and repeat
the sequence back. Each round adds one more step, and playback speeds up as your
score climbs.

- **Global leaderboard** — one shared board for everyone, served by the
  CritticWars arcade API (`/api/arcade/simon/scores`). Each set of initials
  holds its best score ever, ranked high to low. Play as many times as you
  like; only your best is kept, and nobody is ever blocked. Blank or too-short
  initials play as `AAA`.
- Your initials are remembered in the browser between visits.
- Every game is a fresh random sequence, so there's nothing to memorise and
  replay for a fake high score.

> The score is still counted in the browser, so the board is honour-system: the
> API validates and rate-limits, but can't prove a run happened. Fine for
> bragging rights, not an authoritative record.

## Hosting the game elsewhere

The page can be pointed at a different board (for example an authenticated,
per-player board inside CritticWars) by defining `SIMON_CONFIG` before
`scripts/game.js` loads:

```html
<script>
    window.SIMON_CONFIG = {
        scoresUrl: "/api/arcade/simon/players",
        fetchOptions: { credentials: "same-origin", headers: { "X-CSRF-TOKEN": token } },
    };
</script>
<script src="scripts/game.js"></script>
```

## Features

- Shared global high-score board with three-letter initials (CritticWars arcade API)
- Audio tones per button (Web Audio API — no asset files)
- Difficulty ramp: playback speeds up as your score climbs
- Keyboard accessible: Tab to a button, Enter/Space to press it

## Running locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Tests

```bash
npm install
npm test
```
