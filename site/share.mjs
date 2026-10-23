import {parseTracks,spotifyUrl,coverPath} from './catalog.mjs';

const SITE='https://dolenzz.github.io/mymusic/';
export const albumShareUrl=a=>`${SITE}share/${encodeURIComponent(a.id)}.html`;
export function albumPostText(a) {
  return `One from my shelves: ${a.artist} — ${a.album_title}${a._year?` (${a._year})`:''}.\n\nView album: ${albumShareUrl(a)}${spotifyUrl(a)?`\nListen on Spotify: ${spotifyUrl(a)}`:''}`;
}
export function shareTrackPages(a) {
  let section='';
  const tracks=parseTracks(a.track_listing).flatMap(t=>{
    if(t.type==='heading'){section=t.text;return [];}
    return [{...t,section:t.section || section}];
  });
  return Array.from({length:Math.max(1,Math.ceil(tracks.length/24))},(_,i)=>tracks.slice(i*24,i*24+24));
}

// Draw the real catalog and artwork directly: no screenshot service or AI.
export async function albumCard(a,page=0) {
  const image=new Image();
  image.crossOrigin='anonymous';
  const src=coverPath(a.cover?.full,window.MUSIC_CONFIG?.coverBaseUrl || '');
  if(src) {image.src=src;await image.decode();}
  const canvas=document.createElement('canvas');
  canvas.width=1200;canvas.height=1600;
  let c=canvas.getContext('2d');
  const commands=[];
  function text(value,x,y,width,size=24,color='#f1eadc',family='Georgia',line=1.4) {
    c.font=`${size}px ${family}`;
    const words=String(value || '').split(/\s+/);let current='',lines=[];
    for(const word of words) {
      if(c.measureText((current?current+' ':'')+word).width>width && current){lines.push(current);current=word;}
      else current+=(current?' ':'')+word;
    }
    if(current)lines.push(current);
    lines.forEach((s,i)=>commands.push(()=>{c.font=`${size}px ${family}`;c.fillStyle=color;c.fillText(s,x,y+i*size*line);}));
    return y+lines.length*size*line;
  }
  const rule=y=>commands.push(()=>{c.strokeStyle='#55564e';c.lineWidth=1;c.beginPath();c.moveTo(56,y);c.lineTo(1144,y);c.stroke();});
  text('Tom’s Music Library',56,73,1088,32,'#c18b59');
  if(src)commands.push(()=>{const scale=Math.min(320/image.width,320/image.height);const w=image.width*scale,h=image.height*scale;c.drawImage(image,56+(320-w)/2,119+(320-h)/2,w,h);});
  let y=text(a.artist,420,157,720,30,'#c18b59');
  y=text(a.album_title,420,y+15,720,48);
  y=text([a._year,a.owned_format].filter(Boolean).join(' · '),420,y+15,720,24,'#c1bcae','Arial');
  y=text([...(a.genres || []),...(a.styles || [])].join(' · '),420,y+10,720,21,'#c1bcae','Arial');
  y=Math.max(475,y+32);rule(y);
  if(a.anecdotes) {y=text('Behind the album',56,y+48,1088,28,'#c18b59');y=text(a.anecdotes,56,y+16,1088,24,'#f1eadc','Georgia',1.45)+28;rule(y);}
  y=text('Track listing',56,y+48,1088,28,'#c18b59')+18;
  const pages=shareTrackPages(a),tracks=pages[page] || pages[0],half=Math.ceil(tracks.length/2);
  let bottoms=[y,y];
  tracks.forEach((track,i)=>{
    const column=i<half?0:1,x=column?625:56;
    const number=track.section?`${track.section} · ${track.number}`:String(track.number);
    bottoms[column]=text(`${number}   ${track.title}`,x,bottoms[column],515,24,'#f1eadc','Georgia',1.35)+12;
  });
  if(!tracks.length)bottoms[0]=text('Explore this album in the collection.',56,y,1088,24);
  y=Math.max(...bottoms)+20;rule(y);
  text(`From Tom’s Music Library${pages.length>1?` · Tracks ${page+1} of ${pages.length}`:''}`,56,y+44,1088,23,'#c18b59');
  text('dolenzz.github.io/mymusic',56,y+80,1088,20,'#c1bcae','Arial');
  canvas.height=Math.ceil(y+118);c=canvas.getContext('2d');
  c.fillStyle='#202221';c.fillRect(0,0,canvas.width,canvas.height);
  for(const draw of commands)draw();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('Image creation failed');
  return {canvas,blob};
}

export function openAlbumShare(a,trigger) {
  const dialog=document.createElement('dialog');dialog.className='album-share';
  const heading=document.createElement('h2');heading.id='album-share-title';heading.textContent='Share this album';
  dialog.setAttribute('aria-labelledby',heading.id);
  const close=document.createElement('button');close.className='icon-button share-close';close.textContent='×';close.setAttribute('aria-label','Close sharing');
  const preview=document.createElement('div');preview.className='share-preview';preview.setAttribute('aria-label','Album image preview');
  const pager=document.createElement('div');pager.className='share-pager';
  const previous=button('← Previous',()=>render(page-1)),next=button('Next →',()=>render(page+1)),count=document.createElement('span');
  pager.append(previous,count,next);
  const caption=document.createElement('label');caption.className='share-caption';caption.textContent='Post text (you can edit this)';
  const input=document.createElement('textarea');input.value=albumPostText(a);input.rows=5;input.setAttribute('aria-label','Post text');caption.append(input);
  const actions=document.createElement('div');actions.className='share-actions';
  const status=document.createElement('p');status.className='share-status';status.setAttribute('role','status');
  let page=0,card=null,renderVersion=0;
  const pages=shareTrackPages(a);
  function button(label,action){const b=document.createElement('button');b.className='button';b.textContent=label;b.onclick=action;return b;}
  async function copy(value,message){try{await navigator.clipboard.writeText(value);status.textContent=message;}catch{input.focus();input.select();status.textContent='Select and copy the post text above.';}}
  const native=button('Share…',async()=>{
    if(!card)return;
    const file=new File([card.blob],`album-${a.id}-${page+1}.png`,{type:'image/png'});
    const data=navigator.canShare?.({files:[file]})?{files:[file],text:input.value}:{text:input.value};
    try{await navigator.share(data);status.textContent='Returned from sharing. Your chosen app controls what is included.';}
    catch(error){if(error.name!=='AbortError')status.textContent='Use Save image and Copy post text to share in your chosen app.';}
  });
  const save=button('Save image',()=>{
    if(!card)return;const url=URL.createObjectURL(card.blob),link=document.createElement('a');
    link.href=url;link.download=`album-${a.id}-share${pages.length>1?`-${page+1}`:''}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    status.textContent=pages.length>1?'Image saved. Use Next to save the remaining track panels.':'Image saved. Copy the post text to include clickable links.';
  });
  native.hidden=typeof navigator.share!=='function';
  actions.append(native,button('Copy post text',()=>copy(input.value,'Post text copied, including available links.')),save,button('Copy album link',()=>copy(albumShareUrl(a),'Album link copied.')));
  const note=document.createElement('p');note.className='share-help';note.textContent='Links in the post text are clickable. The image is a picture; sharing apps may not include both automatically.';
  dialog.append(heading,close,preview,pager,caption,actions,note,status);document.body.append(dialog);
  const dismiss=()=>dialog.close();close.onclick=dismiss;
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dismiss();}});
  window.addEventListener('hashchange',dismiss);
  dialog.addEventListener('close',()=>{window.removeEventListener('hashchange',dismiss);dialog.remove();if(trigger?.isConnected)trigger.focus();},{once:true});
  async function render(index){
    page=Math.max(0,Math.min(pages.length-1,index));const version=++renderVersion;
    card=null;native.disabled=save.disabled=true;preview.textContent='Preparing image…';
    pager.hidden=pages.length<2;previous.disabled=page===0;next.disabled=page===pages.length-1;count.textContent=`Track panel ${page+1} of ${pages.length}`;
    try{const result=await albumCard(a,page);if(version!==renderVersion||!dialog.isConnected)return;card=result;preview.replaceChildren(result.canvas);result.canvas.setAttribute('role','img');result.canvas.setAttribute('aria-label',`${a.artist} — ${a.album_title}, share image ${page+1}`);native.disabled=save.disabled=false;}
    catch{preview.textContent='Image preview unavailable. You can still copy the album link and post text.';status.textContent='The album page is unchanged.';}
  }
  dialog.showModal();render(0);
}
