import {openAlbumShare} from './share.mjs';
import {DECADE_STORIES,CONTINUING_STORY,PLAYLISTS} from './stories.mjs';
import {fold,artistKey,compare,indexAlbums,matches,sortAlbums,groupAlbums,browseAlbums,artistIndex,seededPicks,shelfEligible,parseTracks,trackWriters,spotifyUrl,spotifyAppUrl,coverPath} from './catalog.mjs';

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uri=encodeURIComponent;
const main=$('#main');
let albums=[],groups=[],artists=[],byId=new Map(),artistMap=new Map();
let limit=48;
let renderKey='',lastHash='',routeScroll=new Map();
let prefs={view:'grid',size:'comfortable',sort:'artist',artistSort:'oldest',groupByFormat:false};
let favorites=new Set();
try {const saved=JSON.parse(localStorage.getItem('toms-library-favorites') || '[]');if(Array.isArray(saved))favorites=new Set(saved.filter(id=>/^\d{4,}$/.test(id)));}catch{}
let editionGroups=new Map(),refreshBrowse=null;
const favoriteIds=a=>(editionGroups.get(a.id) || [a]).map(e=>e.id);
const isFavorite=a=>favoriteIds(a).some(id=>favorites.has(id));
function favoriteButton(a,large=false){const saved=isFavorite(a);return `<button type="button" class="favorite-button ${large?'favorite-large button':''}" data-favorite="${esc(a.id)}" aria-pressed="${saved}" aria-label="${esc((saved?'Remove ':'Save ')+a.album_title+(saved?' from favorites':' to favorites'))}" title="${saved?'Remove from favorites':'Save to favorites'}"><span aria-hidden="true">${saved?'♥':'♡'}</span>${large?`<span>${saved?'Saved':'Save album'}</span>`:''}</button>`;}
function saveSort(artist){prefs[artist?'artistSort':'sort']=$('#sort').value;savePrefs();}
try {prefs={...prefs,...JSON.parse(localStorage.getItem('toms-library-prefs') || '{}')};} catch {}
if (!['grid','table'].includes(prefs.view)) prefs.view='grid';
if (!['compact','comfortable','large'].includes(prefs.size)) prefs.size='comfortable';
for(const key of ['sort','artistSort'])if(!/^(artist|title|format|genre)(-desc)?$|^(oldest|newest)$/.test(prefs[key]))prefs[key]=key==='sort'?'artist':'oldest';
prefs.groupByFormat=prefs.groupByFormat===true;
const savePrefs=()=>{try {localStorage.setItem('toms-library-prefs',JSON.stringify(prefs));} catch {}};
const icons={
  spotify:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M5.5 9c4-1.2 8.5-.8 12 1M6.5 12.3c3.6-1 6.9-.6 10 1M7.3 15.5c3-.7 5.5-.4 8 .8" fill="none" stroke="#202221" stroke-width="1.7" stroke-linecap="round"/></svg>',
  search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></svg>',
  grid:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z"/></svg>',
  table:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v16H3zM3 9h18M3 15h18M9 4v16"/></svg>'
};
const route=()=>{const [pathname,query='']=(location.hash.slice(1) || '/home').split('?');return {parts:pathname.split('/').filter(Boolean).map(part=>{try{return decodeURIComponent(part);}catch{return part;}}),params:new URLSearchParams(query)};};
const pathFor=(name,id='')=>'#/'+name+(id?'/'+uri(id):'');
const artistLink=a=>pathFor('artist',a._artistKey);
const albumLink=a=>pathFor('album',a.id);
const tags=(values,cls='badge')=>values.map(v=>`<span class="${cls}">${esc(v)}</span>`).join('');
function stream(a,large=false) {
  const url=spotifyUrl(a);
  if (!url) return '';
  const android=/Android/i.test(navigator.userAgent);
  const href=android?spotifyAppUrl(a,navigator.userAgent):url;
  const label=android?`Open ${a.album_title} in the Spotify app`:`Listen to ${a.album_title} on Spotify (opens a new tab)`;
  const primary=`<a class="spotify ${large?'spotify-button':''}" href="${esc(href)}" ${android?'':'target="_blank" rel="noopener noreferrer"'} aria-label="${esc(label)}">${icons.spotify}${large?`<span>${android?'Open in Spotify app':'Listen on Spotify ↗'}</span>`:''}</a>`;
  const browser=android&&large?`<a class="text-link spotify-browser-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Listen in browser ↗</a>`:'';
  return primary+browser;
}

function cover(a,{hero=false,full=false}={}) {
  const base=window.MUSIC_CONFIG?.coverBaseUrl || '';
  const src=coverPath(a.cover?.[full?'full':'thumb'],base);
  if (!src) return '<span class="cover-placeholder" aria-label="Cover unavailable"><span>◎</span><small>From the shelves</small></span>';
  const fullsrc=coverPath(a.cover.full,base);
  return `<img src="${esc(src)}" ${full?'':`srcset="${esc(src)} 360w, ${esc(fullsrc)} 720w" sizes="(max-width:600px) 45vw, (max-width:1000px) 28vw, 240px"`} alt="${esc(a.album_title)} — ${esc(a.artist)} cover" width="${esc(a.cover.width)}" height="${esc(a.cover.height)}" loading="${hero?'eager':'lazy'}" decoding="async">`;
}
function card(a,{hero=false}={}) {
  const copies=a.editions?.length || 1;
  const stacked=copies>1;
  const artwork=coverPath(a.cover?.thumb,window.MUSIC_CONFIG?.coverBaseUrl || '');
  const stackStyle=stacked && artwork?` style="--stack-art:url(&quot;${esc(artwork)}&quot;)"`:'';
  const stackHint=stacked?`${copies} editions · ${(a.formats || []).join(' · ')}`:'';
  return `<article class="album-card" data-album-id="${esc(a.id)}"><div class="cover-stack ${stacked?'has-multiple':''} ${copies>2?'three-deep':''}"${stackStyle}${stacked?` title="${esc(stackHint)}"`:''}><a class="cover-link" href="${albumLink(a)}"${stacked?` aria-label="${esc(a.album_title)} — ${esc(stackHint)}"`:''}>${cover(a,{hero})}</a></div><div class="card-info"><a class="album-name" href="${albumLink(a)}">${esc(a.album_title)}</a><a class="artist-name" href="${artistLink(a)}">${esc(a.artist)}</a><div class="card-meta"><span>${a._year || 'Year unknown'}</span><span class="formats">${esc((a.formats || [a.owned_format]).join(' · '))}</span>${stream(a)}${favoriteButton(a)}</div></div></article>`;
}
const grid=(list,cls='')=>`<div class="album-grid ${cls}">${list.map(a=>card(a)).join('')}</div>`;
const title=(kicker,heading,description='',actions='')=>`<div class="page-heading"><div><p class="eyebrow">${esc(kicker)}</p><h1>${esc(heading)}</h1>${description?`<p class="subheading">${description}</p>`:''}</div>${actions}</div>`;
const groupCount=list=>groupAlbums(list).length;
function decadeTiles() {
  const decades=[...new Set(groups.filter(a=>a._year).map(a=>Math.floor(a._year/10)*10))].sort((a,b)=>a-b);
  return decades.map(d=>{const list=groups.filter(a=>a._year>=d && a._year<d+10);return `<a class="decade-tile" href="#/decade/${d}"><span>${d}s</span><small>${list.length} albums <span aria-hidden="true">↗</span></small></a>`;}).join('');
}
function home() {
  const selectionSeed=crypto.randomUUID();
  const shelfGroups=groupAlbums(albums.filter(shelfEligible));
  const picks=seededPicks(shelfGroups,selectionSeed,8);
  const hero=(window.MUSIC_CONFIG?.bannerAlbumIds || []).map(id=>byId.get(id)).filter(Boolean).slice(0,3);
  main.innerHTML=`<section class="hero"><div class="hero-copy"><p class="eyebrow">A lifetime of listening</p><h1>Good music<br>stays with you.</h1><p>Rock, jazz, acoustic discoveries, and everything in between. Welcome to my collection.</p><a class="button primary" href="#/collection">Explore the collection <span>↗</span></a><p class="hero-count">${groups.length.toLocaleString()} albums · ${artists.length.toLocaleString()} artists · Vinyl, CD & cassette</p></div><div class="hero-covers">${hero.map(a=>`<a href="${albumLink(a)}" aria-label="Explore ${esc(a.album_title)}">${cover(a,{hero:true})}</a>`).join('')}</div></section><section class="section"><div class="section-heading"><div><p class="eyebrow">Something worth another listen</p><h2>From the shelves</h2></div><button class="text-button" id="shuffle">⤨ Shuffle selection</button></div>${grid(picks,'home-grid')}<div class="section-end"><a class="text-link" href="#/collection">Browse the whole collection ↗</a><button class="text-button" id="random">Pick an album for me ↗</button></div></section><section class="section"><div class="section-heading"><div><p class="eyebrow">Follow the music through time</p><h2>Through the decades</h2></div><a class="text-link" href="#/decades">Explore decades ↗</a></div><div class="decade-grid">${decadeTiles()}</div></section>`;
  $('#shuffle').onclick=()=>{home();$('#shuffle').focus();};
  $('#random').onclick=()=>pickRandom(shelfGroups);
}
function pickRandom(list) {if (list.length) location.hash=albumLink(list[Math.floor(Math.random()*list.length)]);}
function option(value,label,selected) {return `<option value="${esc(value)}" ${selected===String(value)?'selected':''}>${esc(label)}</option>`;}
function sortSelect(value,artist=false) {
  const choices=artist?[['oldest','Release year: oldest first'],['newest','Release year: newest first'],['title','Album title: A–Z']]:[['artist','Artist: A–Z'],['artist-desc','Artist: Z–A'],['title','Album title: A–Z'],['title-desc','Album title: Z–A'],['oldest','Release year: oldest first'],['newest','Release year: newest first'],['format','Format'],['genre','Genre']];
  if (!choices.some(([key])=>key===value) && /^(artist|title|format|genre)(-desc)?$/.test(value)) choices.push([value,value.replace('-desc',' descending')]);
  return `<label class="sort-control"><span class="sr-only">Sort albums</span><select id="sort">${choices.map(([v,l])=>option(v,l,value)).join('')}</select></label>`;
}
function toolbar(params,{artist=false,fixedDecade=''}={}) {
  const genres=[...new Set(albums.flatMap(a=>a.genres || []))].sort(compare);
  const styles=[...new Set(albums.flatMap(a=>a.styles || []))].sort(compare);
  const decades=[...new Set(albums.filter(a=>a._year).map(a=>Math.floor(a._year/10)*10))].sort((a,b)=>a-b);
  return `<form id="browse-form" class="browse-toolbar" role="search"><div class="search-field">${icons.search}<input id="search" name="q" type="search" aria-label="Search artist, album, or song" placeholder="Search artists, albums, or songs" value="${esc(params.get('q') || '')}" autocomplete="off"><kbd>/</kbd></div><button class="filter-toggle button" type="button" aria-expanded="false" aria-controls="filter-controls">Filters <span id="filter-count"></span></button><div id="filter-controls" class="filter-controls"><label><span class="sr-only">Genre</span><select name="genre" id="genre">${option('','All genres',params.get('genre'))}${genres.map(g=>option(g,g,params.get('genre'))).join('')}</select></label><label><span class="sr-only">Style</span><select name="style" id="style">${option('','All styles',params.get('style'))}${styles.map(g=>option(g,g,params.get('style'))).join('')}</select></label>${fixedDecade?'':`<label><span class="sr-only">Decade</span><select name="decade" id="decade">${option('','All decades',params.get('decade'))}${decades.map(d=>option(d,d+'s',params.get('decade'))).join('')}</select></label>`}<label><span class="sr-only">Format</span><select name="format" id="format">${option('','All formats',params.get('format'))}${['Vinyl','CD','Cassette'].map(g=>option(g,g,params.get('format'))).join('')}</select></label></div><div class="browse-display">${sortSelect(params.get('sort') || (artist?prefs.artistSort:prefs.sort),artist)}<div class="view-switch" role="group" aria-label="View"><button type="button" data-view="grid" aria-label="Grid view" aria-pressed="${prefs.view==='grid'}">${icons.grid}</button><button type="button" data-view="table" aria-label="Table view" aria-pressed="${prefs.view==='table'}">${icons.table}</button></div><div class="size-switch" role="group" aria-label="Cover size">${['compact','comfortable','large'].map((s,i)=>`<button type="button" data-size="${s}" aria-label="${s} covers" title="${s} covers" aria-pressed="${prefs.size===s}"><span style="--dot-size:${8+i*3}px"></span></button>`).join('')}</div></div></form><div class="results-summary"><span id="result-count" role="status" aria-live="polite"></span><div><label class="group-toggle favorites-toggle"><input type="checkbox" id="favorites-only" ${params.get('favorites')==='1'?'checked':''}> Favorites only</label>${!artist?`<label class="group-toggle"><input type="checkbox" id="group-format" ${(params.has('group')?params.get('group')==='format':prefs.groupByFormat)?'checked':''}> Group by format</label>`:''}<button class="text-button" id="clear-filters">Clear filters</button><button class="text-button" id="random">Pick an album ↗</button></div></div><div id="results"></div><div class="load-wrap"><button id="load-more" class="button" hidden>Show more albums</button></div>`;
}
function table(list,sort) {
  const headers=[['artist','Artist'],['title','Album'],['oldest','Release year'],['format','Format'],['genre','Genre']];
  return `<div class="table-scroll" role="region" aria-label="Album table" tabindex="0"><table><thead><tr>${headers.map(([key,label])=>{const active=sort===key || sort===key+'-desc' || key==='oldest'&&sort==='newest';return `<th scope="col" ${active?`aria-sort="${sort.endsWith('-desc')||sort==='newest'?'descending':'ascending'}"`:''}><button data-sort-column="${key}">${label} ${active?(sort.endsWith('-desc')||sort==='newest'?'↓':'↑'):'↕'}</button></th>`;}).join('')}<th scope="col"><span class="sr-only">Listen</span></th></tr></thead><tbody>${list.map(a=>`<tr data-album-id="${a.id}"><td><a href="${artistLink(a)}">${esc(a.artist)}</a></td><td><a class="table-album" href="${albumLink(a)}"><span class="table-cover">${cover(a)}</span><span>${esc(a.album_title)}</span></a></td><td>${a._year || '—'}</td><td>${esc((a.formats || [a.owned_format]).join(' · '))}</td><td>${esc((a.genres || []).join(' · '))}</td><td><div class="table-actions">${stream(a)}${favoriteButton(a)}</div></td></tr>`).join('')}</tbody></table></div>`;
}
function browse(params,{artist=null,decade=''}={}) {
  const base=artist?artist.albums:albums;
  const pageTitle=artist?artist.name:decade?decade+'s':'The collection';
  main.innerHTML=`${artist?'<a class="back-link" href="#/artists">← All artists</a>':decade?'<a class="back-link" href="#/decades">← All decades</a>':''}<div class="${decade?'decade-header':''}">${title(artist?'In Tom’s collection':decade?'Through the decades':'Explore the shelves',pageTitle,artist?`${groupCount(base)} albums · ${base.length} editions`:decade?'Albums released during this decade.':`${groups.length.toLocaleString()} albums across ${albums.length.toLocaleString()} editions.`,artist?'<label class="group-toggle"><input type="checkbox" id="group-format" '+((params.has('group')?params.get('group')==='format':prefs.groupByFormat)?'checked':'')+'> Group by format</label>':'')}${decade && DECADE_STORIES[decade]?`<details class="decade-note" id="decade-note"><summary>My listening in the ${decade}s</summary><div class="decade-note-text">${storyParagraphs(DECADE_STORIES[decade].paragraphs)}</div></details>`:''}</div><div id="browser">${toolbar(params,{artist:Boolean(artist),fixedDecade:decade})}</div>`;
  setDecadeNoteLayout();
  function currentFilters() {return {q:$('#search').value,genre:$('#genre').value,style:$('#style').value,format:$('#format').value,decade:decade || $('#decade')?.value || ''};}
  function syncURL() {
    const r=route();const p=new URLSearchParams();
    for (const [k,v] of Object.entries(currentFilters())) if (v && !(k==='decade'&&decade)) p.set(k,v);
    p.set('sort',$('#sort').value);
    p.set('group',$('#group-format')?.checked?'format':'none');
    if($('#favorites-only').checked)p.set('favorites','1');
    history.replaceState(null,'','#/'+r.parts.map(uri).join('/')+(p.size?'?'+p:''));
    lastHash=location.hash;
  }
  function update({reset=false}={}) {
    if (reset) limit=48;
    const filters=currentFilters();
    const {raw,combined:grouped,list}=browseAlbums($('#favorites-only').checked?base.filter(isFavorite):base,filters,{sort:$('#sort').value,groupByFormat:Boolean($('#group-format')?.checked)});
    const visible=list.slice(0,limit);
    let html='';
    if (!list.length) html=`<div class="empty"><span>◎</span><h2>No albums on this shelf</h2><p>${$('#favorites-only').checked?'Save albums with the heart button to build your favorites on this device.':'Try a different search or clear the filters.'}</p><button class="button" data-clear>Show all albums</button></div>`;
    else if ($('#group-format')?.checked) {
      for (const format of ['Vinyl','CD','Cassette']) {
        const subset=visible.filter(a=>a.owned_format===format);
        if (subset.length) html+=`<section class="format-section"><h2>${format} <span class="count">${raw.filter(a=>a.owned_format===format).length}</span></h2>${prefs.view==='table'?table(subset,$('#sort').value):grid(subset,prefs.size)}</section>`;
      }
    } else html=prefs.view==='table'?table(visible,$('#sort').value):grid(visible,prefs.size);
    $('#results').innerHTML=html;
    $('#result-count').textContent=`${list.length.toLocaleString()} ${grouped?(list.length===1?'album':'albums'):(list.length===1?'edition':'editions')}${list.length>limit?` · showing ${visible.length}`:''}`;
    $('#load-more').hidden=list.length<=limit;
    const count=Object.values(filters).filter(Boolean).length-(decade?1:0)+Number($('#favorites-only').checked);
    $('#clear-filters').hidden=!count;
    $('#filter-count').textContent=count?`(${count})`:'';
    $('#random').disabled=!list.length;
    $('#random').onclick=()=>pickRandom(list);
    $$('.size-switch button').forEach(b=>b.disabled=prefs.view==='table');
    $$('[data-sort-column]').forEach(b=>b.onclick=()=>{
      const key=b.dataset.sortColumn,current=$('#sort').value;
      const next=key==='oldest'?(current==='oldest'?'newest':'oldest'):(current===key?key+'-desc':key);
      if (![...$('#sort').options].some(o=>o.value===next)) $('#sort').add(new Option(next,next));
      $('#sort').value=next;saveSort(Boolean(artist));syncURL();update();$(`[data-sort-column="${key}"]`)?.focus({preventScroll:true});
    });
    $('[data-clear]')?.addEventListener('click',clear);
    syncURL();
  }
  function clear() {$('#favorites-only').checked=false;$('#search').value='';for (const id of ['genre','style','format','decade']) if ($('#'+id)) $('#'+id).value='';update({reset:true});$('#search').focus({preventScroll:true});}
  $('#browse-form').onsubmit=e=>{e.preventDefault();update({reset:true});};
  $('#search').oninput=()=>update({reset:true});
  for (const id of ['genre','style','format','decade','sort','group-format','favorites-only']) $('#'+id)?.addEventListener('change',()=>{if(id==='sort')saveSort(Boolean(artist));if(id==='group-format'){prefs.groupByFormat=$('#group-format').checked;savePrefs();}update({reset:true});});
  $('#clear-filters').onclick=clear;
  refreshBrowse=()=>update();
  $('#load-more').onclick=()=>{const old=limit;limit+=48;update();const added=$$('#results [data-album-id]')[old];const target=added?.querySelector('a');if(target)target.focus({preventScroll:true});else $('#result-count').focus();};
  $$('.view-switch button').forEach(b=>b.onclick=()=>{prefs.view=b.dataset.view;savePrefs();$$('.view-switch button').forEach(x=>x.setAttribute('aria-pressed',x===b));update();});
  $$('.size-switch button').forEach(b=>b.onclick=()=>{prefs.size=b.dataset.size;savePrefs();$$('.size-switch button').forEach(x=>x.setAttribute('aria-pressed',x===b));update();});
  $('.filter-toggle').onclick=()=>{const expanded=$('.filter-toggle').getAttribute('aria-expanded')==='true';$('.filter-toggle').setAttribute('aria-expanded',!expanded);$('#filter-controls').classList.toggle('expanded',!expanded);};
  update();
  if (params.get('focus')==='search') $('#search').focus();
}
function artistsPage(params) {
  const q=params.get('q') || '';
  main.innerHTML=`${title('The names behind the music','Artists',`${artists.length} artists, ensembles, and collections.`)}<div class="search-field artist-search">${icons.search}<input type="search" id="artist-search" aria-label="Search artists" placeholder="Find an artist" value="${esc(q)}"></div><nav class="alphabet" aria-label="Jump to artist letter"></nav><div id="artist-results"></div>`;
  function update() {
    const search=artistKey($('#artist-search').value);
    const list=artists.filter(a=>artistKey(a.name).includes(search) || a.albums.some(x=>(x.artist_search_aliases || []).some(alias=>artistKey(alias).includes(search))));
    const letters=[...new Set(list.map(a=>/^[a-z]/i.test(a.sort)?a.sort[0].toUpperCase():'#'))];
    $('.alphabet').innerHTML=letters.map(l=>`<button class="text-button" data-letter="${l}" aria-label="Jump to ${l}">${l}</button>`).join('');
    $('#artist-results').innerHTML=list.length?letters.map(letter=>`<section class="artist-letter" id="letter-${letter==='#'?'numbers':letter}"><h2>${letter}</h2><div class="artist-list">${list.filter(a=>(/^[a-z]/i.test(a.sort)?a.sort[0].toUpperCase():'#')===letter).map(a=>`<a href="${pathFor('artist',a.key)}"><span>${esc(a.name)}</span><small>${groupCount(a.albums)} albums <span aria-hidden="true">↗</span></small></a>`).join('')}</div></section>`).join(''):'<div class="empty"><h2>No artists found</h2><p>Try another name.</p></div>';
    $$('[data-letter]').forEach(b=>b.onclick=()=>document.getElementById('letter-'+(b.dataset.letter==='#'?'numbers':b.dataset.letter))?.scrollIntoView({behavior:'smooth'}));
    const p=new URLSearchParams();if ($('#artist-search').value) p.set('q',$('#artist-search').value);history.replaceState(null,'','#/artists'+(p.size?'?'+p:''));lastHash=location.hash;
  }
  $('#artist-search').oninput=update;update();
}
function textSection(heading,body,cls='') {return body?`<section class="detail-section ${cls}"><h2>${esc(heading)}</h2><p class="preserve-lines">${esc(body)}</p></section>`:'';}
function albumPage(id) {
  const a=byId.get(id);
  if (!a) {notFound();return;}
  const editions=groups.find(g=>g.editions.some(e=>e.id===id))?.editions || [a];
  const tracks=parseTracks(a.track_listing);
  const writers=trackWriters(a);
  const release=a.matched_release || {};
  const releaseFields=[['Release year',a._year],['Label',release.label],['Catalog number',release.catalog_number],['Country',release.country],['Edition',release.edition || release.media_format]];
  main.innerHTML=`<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="#/collection">Collection</a><span>/</span><a href="${artistLink(a)}">${esc(a.artist)}</a><span>/</span><span>${esc(a.album_title)}</span></nav><section class="album-hero"><div class="album-art">${cover(a,{hero:true,full:true})}</div><div class="album-intro"><a class="artist-heading" href="${artistLink(a)}">${esc(a.artist)}</a><h1>${esc(a.album_title)}</h1><p class="album-year">${a._year || 'Year unknown'} <span>·</span> ${esc(a.owned_format)}</p><div class="genre-tags">${(a.genres || []).map(g=>`<a class="badge" href="#/collection?genre=${uri(g)}">${esc(g)}</a>`).join('')}${(a.styles || []).map(s=>`<a class="badge quiet" href="#/collection?style=${uri(s)}">${esc(s)}</a>`).join('')}</div>${editions.length>1?`<div class="edition-picker"><p class="small-label">In the collection</p><div>${editions.map(e=>`<a class="button ${e.id===id?'selected':''}" href="${albumLink(e)}" ${e.id===id?'aria-current="true"':''}>${esc(e.owned_format)}${editions.filter(x=>x.owned_format===e.owned_format).length>1?' · Edition '+(editions.indexOf(e)+1):''}</a>`).join('')}</div></div>`:''}<div class="album-actions">${stream(a,true)}${favoriteButton(a,true)}<button class="button" id="copy-link">${window.MUSIC_CONFIG?.enableAlbumSharing===false?'Copy album link':'Share ↗'}</button></div></div></section>${textSection('Behind the album',a.anecdotes,'anecdote')}<div class="album-columns"><div><section class="detail-section"><div class="section-heading"><h2>Track listing</h2>${tracks.length?`<span class="muted">${tracks.filter(t=>t.type==='track').length} tracks</span>`:''}</div>${tracks.length?`<ol class="track-list">${tracks.map(t=>t.type==='heading'?`<li class="disc-heading"><h3>${esc(t.text)}</h3></li>`:`<li class="track"><span class="track-number">${esc(t.section?t.section+' · '+t.number:t.number)}</span><span>${esc(t.title)}${writers.has(fold(t.title))?` <span class="track-writers">(${esc(writers.get(fold(t.title)))})</span>`:''}</span><span class="track-time">${esc(t.time)}</span></li>`).join('')}</ol>`:'<p class="muted">A track listing isn’t available for this edition.</p>'}</section>${a.songwriter_credits?`<details class="credit-details"><summary>Songwriting credits</summary><p class="preserve-lines">${esc(a.songwriter_credits)}</p></details>`:''}</div><aside class="album-sidebar">${textSection('Personnel',a.personnel)}${textSection('Guest artists',a.guest_artists)}${textSection('Production',a.production_credits)}${textSection('Album chart',a.album_chart)}${textSection('Singles chart',a.singles_chart)}</aside></div><section class="detail-section release-details"><h2>About this edition</h2><dl>${releaseFields.filter(([,value])=>value).map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${a.release_details?`<p class="preserve-lines">${esc(a.release_details)}</p>`:''}</section><section class="section"><div class="section-heading"><h2>More from ${esc(a.artist)}</h2><a class="text-link" href="${artistLink(a)}">View artist ↗</a></div>${grid(groups.filter(g=>g._artistKey===a._artistKey && !g.editions.some(e=>e.id===id)).slice(0,6),'related-grid') || ''}${groups.filter(g=>g._artistKey===a._artistKey).length<=1?'<p class="muted">This is the only album by this artist in the collection.</p>':''}</section>`;
  $('#copy-link').onclick=async()=>{if(window.MUSIC_CONFIG?.enableAlbumSharing!==false){openAlbumShare(a,$('#copy-link'));return;}try {await navigator.clipboard.writeText(location.href);$('#copy-link').textContent='Link copied';} catch {$('#copy-link').textContent='Copy the address from your browser';}};
}
function setDecadeNoteLayout() {
  const note=$('#decade-note');
  if(note)note.open=!window.matchMedia('(max-width:700px)').matches;
}
window.matchMedia('(max-width:700px)').addEventListener('change',setDecadeNoteLayout);
function storyParagraphs(paragraphs) {
  return paragraphs.map(p=>`<p>${esc(p)}</p>`).join('');
}
function continuingStory() {
  return `<section class="continuing-story" aria-labelledby="continuing-title"><p class="eyebrow">Beyond the shelves</p><h2 id="continuing-title">The listening continues</h2><div class="story-prose">${storyParagraphs(CONTINUING_STORY)}</div><div class="playlist-grid">${PLAYLISTS.map(p=>`<a class="playlist-card" href="https://open.spotify.com/playlist/${p.id}" target="_blank" rel="noopener noreferrer" aria-label="Listen to Tom’s ${esc(p.name)} playlist on Spotify (opens a new tab)">${icons.spotify}<span><strong>${esc(p.name)}</strong><small>${esc(p.description)}</small></span><span aria-hidden="true">↗</span></a>`).join('')}</div></section>`;
}
function decadesPage() {
  main.innerHTML=`${title('A lifetime of listening','Through the decades','The music on the shelves, and the story of how it found its way here.')}<div class="decade-grid decade-page">${decadeTiles()}</div><div class="decade-stories">${Object.entries(DECADE_STORIES).map(([decade,story])=>`<article class="decade-story"><div class="story-era"><span>${decade}s</span><a class="text-link" href="#/decade/${decade}">Browse the albums ↗</a></div><div class="story-prose"><h2>${esc(story.title)}</h2>${storyParagraphs(story.paragraphs)}</div></article>`).join('')}</div>${continuingStory()}`;
}

function aboutPage() {
  main.innerHTML=`${title('Behind the shelves','About the collection')}<section class="about-layout"><div class="narrow"><h2>A lifetime of listening.</h2><p class="body-copy">Welcome to Tom’s Music Library: a personal collection of records, CDs, and cassettes, gathered over the years.</p><p class="body-copy">Browse familiar favorites, explore a different genre, or let the shelves choose something for you. Each album brings together its cover, track listing, credits, and the stories available about the music.</p><p class="body-copy">Save albums using the heart button, then choose Favorites only in the collection. Favorites are stored in this browser on this device; they do not sync, and clearing browser data removes them.</p><p class="body-copy">Where there’s a Spotify link, you can head straight to the album and listen. Streaming editions may differ from the copy in the collection.</p><a class="button primary" href="#/collection">Explore the collection ↗</a></div><dl class="collection-stats"><div><dt>Albums</dt><dd>${groups.length.toLocaleString()}</dd></div><div><dt>Artists</dt><dd>${artists.length.toLocaleString()}</dd></div>${['Vinyl','CD','Cassette'].map(f=>`<div><dt>${f} editions</dt><dd>${albums.filter(a=>a.owned_format===f).length.toLocaleString()}</dd></div>`).join('')}</dl></section>`;
}
function notFound() {main.innerHTML=`<div class="empty"><h1>That shelf isn’t here.</h1><p>The link may be incomplete.</p><a href="#/collection" class="button">Browse the collection</a></div>`;}
function render() {
  if (lastHash) routeScroll.set(lastHash,{y:window.scrollY,limit});
  refreshBrowse=null;
  const incoming=location.hash || '#/home';
  const restore=routeScroll.get(incoming);
  const {parts,params}=route();
  const name=parts[0] || 'home';
  const key=parts.join('/');
  limit=restore?.limit || (renderKey===key?limit:48);
  renderKey=key;
  const active=name==='artist'?'artists':name==='album'?'collection':name==='decade'?'decades':name;
  $$('[data-nav]').forEach(a=>{if(a.dataset.nav===active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#navigation').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');
  let subtitle='';
  if(name==='home') home();
  else if(name==='collection') browse(params);
  else if(name==='artists') artistsPage(params);
  else if(name==='artist') {const artist=artistMap.get(parts[1] || '');if(artist){browse(params,{artist});subtitle=artist.name;}else notFound();}
  else if(name==='album') {albumPage(parts[1] || '');subtitle=byId.get(parts[1])?.album_title || 'Album';}
  else if(name==='decades') decadesPage();
  else if(name==='decade' && /^\d{3}0$/.test(parts[1])) browse(params,{decade:parts[1]});
  else if(name==='about') aboutPage();else notFound();
  document.title=(subtitle || {home:'',collection:'The collection',artists:'Artists',decades:'Through the decades',decade:parts[1]+'s',about:'About'}[name] || '')+(name==='home'?'':' · ')+ 'Tom’s Music Library';
  lastHash=location.hash;
  requestAnimationFrame(()=>{window.scrollTo(0,restore?.y || 0);if(params.get('focus')!=='search')main.focus({preventScroll:true});});
}
$('#menu-toggle').onclick=()=>{const open=$('#menu-toggle').getAttribute('aria-expanded')==='true';$('#menu-toggle').setAttribute('aria-expanded',!open);$('#navigation').classList.toggle('open',!open);};
$('.skip-link').onclick=e=>{e.preventDefault();main.focus();main.scrollIntoView();};
if ('scrollRestoration' in history) history.scrollRestoration='manual';
document.addEventListener('keydown',e=>{if(e.key==='/' && !document.querySelector('dialog[open]') && !e.ctrlKey && !e.altKey && !e.metaKey && !/input|textarea|select/i.test(document.activeElement.tagName)){e.preventDefault();if($('#search'))$('#search').focus();else location.hash='#/collection?focus=search';}if(e.key==='Escape'){const wasOpen=$('#navigation').classList.contains('open');$('#navigation').classList.remove('open');if(wasOpen)$('#menu-toggle').focus();$('#menu-toggle').setAttribute('aria-expanded','false');}});
// Broken artwork must not turn a whole album card into an empty interactive area.
document.addEventListener('error',e=>{if(e.target.tagName==='IMG'){const box=document.createElement('span');box.className='cover-placeholder';box.setAttribute('aria-label','Cover unavailable');box.innerHTML='<span>◎</span><small>From the shelves</small>';e.target.replaceWith(box);}},true);
try {
  const response=await fetch('catalog.json');
  if(!response.ok)throw new Error('Catalog unavailable');
  const data=await response.json();
  albums=indexAlbums(data.albums);byId=new Map(albums.map(a=>[a.id,a]));groups=groupAlbums(albums);artists=artistIndex(albums);artistMap=new Map(artists.map(a=>[a.key,a]));
  for(const group of groups)for(const edition of group.editions)editionGroups.set(edition.id,group.editions);
  window.addEventListener('hashchange',render);render();
} catch(error) {
  main.innerHTML='<div class="empty"><h1>The shelves couldn’t load.</h1><p>Please try again in a moment.</p><button class="button" id="retry">Try again</button></div>';$('#retry').onclick=()=>location.reload();console.error(error);
}

function refreshFavoriteButtons(){
  $$('[data-favorite]').forEach(b=>{const a=byId.get(b.dataset.favorite);if(!a)return;const large=b.classList.contains('favorite-large');b.outerHTML=favoriteButton(a,large);});
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-favorite]');if(!button)return;
  const a=byId.get(button.dataset.favorite);if(!a)return;
  const remove=isFavorite(a),next=new Set(favorites);
  favoriteIds(a).forEach(id=>remove?next.delete(id):next.add(id));
  try{localStorage.setItem('toms-library-favorites',JSON.stringify([...next]));}
  catch{$('#announcement').textContent='Favorites could not be saved. Browser storage may be unavailable.';return;}
  favorites=next;
  const id=a.id,large=button.classList.contains('favorite-large');
  if(refreshBrowse)refreshBrowse();else refreshFavoriteButtons();
  const replacement=$$('[data-favorite]').find(b=>b.dataset.favorite===id&&b.classList.contains('favorite-large')===large);
  if(replacement)replacement.focus({preventScroll:true});else $('#favorites-only')?.focus({preventScroll:true});
  $('#announcement').textContent=`${a.album_title} ${remove?'removed from':'saved to'} favorites on this device.`;
});
window.addEventListener('storage',event=>{
  if(event.key==='toms-library-favorites'||event.key===null){
    try{const saved=JSON.parse(event.newValue || '[]');favorites=new Set(Array.isArray(saved)?saved.filter(id=>/^\d{4,}$/.test(id)):[]);}catch{favorites=new Set();}
    if(refreshBrowse)refreshBrowse();else refreshFavoriteButtons();
  }
});
