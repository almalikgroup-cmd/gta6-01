# gta6-01

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/almalikgroup-cmd/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/almalikgroup-cmd/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLMAR HEAT** — an original top-down 2D open-world crime game set in Solmar, a sun-soaked coastal city of pastel buildings, palm-lined avenues, and a beach that runs along the south edge of a 3200×2400 world. Explore on foot or steal any parked or moving car and drive it — traffic follows lanes, brakes for obstacles, and turns at intersections, while pedestrians stroll the sidewalks and flee from gunfire, reckless driving, and flying fists. Commit crimes where witnesses can see and the heat rises through a 0–5 star wanted system: Solmar PD interceptors spawn to match your level, chase, ram, and corner you to fill the bust meter, but break line of sight and the heat decays. Fight on foot with punches and an aim-with-the-mouse pistol fed by ammo pickups scattered around the city, manage your health, and take on a three-mission story chain from the hideout beacon — "First Run" (a timed package delivery across town), "Hot Wheels" (steal the marked convertible and deliver it to the garage while the heat rises), and "Harbor Heat" (collect your crew member at the beach and escape to the hideout under a locked three-star wanted level) — for cash rewards, with free roam in between. The HUD carries a live minimap (roads, water, traffic, flashing police blips, and the mission marker, plus an off-screen edge arrow), wanted stars, cash, health, objective text, a speedometer and car-condition bar while driving, and ammo while armed. Progress (cash, missions completed, position, ammo) auto-saves to localStorage, the title screen offers Continue when a save exists, and every sound — engine hum, two-tone sirens, gunshots, chimes, UI clicks — is synthesised live with WebAudio; there are no libraries, no assets, and no network requests. Controls: WASD/arrows to move, Shift to sprint, E to enter/exit cars, mouse to aim, right mouse or K to fire the pistol, left mouse or J to punch, Space for the handbrake, H to honk, Enter/Esc/P to pause, and M to mute.

## Run it

Package the entry (copies `game/` and `screenshots/` and writes `dossier.json`):

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Then serve the `game/` folder statically with any static file server and open `index.html` in a desktop browser — for example `npx serve game` or `python3 -m http.server -d game`. The game runs fully offline from those static files. Deterministic screenshot scenes are available at `game/index.html?shot=cover|drive|chase|mission&seed=7`.

<sub>Entered on [make.fun](https://make.fun/?ref=fp1aw4h5&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
