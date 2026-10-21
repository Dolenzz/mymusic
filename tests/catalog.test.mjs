import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {indexAlbums,artistKey,fold,yearOf,matches,sortAlbums,groupAlbums,browseAlbums,artistIndex,seededPicks,shelfEligible,parseTracks,trackWriters,spotifyUrl,coverPath} from '../site/catalog.mjs';
import {DECADE_STORIES,CONTINUING_STORY,PLAYLISTS} from '../site/stories.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const data=JSON.parse(await readFile(new URL('../site/catalog.json',import.meta.url),'utf8'));
const albums=indexAlbums(data.albums);
let master=null;
try {master=JSON.parse(await readFile(path.resolve(root,'../Master Collection/music_collection_master.json'),'utf8'));}
catch(error) {if(error.code!=='ENOENT')throw error;}
const groups=groupAlbums(albums);
const artists=artistIndex(albums);

test('public catalog preserves every permanent ID and original album field',()=>{
  assert.equal(albums.length,1041);
  assert.equal(new Set(albums.map(a=>a.id)).size,1041);
  for(const original of master?.albums || data.albums){
    const exported=data.albums.find(a=>a.id===original.id);
    assert.ok(exported,original.id);
    for(const key of Object.keys(exported).filter(k=>k!=='cover')) assert.deepEqual(exported[key],original[key]??null,`${original.id}:${key}`);
    for(const key of ['research','genre_research','front_cover']) assert.equal(key in exported,false);
    assert.ok(yearOf(exported),`year missing: ${original.id}`);
  }
});

test('every cover and thumbnail exists, is WebP, and maps to the permanent ID',async()=>{
  for(const album of albums){
    assert.ok(album.cover,album.id);
    for(const type of ['full','thumb']){
      const relative=album.cover[type];
      assert.match(relative,new RegExp(`^covers/album-${album.id}-`));
      assert.equal(coverPath(relative),relative);
      const bytes=await readFile(path.join(root,'site',relative));
      assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    }
  }
});

test('search finds every album by its own artist and title including punctuation and accents',()=>{
  for(const a of albums){assert.ok(matches(a,{q:a.artist+' '+a.album_title}),a.id);assert.ok(matches(a,{q:fold(a.artist)+' '+fold(a.album_title)}),a.id);}
  const sample=indexAlbums([{id:'a',artist:'Bryan Adams',artist_original:'Adams, Bryan',artist_sort:'Adams, Bryan',album_title:'Example',track_listing:'1. Don’t Stop',genres:['Rock']}])[0];
  for(const q of ['Adams, Bryan','Bryan Adams',"dont stop"]) assert.ok(matches(sample,{q}));
  assert.equal(artistKey('The Cars'),artistKey('Cars'));assert.equal(artistKey('The The'),'the the');
  assert.ok(matches(indexAlbums([{artist:'Cars',album_title:'Heartbeat City'}])[0],{q:'The Cars'}));
});

test('artist ordering uses catalog surname rather than display first name',()=>{
  const list=indexAlbums([{id:'1',artist:'Bryan Adams',artist_sort:'Adams, Bryan',album_title:'A'},{id:'2',artist:'Alice Cooper',artist_sort:'Cooper, Alice',album_title:'B'},{id:'3',artist:'Cars',album_title:'C'}]);
  assert.deepEqual(sortAlbums(list,'artist').map(a=>a.id),['1','3','2']);
});

test('combined filters never leak another genre, format, style, or decade',()=>{
  for(const format of ['CD','Vinyl','Cassette']) for(const genre of ['Rock','Jazz','New Age']){
    const results=albums.filter(a=>matches(a,{format,genre,decade:'1980'}));
    assert.ok(results.every(a=>a.owned_format===format && a.genres.includes(genre) && a._year>=1980 && a._year<1990));
  }
  assert.equal(albums.filter(a=>matches(a,{q:'impossible zzzz nonexistent'})).length,0);
});

test('artist grouping keeps every edition exactly once and removes repeated covers for the same album',()=>{
  const retained=groups.flatMap(g=>g.editions.map(e=>e.id)).sort();
  assert.deepEqual(retained,albums.map(a=>a.id).sort());
  for(const artist of artists) for(const format of ['CD','Vinyl','Cassette']){
    const editionIds=artist.albums.filter(a=>a.owned_format===format).map(a=>a.id).sort();
    const regroupedIds=groupAlbums(artist.albums).flatMap(g=>g.editions.filter(a=>a.owned_format===format)).map(a=>a.id).sort();
    assert.deepEqual(editionIds,regroupedIds);
  }
  const duplicate=indexAlbums([{id:'1',artist:'The Cars',album_title:'Heartbeat City',release_year:1984,owned_format:'Vinyl'},{id:'2',artist:'Cars',album_title:'Heartbeat City',release_year:1985,owned_format:'CD'},{id:'3',artist:'Cars',album_title:'Heartbeat City Deluxe',release_year:1984,owned_format:'CD'},{id:'4',artist:'Cars',album_title:'Greatest Hits',release_year:1990,owned_format:'CD'},{id:'5',artist:'Cars',album_title:'Greatest Hits',release_year:2005,owned_format:'CD'}]);
  const merged=groupAlbums(duplicate);assert.equal(merged.length,4);assert.deepEqual(merged.find(g=>g.editions.length===2).formats,['CD','Vinyl']);
});

test('all supported sorts cover the complete data without mutating it',()=>{
  const original=albums.map(a=>a.id);
  for(const key of ['artist','artist-desc','title','title-desc','oldest','newest','format','genre']){
    const sorted=sortAlbums(albums,key);assert.equal(sorted.length,1041);assert.equal(new Set(sorted.map(a=>a.id)).size,1041);
    if(key==='oldest') assert.ok(sorted.every((a,i)=>!i||a._year>=sorted[i-1]._year));
    if(key==='newest') assert.ok(sorted.every((a,i)=>!i||a._year<=sorted[i-1]._year));
  }
  assert.deepEqual(albums.map(a=>a.id),original);
});

test('multidisc headings and track sequence remain intact, including Journey',()=>{
  const revelation=albums.find(a=>a.artist==='Journey' && a.album_title==='Revelation');
  const time=albums.find(a=>a.artist==='Journey' && a.album_title==='Time 3');
  const tracks=parseTracks(revelation.track_listing);
  assert.equal(tracks.filter(t=>t.type==='heading').length,2);assert.equal(tracks.filter(t=>t.type==='track').length,22);
  assert.deepEqual(tracks.filter(t=>t.type==='heading').map(t=>t.text),['Disc 1','Disc 2']);
  assert.equal(tracks[1].title,'Never Walk Away');assert.equal(tracks[13].title,'Only the Young');
  assert.equal(parseTracks(time.track_listing).filter(t=>t.type==='heading').length,3);
  assert.equal(parseTracks(null).length,0);
  const compact=parseTracks(albums.find(a=>a.id==='0008').track_listing);
  assert.equal(compact.filter(t=>t.type==='track').length,13);
  assert.deepEqual(compact.filter(t=>t.type==='heading').map(t=>t.text),['Side A','Side B']);
  assert.equal(compact[1].title,'Those Were The Days - Theme');assert.equal(compact[1].time,'1:27');
  for(const a of albums){const rows=String(a.track_listing??'').replace(/\\n/g,'\n').split(/\r?\n/).filter(x=>x.trim()).length;assert.ok(parseTracks(a.track_listing).length>=rows,a.id);}
});

test('only actual Spotify album URLs become listening buttons',()=>{
  for(const a of albums){const url=spotifyUrl(a);if(url)assert.match(url,/^https:\/\/open.spotify.com\/(?:intl-[a-z-]+\/)?album\/[a-zA-Z0-9]{22}/);}
  for(const url of ['javascript:alert(1)','https://open.spotify.com/search/anything','https://evil.com/album/abcdefghijklmnopqrstuv','https://open.spotify.com/album/guess'])assert.equal(spotifyUrl({spotify_url:url}),null);
});

test('seeded selections are reproducible, varied, and have no duplicate albums or artists',()=>{
  const picks=seededPicks(groups,'2026-10-21',8);
  assert.deepEqual(picks,seededPicks(groups,'2026-10-21',8));assert.equal(picks.length,8);
  assert.equal(new Set(picks.map(a=>a._artistKey)).size,8);
  assert.ok(new Set(picks.flatMap(a=>a.genres)).size>=3);
  assert.notDeepEqual(picks.map(a=>a.id),seededPicks(groups,'2026-10-22',8).map(a=>a.id));
});

test('cover host configuration supports later hosting without rewriting album records',()=>{
  assert.equal(coverPath('covers/album-0001-front.webp','https://images.example.com/music'),'https://images.example.com/music/covers/album-0001-front.webp');
  assert.equal(coverPath('../private.png'),null);assert.equal(coverPath('covers/album-0001-front.webp','javascript:bad'),null);
});

test('shelf selections exclude comedy, spoken word, Jodeci, and CD/cassette singles without excluding compilations or short albums',()=>{
  const eligible=albums.filter(shelfEligible);
  for(const id of ['0391','0486','0658','0702','0704','0720','0939','0942','0950','0957','0975','0978','0999','1012']) assert.equal(eligible.some(a=>a.id===id),false,id);
  for(const id of ['0335','0364','0565','0710','0732','0802']) assert.ok(eligible.some(a=>a.id===id),id);
  assert.ok(eligible.every(a=>a._artistKey!=='jodeci' && !a.genres.some(g=>g==='Comedy'||g==='Spoken Word')));
  const shelf=groupAlbums(eligible);
  for(let seed=0;seed<30;seed++) assert.ok(seededPicks(shelf,seed,8).every(shelfEligible));
});

test('personal history covers all six decades and retains the approved purchase date and playlist links',()=>{
  assert.deepEqual(Object.keys(DECADE_STORIES),['1960','1970','1980','1990','2000','2010']);
  assert.match(DECADE_STORIES[2000].paragraphs.join(' '),/in 2006, when I bought Tommy Emmanuel’s Only/);
  assert.equal(CONTINUING_STORY.length,2);assert.equal(PLAYLISTS.length,5);
  for(const p of PLAYLISTS)assert.match(p.id,/^[a-zA-Z0-9]{22}$/);
});

test('inline writers match exact song titles and handle multiple discs and repeated titles conservatively',()=>{
  const revelation=albums.find(a=>a.id==='0591');
  assert.equal(trackWriters(revelation).get(fold('Never Walk Away')),'Schon / Cain / Hunsicker');
  assert.equal(trackWriters(revelation).get(fold('Faithfully')),'Cain');
  assert.equal(trackWriters(albums.find(a=>a.id==='0335')).get('love me do'),'Lennon / McCartney');
  const credits=trackWriters({songwriter_credits:'1. Same Song — Alice Smith\nDisc 2\n1. Same Song — Bob Jones\n2. Different Song — Donnie Van Zant; Kenny G\n3. Unknown — writer unverified\n4. Inverted — McCartney, Paul\nAll other songs by Alice Smith'});
  assert.equal(credits.has('same song'),false);
  assert.equal(credits.get('different song'),'Van Zant / Kenny G');
  assert.equal(credits.has('unknown'),false);assert.equal(credits.has('inverted'),false);
  assert.equal(credits.has('all other songs'),false);
  assert.deepEqual(parseTracks('Side A 1. Photograph')[0],{type:'track',number:1,title:'Photograph',time:'',section:'Side A',raw:'1. Photograph'});
});

test('collection and decade browsing combine editions except when grouped or sorted by format',()=>{
  const regular=browseAlbums(albums);
  assert.equal(regular.combined,true);assert.equal(regular.list.length,groups.length);
  assert.equal(regular.list.filter(a=>a.artist==='Montrose'&&a.album_title==='Montrose').length,1);
  for(const options of [{sort:'format'},{sort:'format-desc'},{groupByFormat:true}]){
    const result=browseAlbums(albums,{},options);assert.equal(result.combined,false);assert.equal(result.list.length,albums.length);
  }
  const seventies=browseAlbums(albums,{decade:'1970'});
  assert.ok(seventies.list.every(a=>a._year>=1970&&a._year<1980));
  assert.deepEqual(seventies.list.flatMap(a=>a.editions.map(e=>e.id)).sort(),seventies.raw.map(a=>a.id).sort());
  const vinyl=browseAlbums(albums,{format:'Vinyl'});
  assert.ok(vinyl.list.every(a=>a.editions.every(e=>e.owned_format==='Vinyl')));
  const three=indexAlbums(['CD','Vinyl','Cassette'].map((f,i)=>({id:String(i),artist:'Example',album_title:'Album',release_year:1990,owned_format:f})));
  assert.equal(browseAlbums(three).list[0].editions.length,3);
});

const report={entries:albums.length,uniqueAlbums:groups.length,artists:artists.length,multipleFormatGroups:groups.filter(g=>g.formats.length>1).length,missingTracks:albums.filter(a=>!a.track_listing).map(a=>({id:a.id,artist:a.artist,title:a.album_title})),missingYears:albums.filter(a=>!a._year).map(a=>a.id),missingSpotify:albums.filter(a=>!spotifyUrl(a)).length,longestTitles:[...albums].sort((a,b)=>b.album_title.length-a.album_title.length).slice(0,5).map(a=>({id:a.id,title:a.album_title})),multidisc:albums.filter(a=>parseTracks(a.track_listing).filter(t=>t.type==='heading'&&/disc|disk|cd/i.test(t.text)).length>1).map(a=>({id:a.id,artist:a.artist,title:a.album_title})),encodingIssues:albums.filter(a=>[a.album_title,a.track_listing,a.personnel,a.anecdotes].some(value=>String(value || '').includes('\ufffd'))).map(a=>a.id)};
await mkdir(path.join(root,'reports'),{recursive:true});
await writeFile(path.join(root,'reports/catalog-audit.json'),JSON.stringify(report,null,2));
console.log('Catalog audit:',JSON.stringify({...report,missingTracks:report.missingTracks.length,longestTitles:report.longestTitles.length,multidisc:report.multidisc.length,encodingIssues:report.encodingIssues.length}));
