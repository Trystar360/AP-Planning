# AP Activity Scheduler

A central place for the team to track which AP activities are scheduled when,
and who is running them. Each week is shown on its own clear grid (Mon–Sun,
hourly slots) with colour-coded activities.

**Activities:** Zip Line, Mini Zip Line, Climbing Wall, Climbing Tower,
Laser Tag, Power Swing, Sky Trail.

## Hosted version (GitHub Pages)

The app is deployed automatically via GitHub Actions
(`.github/workflows/deploy.yml`) to GitHub Pages on every push to the working
branch. Once Pages is enabled (Settings → Pages → Source: **GitHub Actions**),
it's available at:

> https://trystar360.github.io/AP-Planning/

> **Note — for testing:** the hosted build stores data in each browser's
> `localStorage`, so it's perfect for trying out the layout, but data is **not
> shared** between people/devices yet. To make the schedule truly shared across
> the team, swap `src/api.js` back to a real backend (the matching API lives in
> `server.js`) hosted somewhere that can run Node, or use a hosted database.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

The local dev build uses the same browser `localStorage`, so no backend is
needed to try it.

### Optional: run with the shared SQLite backend

```bash
npm install
npm run build
node server.js   # serves the API + built UI on http://localhost:3001
```

To use the backend instead of `localStorage`, point `src/api.js` at the
`/api` endpoints in `server.js`.
