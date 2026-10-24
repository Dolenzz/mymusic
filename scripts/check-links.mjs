import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {spotifyUrl} from '../site/catalog.mjs';
const root=new URL('../site/',import.meta.url);
const {albums}=JSON.parse(await readFile(new URL('catalog.json',root),'utf8'));
const external=process.argv.includes('--external');
const report={checkedAt:new Date().toISOString(),external,localChecked:0,broken:[],unverified:[],reachable:0};
const targets=new Map();
for(const a of albums){
  for(const path of [a.cover?.full,a.cover?.thumb,`share/${a.id}.html`]){
    report.localChecked++;
    try{if(!path || !(await stat(new URL(path,root))).isFile())throw Error();}
    catch{report.broken.push({album:a.id,path,reason:'Missing local file'});}
  }
  if(a.spotify_url&&!spotifyUrl(a))report.unverified.push({album:a.id,url:a.spotify_url,reason:'Existing nonstandard Spotify link; excluded by the site’s album-only link validation'});
  const url=spotifyUrl(a);if(url)targets.set(url,[...(targets.get(url)||[]),a.id]);
}
// External services may block automated checks. A 403, 429, login page, or
// timeout is inconclusive, never evidence that a Spotify album is missing.
if(external){
  const queue=[...targets];
  let rateLimited=false;
  async function worker(){
    while(queue.length){
      const [url,ids]=queue.shift();
      if(rateLimited){report.unverified.push({url,albums:ids,reason:'Skipped after service rate limit'});continue;}
      try{
        const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(15000),redirect:'follow'});
        if(r.status===429)rateLimited=true;
        if(r.status===404||r.status===410)report.broken.push({url,albums:ids,status:r.status,reason:'HTTP missing; review before changing data'});
        else if(!r.ok || !r.url.startsWith('https://open.spotify.com/album/'))report.unverified.push({url,albums:ids,status:r.status,reason:'Blocked, redirected, or unavailable to checker'});
        else report.reachable++;
      }catch(error){report.unverified.push({url,albums:ids,reason:error.name});}
      await new Promise(resolve=>setTimeout(resolve,400));
    }
  }
  await Promise.all([worker(),worker()]);
}
const output=new URL('../reports/link-check.json',import.meta.url);
await mkdir(new URL('../reports/',import.meta.url),{recursive:true});await writeFile(output,JSON.stringify(report,null,2));
console.log(`Local paths: ${report.localChecked}; reachable external URLs: ${report.reachable}; needs review: ${report.broken.length}; inconclusive: ${report.unverified.length}.`);
if(report.broken.length)process.exitCode=1;
