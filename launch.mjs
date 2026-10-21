import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout} from 'node:timers/promises';
const directory=fileURLToPath(new URL('.',import.meta.url));
const url='http://127.0.0.1:4180';
async function ready(){try{const response=await fetch(url,{signal:AbortSignal.timeout(700)});return response.ok&&(await response.text()).includes('<title>Tom’s Music Library</title>');}catch{return false;}}
if(!await ready()){
  const child=spawn(process.execPath,[fileURLToPath(new URL('server.mjs',import.meta.url))],{cwd:directory,detached:true,stdio:'ignore',windowsHide:true});
  child.unref();
  for(let attempt=0;attempt<40&&!await ready();attempt++)await setTimeout(250);
}
if(!await ready()){console.error('The library could not start. Another program may be using port 4180.');process.exitCode=1;}
else {
  console.log(`Opening Tom’s Music Library: ${url}`);
  if(process.platform==='win32')spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{detached:true,stdio:'ignore',windowsHide:true}).unref();
}
