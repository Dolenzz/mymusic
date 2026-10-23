import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {albumShareUrl} from '../site/share.mjs';
const root=new URL('../site/',import.meta.url);
const {albums}=JSON.parse(await readFile(new URL('catalog.json',root),'utf8'));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await mkdir(new URL('share/',root),{recursive:true});
for(const a of albums){
  const title=`${a.artist} — ${a.album_title}`;
  const destination=`https://dolenzz.github.io/mymusic/#/album/${encodeURIComponent(a.id)}`;
  const description=`Explore ${title} in Tom’s Music Library: album details, tracks, and a Spotify link where available.`;
  const image=`https://dolenzz.github.io/mymusic/${a.cover.full}`;
  // Real HTML metadata gives crawlers an album-specific preview instead of the
  // shared hash-router document. Visitors open the existing album page.
  await writeFile(new URL(`share/${a.id}.html`,root),`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | Tom’s Music Library</title><meta name="description" content="${esc(description)}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}"><meta property="og:site_name" content="Tom’s Music Library">
<meta property="og:url" content="${esc(albumShareUrl(a))}"><meta property="og:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(title)} album cover"><meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(albumShareUrl(a))}"><link rel="stylesheet" href="../styles.css"></head>
<body><main><h1>${esc(title)}</h1><p>From Tom’s Music Library</p><a class="button" href="${esc(destination)}">View album →</a></main>
<script>location.replace(${JSON.stringify(destination).replace(/</g,'\\u003c')});</script></body></html>\n`);
}
console.log(`Prepared ${albums.length} album share pages.`);
