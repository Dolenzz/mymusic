# Tom’s Music Library

A local first version of Tom’s music collection, using all 1,041 permanent IDs and the current master catalog. Warm charcoal, ivory, and copper; responsive desktop, tablet, and phone layouts. No accounts, API keys, database, or dependency installation required.

## Open locally

Double-click **Launch Music Library.cmd**, or run `npm start` and open http://127.0.0.1:4180. Keep the local server running while browsing. The server listens only on this PC. Publication has not been configured.

## Included

- Home with a fresh, varied selection on every visit or refresh, a shuffle button, and three fixed banner albums chosen by Tom.
- Collection grid in three sizes, sortable table, combined genre/style/format/decade filters, song/album/artist search, random selection, and incremental loading.
- Artist index, natural display names with catalog surname sorting, and artist pages that combine matching albums across formats. Group by format restores each edition to its section.
- Dedicated album links, full track sequences with disc/side headings where present, original credits, charts, anecdotes, edition details, and verified-format Spotify album links only.
- Decade browsing and an About page. Personal decade introductions can be added later, after Tom approves the wording.
- View preferences remembered locally; collection position and loaded results restored when returning from an album within the session.
- Keyboard navigation, skip link, visible focus, mobile menu, reduced-motion support, and missing-cover fallbacks.

## Data and images

The public catalog lives in `site/catalog.json`. Preparation explicitly selects public fields and excludes internal research notes and source-file paths. It never changes the master catalog. The UI preserves the provided content; it does not research or repair factual metadata.

`scripts/prepare.py` reads the master JSON and original covers and generates WebP copies at up to 720px and 360px. Smaller originals are never enlarged or cropped. Transparent covers are flattened onto the site background. Original files stay untouched; conversion checks their hashes. Generated files have deterministic permanent-ID names. Covers are ignored by Git pending the hosting decision.

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
- Choose website and cover hosting; configure deployment separately.
- Continue to leave uncertain track-level songwriter mappings in the full-credit panel.
