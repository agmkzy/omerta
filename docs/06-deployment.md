# Deployment

The game is one static HTML file with no server component, no runtime dependencies and no network calls. Deploying it means putting `dist/omerta.html` somewhere a browser can load it.

## Current deployment

| Target | URL | How it is updated today |
| --- | --- | --- |
| GitHub Pages | https://agmkzy.github.io/omerta/ | Pages is configured as a **legacy (branch) build** from `main`, path `/`. It serves the committed `index.html`, which is a manual copy of `dist/omerta.html` (`make pages`, then commit and push) |
| claude.ai artifact | https://claude.ai/artifact/YDyiAu7Aw8bZdwMjaBRVV3 | `dist/omerta.html` is published manually as an artifact |

The Pages configuration was read from the GitHub API (`build_type: legacy`, `source: main /`, HTTPS enforced). The repository is public.

## Are the dist files committed?

**Yes.** Two copies of the build output are tracked: `dist/omerta.html` and `index.html`. They are byte-identical, about 1.08 MB each. The intermediate `dist/web.js` is git-ignored.

**Why (as the history suggests):**

1. **GitHub Pages legacy mode serves files straight from the branch.** It cannot run `npm run build`, so a built `index.html` has to exist at the repository root.
2. **`dist/omerta.html` is the deliverable.** CLAUDE.md defines deploy as "publish `dist/omerta.html`". Committing it means anyone, or any Claude session, can grab the playable file without a Node toolchain, and the artifact can be republished from the repo alone.

**The costs:**

- Every release adds roughly 2 MB of minified, undiffable text to git history.
- Merge conflicts in minified one-line files can't be resolved by hand. Branches always conflict on them.
- **Nothing checks that the committed build matches the source.** A change to `src/` committed without rebuilding leaves `index.html` stale and silently deploys old code. `index.html` and `dist/omerta.html` can also drift from each other.
- Reviewers see huge diffs on every pull request.

**Recommendation:** build on deploy and stop committing build outputs. Switch Pages to the GitHub Actions source (below), then remove `index.html` and `dist/omerta.html` from git and add `dist/` to `.gitignore`. Until then, CI should at least fail when `npm run build` changes the committed files. The build is deterministic, so a `git diff --exit-code` after building is a reliable check.

## Things to know before moving hosts

- **Saves are tied to the origin.** `localStorage` is scoped to scheme + host + port. Moving from `agmkzy.github.io` to any other domain (a custom domain, DigitalOcean, Netlify) gives every player an empty save slot. Before switching, tell players to use **Download a backup file** on the old site and **Load a backup file** on the new one. Alternatively, keep the old site up with a banner that does exactly that.
- **All `agmkzy.github.io/*` sites share one origin.** Any other project the same account publishes on GitHub Pages shares `localStorage` (and its roughly 5 MB quota) with OMERTÀ. Key collisions are unlikely because the keys are prefixed `omerta-`, but quota pressure from another project would surface as save failures here. A custom domain or a dedicated host avoids this.
- **Caching.** Everything is inline, so there is exactly one file to cache. Serve it with a short cache lifetime (GitHub Pages uses 10 minutes) so players pick up new versions. Avoid long-lived immutable caching on the HTML.
- **The artifact has its own origin and storage.** Saves made in the claude.ai artifact are not visible on GitHub Pages, and the reverse is also true.

## Recommended setup: GitHub Pages, built by Actions

This option is free for public repositories, needs no new accounts, builds on every push to `main`, and keeps the existing URL, so player saves are unaffected.

1. Add the workflow `.github/workflows/pages.yml`:

   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
     workflow_dispatch:
   permissions:
     contents: read
     pages: write
     id-token: write
   concurrency:
     group: pages
     cancel-in-progress: true
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version-file: .nvmrc
             cache: npm
         - run: make ci            # typecheck, build, full tests; a red suite blocks the deploy
         - run: mkdir -p site && cp dist/omerta.html site/index.html
         - uses: actions/upload-pages-artifact@v3
           with:
             path: site
     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - id: deployment
           uses: actions/deploy-pages@v4
   ```

2. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. This replaces the legacy branch build.
3. Push to `main`. The URL stays `https://agmkzy.github.io/omerta/`.
4. Once a deploy has succeeded, delete `index.html` and `dist/omerta.html` from git and add `dist/` to `.gitignore`. Download artifacts from the workflow run if a copy is needed, or attach the built file to a GitHub Release for each version.

The full test suite takes several minutes, which is fine on the free tier for a public repository. If deploys need to be faster, run `make all` in the Pages workflow and leave the full suite to the separate CI workflow ([05-testing.md](05-testing.md#is-there-a-github-actions-test-runner)).

## Alternative: DigitalOcean App Platform (static site)

App Platform builds from the GitHub repository on every push and serves the output from its CDN. At the time of writing, static sites are on App Platform's free tier, with a small allowance of outbound transfer. Check current pricing before relying on it. This option is a good choice if the project will later grow a backend (cloud saves) on DigitalOcean, because a Functions or App service can be added to the same app.

1. Add `.do/app.yaml`:

   ```yaml
   name: omerta
   static_sites:
     - name: web
       github:
         repo: agmkzy/omerta
         branch: main
         deploy_on_push: true
       environment_slug: node-js
       build_command: npm ci && npm run typecheck && npm run build
       output_dir: dist
       index_document: omerta.html
       error_document: omerta.html
   ```

2. Create the app: **DigitalOcean control panel → Apps → Create App → GitHub**, authorise access to `agmkzy/omerta`, and choose "Use app spec" with the file above. Alternatively, run `doctl apps create --spec .do/app.yaml`.
3. Optionally add a custom domain under the app's **Settings → Domains**. App Platform provisions the TLS certificate.
4. Remember the origin change: the new URL has empty `localStorage`, so publish the backup/restore instructions first.

DigitalOcean doesn't run the test suite in this setup. Keep CI in GitHub Actions, and protect `main` so only green commits reach it.

## Other PaaS options

All of these work the same way: a build command of `npm ci && npm run build`, publishing `dist/`, with `omerta.html` as the index. Where a host insists on `index.html`, add a post-build copy (`cp dist/omerta.html dist/index.html`).

| Host | Notes |
| --- | --- |
| Cloudflare Pages | Free, fast global CDN, preview deployment per branch. Workers and R2 sit alongside for future cloud saves |
| Netlify | Free tier, preview deployments, simple redirects |
| Vercel | Works, but it is aimed at framework apps. It has no advantage here |
| A droplet with nginx | Not recommended: a server to patch for one static file |

## Build on deploy?

**Yes.** The build is fast (under a second), deterministic and has no secrets. Building on deploy removes the stale-`index.html` risk and the 2 MB-per-release history growth. The only reason to commit a built file is the claude.ai artifact workflow. For that, attach the built file to a GitHub Release or download it from the Actions run, rather than keeping it in the tree.

## Release checklist

Until CI is in place:

1. Run `make test-all`. Also run `make test-compat` if `types.ts` or `deserialize` changed.
2. If the save shape changed, check that a save from the previous build was added to `src/tests/fixtures/` (see [02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md#6-backwards-compatibility-will-a-new-version-wipe-progress)).
3. Run `make pages`, which builds and copies to `index.html`. Commit `dist/omerta.html` and `index.html` together with the source change.
4. Push `main`, then wait for the Pages build. Load the site, choose **Continue saved game** with an existing save, and confirm it loads.
5. Republish the claude.ai artifact from `dist/omerta.html` if it is still in use.
