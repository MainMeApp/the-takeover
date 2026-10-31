# The Takeover

A single-file workout, cardio and nutrition tracker built around a 6-week
training program — preset split, smart weight recommendations, rest timers,
streaks, a meal log with calorie/protein targets, and weekly check-ins.

## Run it

It is a static site with no build step and no backend. Serve this folder with
any static host (GitHub Pages, Vercel, Netlify) or open `index.html` from a
local web server.

## Install it (PWA)

Open the hosted page on a phone and choose "Add to Home Screen" — the app
installs with its own icon, runs full-screen, and works offline
(`manifest.webmanifest` + `sw.js`). All training data stays on the device in
`localStorage`.

## Your data & backups

- Data lives in one `localStorage` key (`takeover_v6`) on the device.
- Every change also writes a dated snapshot; the app keeps the last 7 days of
  snapshots and restores from the newest one automatically if the main entry
  is ever lost or corrupted.
- The Sync tab exports a full backup (clipboard copy or a downloadable
  `.json` file), imports a backup back, and shows when the last export
  happened. The app nags if data exists but no backup has been exported in
  14 days — exports are the only copy that survives a phone change.

## Photo meal logging

The Nutrition tab can log a meal from a photo: the app sends the picture to
`api/analyze-meal.js`, a serverless function that asks a vision model
(Gemini Flash by default) for the items, calories, protein, carbs and fat.
The user reviews and can edit every number before anything is added to the
log — estimates are a starting point, not gospel.

The API key lives only on the server, as the Vercel environment variable
`GEMINI_API_KEY` (get a free key from Google AI Studio). Set `GEMINI_MODEL`
to override the model. Because the function needs a host that runs
serverless functions, photo logging works on the Vercel deployment; on a
plain static host (e.g. GitHub Pages) the rest of the app works fine and
the photo button explains itself.

Cost: roughly half a cent per photo at current Gemini Flash prices.

## Deploy

Import this repo into Vercel (it serves `index.html` statically and
`api/analyze-meal.js` as a function automatically), then add the
`GEMINI_API_KEY` environment variable in the Vercel project settings and
redeploy.

## Files

- `index.html` — the entire app (markup, styles, logic)
- `api/analyze-meal.js` — the photo-analysis backend (holds the API key)
- `manifest.webmanifest`, `sw.js`, `icons/icon.svg` — PWA shell
