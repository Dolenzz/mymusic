import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {albumPostText,albumShareUrl,shareTrackPages} from '../site/share.mjs';
import {indexAlbums,parseTracks,spotifyUrl} from '../site/catalog.mjs';
const {albums:raw}=JSON.parse(await readFile(new URL('../site/catalog.json',import.meta.url),'utf8'));
const albums=indexAlbums(raw);
test('all shared track panels preserve every original track and discard credits',()=>{
 for(const a of albums){
  const panels=shareTrackPages(a);
  assert.ok(panels.length>=1);
  assert.ok(panels.every(p=>p.length<=24));
  assert.deepEqual(panels.flat().map(t=>t.title),parseTracks(a.track_listing).filter(t=>t.type==='track').map(t=>t.title),a.id);
  const post=albumPostText(a);assert.ok(post.includes(albumShareUrl(a)));
  assert.equal(post.includes('Listen on Spotify:'),!!spotifyUrl(a));
  if(spotifyUrl(a))assert.ok(post.includes(spotifyUrl(a)));
 }
});
test('disc headings carry through shared panels',()=>{
 const pages=shareTrackPages({track_listing:'Disc 1\n1. First\nDisc 2\n1. Second'});
 assert.deepEqual(pages[0].map(t=>t.section),['Disc 1','Disc 2']);
});
test('every share landing page has exact metadata and a working album destination',async()=>{
 for(const a of albums){
  const html=await readFile(new URL(`../site/share/${a.id}.html`,import.meta.url),'utf8');
  assert.ok(html.includes(`content="${albumShareUrl(a)}"`),a.id);
  assert.ok(html.includes(`https://dolenzz.github.io/mymusic/#/album/${a.id}`),a.id);
  assert.ok(html.includes(`https://dolenzz.github.io/mymusic/${a.cover.full}`),a.id);
  assert.ok(html.includes('og:title'));
 }
});
