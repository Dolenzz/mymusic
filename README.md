# Tom’s Music Library

A local first version of Tom’s music collection, using all 1,041 permanent IDs and the current master catalog. Warm charcoal, ivory, and copper; responsive desktop, tablet, and phone layouts. No accounts, API keys, database, or dependency installation required.

## Open locally

Double-click **Launch Music Library.cmd**, or run `npm start` and open http://127.0.0.1:4180. Keep the local server running while browsing. The server listens only on this PC. Publication is configured through the GitHub Pages workflow; the local preview is independent of deployment.

## Included

- Home with a fresh random selection on every visit or refresh, without genre/decade quotas or repeated artists, a shuffle button, and three fixed banner albums chosen by Tom.
- Collection grid in three sizes, sortable table, combined genre/style/format/decade filters, song/album/artist search, random selection, and incremental loading.
- Artist index, natural display names with catalog surname sorting, and artist pages that combine matching albums across formats. Group by format restores each edition to its section.
- Dedicated album links, full track sequences with disc/side headings where present, original credits, charts, anecdotes, edition details, and verified-format Spotify album links only.
- Decade browsing and an About page. Personal decade introductions can be added later, after Tom approves the wording.
- View preferences remembered locally; collection position and loaded results restored when returning from an album within the session.
- Keyboard navigation, skip link, visible focus, mobile menu, reduced-motion support, and missing-cover fallbacks.

## Data and images

The public catalog lives in `site/catalog.json`. Preparation explicitly selects public fields and excludes internal research notes and source-file paths. It never changes the master catalog. The UI preserves the provided content; it does not research or repair factual metadata.

`scripts/prepare.py` reads the master JSON and original covers and generates WebP copies at up to 720px and 360px. Smaller originals are never enlarged or cropped. Transparent covers are flattened onto the site background. Original files stay untouched; conversion checks their hashes. Generated files have deterministic permanent-ID names. Optimized covers are included in Git so GitHub Pages can serve the complete site. The R2 bucket is an independent backup.

Run preparation with a Python installation containing Pillow:

```
python scripts/prepare.py --master "path/to/music_collection_master.json" --covers "path/to/covers"
```

When image hosting is chosen, set `coverBaseUrl` in `site/config.js` to the HTTPS base containing `covers/`. No catalog path migration is required. For static hosting, publish the contents of `site/`; hash navigation allows direct album links without server rewrites.

Album grouping is conservative: same normalized artist and title, release years within one year. Different edition titles remain separate, and various-artist compilations are never automatically combined. Each original ID remains accessible.

Writer surnames appear next to tracks when an explicitly titled credit can be matched exactly after punctuation and accent normalization. Ambiguous inversions, narrative credits, and conflicting attributions are left in the expandable full-credit section. The source catalog is unchanged. Personal decade introductions and five public Spotify playlist links live in `site/stories.mjs`.

## Verification

Run `npm run check`. The full-catalog checks verify stable IDs, public-field fidelity, all artwork files, search, filters, sorts, grouping, multi-disc track sequences, Spotify link validation, and home selections. Reports are generated under `reports/` and kept out of Git. Browser testing covers representative desktop and mobile states.

## Remaining before launch

- Tom’s visual review and adjustments.
- Any further editorial changes Tom requests to the personal decade introductions.
- Verify ambiguous album groups before final publication.
- Publish the site and optimized covers together on GitHub Pages; verify the live deployment.
- Continue to leave uncertain track-level songwriter mappings in the full-credit panel.

## Album sharing and rollback

Album pages have a Share dialog with a locally generated PNG card, editable post text, clipboard actions, and the device sharing sheet where supported. Cards contain artwork, artist/title/year/format/genres, the existing anecdote, and tracks without songwriter credits. Long track lists use panels of at most 24 tracks; all tracks and disc/side labels are retained. Save each panel separately. Receiving apps may omit text or images, so Save image and Copy post text remain available. No social account, API key, screenshot service, or AI is used.

`node scripts/build-share-pages.mjs` regenerates the 1,041 static album share URLs after catalog updates. These pages expose album-specific Open Graph cover metadata and direct visitors to the existing album route. Social apps control preview rendering; the downloadable detailed card is separate from the automatic cover preview.

To hide the new sharing UI immediately, set `enableAlbumSharing: false` in `site/config.js` and deploy; this restores the original Copy album link action. The exact pre-feature version is tagged `before-album-sharing-2026-10-23`. Revert the album-sharing commit to undo the whole feature without deleting other work.

## Favorites, accessibility, and maintenance

Hearts save albums to `toms-library-favorites` in browser localStorage. No account or server is involved. Matching formats share a favorite state using the existing conservative edition grouping; original IDs remain intact. Favorites only combines with the existing filters and URL, and updates across tabs. Storage failures are announced rather than claiming success. Clearing site data removes favorites. Grid/table, cover size, general sorting, artist sorting, and format grouping are remembered; searches and genre filters remain explicit in URLs instead of unexpectedly limiting a new visit.

The public Collection No. is hidden. Keyboard focus is preserved when saving/removing albums and advancing Show more. Touch controls have larger hit areas, reduced-motion settings suppress decorative movement, and the search shortcut does not interfere with sharing dialogs. This is a focused accessibility review, not a formal WCAG certification or screen-reader audit.

`npm run check` now checks every local cover and share-page link automatically. `node scripts/check-links.mjs --external` optionally checks Spotify URLs and writes `reports/link-check.json`. The GitHub Actions **Check collection links** workflow runs on demand, with an optional external check and downloadable report. A blocked request, timeout, login redirect, or rate limit is inconclusive, not a missing album; HTTP 404/410 results require review and never edit catalog data. No recurring job has been enabled.
