export const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/['’‘]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
export const artistKey = value => fold(value).replace(/^the (?!the$)/,'');
export const yearOf = album => Number.isInteger(Number(album.release_year)) && Number(album.release_year) >= 1800 && Number(album.release_year) <= 2100 ? Number(album.release_year) : null;
export const compare = (a,b) => String(a ?? '').localeCompare(String(b ?? ''),'en',{numeric:true,sensitivity:'base'});
export function spotifyUrl(album) {
  const value=String(album.spotify_url || '').trim();
  return /^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\/[a-zA-Z0-9]{22}(?:[?#].*)?$/.test(value) ? value : null;
}
export function spotifyAppUrl(album,userAgent='') {
  const web=spotifyUrl(album);
  if (!web) return null;
  const id=new URL(web).pathname.match(/\/album\/([a-zA-Z0-9]{22})$/)?.[1];
  if (!id) return null;
  const app=`spotify:album:${id}`;
  // Chrome launches this from the user's tap, targets the installed Spotify app,
  // and uses the exact album's web page if the app cannot handle the request.
  return /Android/i.test(userAgent)
    ? `intent:album:${id}#Intent;scheme=spotify;package=com.spotify.music;S.browser_fallback_url=${encodeURIComponent(web)};end`
    : app;
}
export function indexAlbums(albums) {
  return albums.map(a => ({...a,_artistKey:artistKey(a.artist),_artistSort:artistKey(a.artist_sort || a.artist),_year:yearOf(a),_search:fold([a.artist,a.artist_original,...(a.artist_search_aliases || []),a.album_title,a.track_listing,...(a.genres || []),...(a.styles || [])].join(' '))}));
}
export function matches(album,{q='',genre='',style='',format='',decade=''}={}) {
  const terms=fold(q).split(' ').filter(Boolean);
  // 'The' may be omitted from cataloged band names. Preserve meaningful 'The The'.
  const words=terms.length > 1 ? terms.filter(word=>word !== 'the') : terms;
  const compact=album._search.replace(/ /g,'');
  if (!words.every(word=>album._search.includes(word) || compact.includes(word))) return false;
  return (!genre || album.genres?.includes(genre)) && (!style || album.styles?.includes(style)) && (!format || album.owned_format === format) && (!decade || (album._year >= Number(decade) && album._year <= Number(decade)+9));
}
export function sortAlbums(albums,sort='artist') {
  const descending=sort.endsWith('-desc');
  const base=sort.replace(/-desc$/,'');
  return [...albums].sort((a,b)=>{
    let n=0;
    if (base==='oldest' || base==='newest') {
      if (!a._year && b._year) return 1;
      if (a._year && !b._year) return -1;
      n=(a._year || 0)-(b._year || 0);
      if (base==='newest') n=-n;
    } else if (base==='title') n=compare(a.album_title,b.album_title);
    else if (base==='format') n=compare(a.owned_format,b.owned_format);
    else if (base==='genre') n=compare(a.genres?.[0],b.genres?.[0]);
    else n=compare(a._artistSort,b._artistSort);
    if (!n) n=compare(a._artistSort,b._artistSort) || compare(a.album_title,b.album_title) || compare(a.id,b.id);
    return descending ? -n : n;
  });
}
// Group only the same artist/title within a one-year release window. Different
// title/edition wording stays distinct. Various-artist collections remain separate.
export function groupAlbums(albums) {
  const buckets=new Map();
  const groups=[];
  for (const album of [...albums].sort((a,b)=>(a._year || 9999)-(b._year || 9999) || compare(a.id,b.id))) {
    const key=album._artistKey+'|'+fold(album.album_title);
    const candidates=buckets.get(key) || [];
    const group=album._artistKey==='various' ? null : candidates.find(g=>g.year && album._year && Math.abs(g.year-album._year)<=1);
    if (group) group.editions.push(album);
    else {const g={id:album.id,year:album._year,editions:[album]};groups.push(g); candidates.push(g);buckets.set(key,candidates);}
  }
  return groups.map(g=>{
    const editions=g.editions.sort((a,b)=>['CD','Vinyl','Cassette'].indexOf(a.owned_format)-['CD','Vinyl','Cassette'].indexOf(b.owned_format) || compare(a.id,b.id));
    const representative=editions.find(a=>a.cover) || editions[0];
    return {...representative,editions,formats:[...new Set(editions.map(a=>a.owned_format))],_groupId:g.id};
  });
}
export function artistIndex(albums) {
  const map=new Map();
  for (const album of albums) {
    if (!map.has(album._artistKey)) map.set(album._artistKey,{key:album._artistKey,name:album.artist,sort:album._artistSort,albums:[]});
    map.get(album._artistKey).albums.push(album);
  }
  return [...map.values()].sort((a,b)=>compare(a.sort,b.sort));
}
export function browseAlbums(albums,filters={}, {sort='artist',groupByFormat=false}={}) {
  const raw=albums.filter(a=>matches(a,filters));
  const combined=!groupByFormat && !/^format(?:-desc)?$/.test(sort);
  return {raw,combined,list:sortAlbums(combined?groupAlbums(raw):raw,sort)};
}
export function seededPicks(groups,seed,limit=8) {
  let state=[...String(seed)].reduce((s,c)=>Math.imul(s^c.charCodeAt(0),16777619),2166136261)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const shuffled=groups.map(a=>({a,r:random()})).sort((a,b)=>a.r-b.r).map(x=>x.a);
  const picks=[],artists=new Set();
  for (const a of shuffled) {
    if (artists.has(a._artistKey)) continue;
    picks.push(a);artists.add(a._artistKey);
    if (picks.length===limit) break;
  }
  return picks;
}
export function shelfEligible(album) {
  if (artistKey(album.artist)==='jodeci') return false;
  if ((album.genres || []).some(genre=>['comedy','spoken word'].includes(fold(genre)))) return false;
  if (['CD','Cassette'].includes(album.owned_format)) {
    const edition=[album.matched_release?.media_format,album.matched_release?.edition,album.release_details].filter(Boolean).join(' ');
    if (/\b(?:cd|cassette|compact disc)\s+(?:maxi[- ]?)?single\b/i.test(edition)) return false;
  }
  return true;
}
export function parseTracks(text) {
  if (!text) return [];
  const lines=String(text).replace(/\\n/g,'\n')
    .replace(/\.?\s*(Side\s+[A-D])\s*:\s*(?=\d)/gi,'\n$1\n')
    .replace(/;\s*(?=\d+[.)]\s)/g,'\n')
    .split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  let number=0;
  return lines.map(line=>{
    if (/^(?:(?:disc|disk|cd)\s*\d+|side\s*(?:[a-d]|one|two|three|four|\d+))(?:\s*[:—–-].*)?$/i.test(line)) {
      number=0;return {type:'heading',text:line};
    }
    let section='';
    const prefix=line.match(/^(Side\s*[A-D])\s*(?:[:—–-]\s*|\s+(?=\d))(.+)$/i);
    if (prefix) {section=prefix[1];line=prefix[2];}
    const numbered=line.match(/^(?:(?:[A-D])\s*)?(\d+)[.)-]\s*(.*)$/i);
    const numberedSide=line.match(/^([A-D])(\d+)\s*[.:)-]?\s+(.+)$/i);
    let title=numbered?numbered[2]:numberedSide?numberedSide[3]:line;
    number=numbered?Number(numbered[1]):numberedSide?Number(numberedSide[2]):number+1;
    const duration=title.match(/\s+(?:[—–-]\s*)?\(?(\d{1,3}:\d{2})\)?\.?\s*$/);
    if (duration) title=title.slice(0,duration.index).trim();
    return {type:'track',number,title,time:duration?.[1] || '',section:section || (numberedSide?'Side '+numberedSide[1]:''),raw:line};
  });
}
export function coverPath(path,base='') {
  if (!/^covers\/album-\d{4,}-(front|thumb)\.webp$/.test(path || '')) return null;
  if (base && !/^https:\/\//.test(base)) return null;
  return base ? base.replace(/\/$/,'')+'/'+path : path;
}

// Inline only explicitly titled song credits, never positional guesses or album
// summaries. Conflicting credits for the same title stay in the full-credit panel.
export function trackWriters(album) {
  const credits=new Map();
  const bad=/\b(?:unknown|unverified|uncertain|various|traditional|arranged|arrangement|adapted|credited|credits|copyright|publisher|publishing|lyrics|music|written|composed|note|see|except|all songs|all tracks)\b/i;
  for (let line of String(album.songwriter_credits || '').replace(/\\n/g,'\n').split(/\r?\n/)) {
    line=line.trim();
    // Only a numbered, named track followed by an explicit credit separator.
    const match=line.match(/^(?:(?:Side\s*[A-D])\s*:?\s*)?(?:[A-D])?\d+[.)]\s*(.+?)\s+[—–]\s+(.+)$/i);
    if (!match) continue;
    const key=fold(match[1]);
    const raw=match[2].trim().replace(/\.$/,'');
    if (!raw || bad.test(raw) || /[():\d]/.test(raw)) continue;
    // A comma inversion cannot be distinguished from two authors safely.
    if (/^[\p{L}’'-]+,\s+[\p{L}’'-]+\s+[\p{L}’'-]+$/u.test(raw)) continue;
    const people=raw.split(/\s*(?:;|,|\/|&|\band\b)\s*/i).filter(Boolean);
    if (!people.length || people.some(name=>!/^\p{L}[\p{L}\s.'’‘"-]*$/u.test(name) || name.split(/\s+/).length>6)) continue;
    if (raw.includes(',') && people.some(name=>name.trim().split(/\s+/).length<2)) continue;
    const surnames=people.map(name=>{
      const words=name.trim().replace(/\s+(?:Jr\.?|Sr\.?|II|III|IV)$/,'').split(/\s+/);
      if (words.at(-1).replace(/\./g,'').length===1) return name.trim();
      let start=words.length-1;
      while(start>0 && /^(?:van|von|de|del|della|di|da|dos|la|le)$/i.test(words[start-1]))start--;
      return words.slice(start).join(' ');
    });
    const value=[...new Set(surnames)].join(' / ');
    if (!credits.has(key)) credits.set(key,new Set());
    credits.get(key).add(value);
  }
  return new Map([...credits].filter(([,values])=>values.size===1).map(([key,values])=>[key,[...values][0]]));
}
