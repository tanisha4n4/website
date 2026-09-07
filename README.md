# FOUR n FOUR

Static studio website. No npm or Vite — open `index.html` through any static server.

## View it locally

From this folder, serve the files (ES modules and shader `fetch` need a local server, not a raw `file://` path):

```bash
npx --yes serve .
```

Or use VS Code / Cursor Live Server, Python `python -m http.server`, or any other static host. Then open the URL it prints (often `http://localhost:3000` or `http://localhost:8000`).

## GitHub Pages

This repo is the site root. Point Pages at the `main` branch `/` (or your custom domain). All asset URLs are relative.

## Restore a bundler later

There is no `package.json`. The site is plain HTML, CSS, and JS in `src/`.
