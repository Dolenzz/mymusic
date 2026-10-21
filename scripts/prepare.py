"""Build a public catalog and web artwork without modifying the master or original covers."""
import argparse
import hashlib
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageOps

BASE = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--master', type=Path, default=BASE.parent / 'Master Collection/music_collection_master.json')
parser.add_argument('--covers', type=Path, default=Path(r'D:\tmadd\Downloads\covers'))
args = parser.parse_args()
master = json.loads(args.master.read_text(encoding='utf-8'))
public_fields = ['id','artist','artist_sort','artist_original','artist_search_aliases','album_title','release_year','owned_format','release_details','track_listing','songwriter_credits','personnel','guest_artists','production_credits','album_chart','singles_chart','anecdotes','spotify_url','matched_release','genres','styles']
out = BASE / 'site'
(out / 'covers').mkdir(parents=True,exist_ok=True)
(BASE / 'reports').mkdir(exist_ok=True)

def prepare(album):
    record = {k:album.get(k) for k in public_fields}
    cover = album.get('front_cover') or {}
    relative = cover.get('path')
    result = {'id':album['id'],'errors':[],'source_bytes':0,'web_bytes':0,'thumbnail_bytes':0}
    record['cover'] = None
    if relative:
        source = (args.covers / Path(relative).name).resolve()
        if source.parent != args.covers.resolve():
            raise ValueError('Cover outside selected source folder')
        try:
            source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
            result['source_bytes'] = source.stat().st_size
            with Image.open(source) as original:
                oriented = ImageOps.exif_transpose(original)
                if oriented.mode in ('RGBA','LA') or 'transparency' in oriented.info:
                    rgba=oriented.convert('RGBA')
                    rgb=Image.new('RGB',rgba.size,(32,34,33)); rgb.paste(rgba,mask=rgba.getchannel('A'))
                else: rgb=oriented.convert('RGB')
                for name,size,quality in [('front',720,84),('thumb',360,81)]:
                    file=out / 'covers' / f"album-{album['id']}-{name}.webp"
                    stamp=BASE / 'reports' / f"{album['id']}-{name}.stamp"
                    fingerprint=f'{source_hash}:{size}:{quality}:v1'
                    if not file.exists() or not stamp.exists() or stamp.read_text() != fingerprint:
                        im=rgb.copy(); im.thumbnail((size,size),Image.Resampling.LANCZOS)
                        temp=file.with_suffix('.tmp'); im.save(temp,'WEBP',quality=quality,method=4); temp.replace(file)
                        stamp.write_text(fingerprint)
                    result['web_bytes' if name=='front' else 'thumbnail_bytes']=file.stat().st_size
                record['cover']={'full':f"covers/album-{album['id']}-front.webp",'thumb':f"covers/album-{album['id']}-thumb.webp",'width':rgb.width,'height':rgb.height}
            # Detect a changed input, including changes by another program during conversion.
            if hashlib.sha256(source.read_bytes()).hexdigest() != source_hash:
                raise ValueError('Source changed during conversion; rerun preparation')
        except Exception as exc:
            record['cover']=None
            result['errors'].append(str(exc))
    else: result['errors'].append('No cover mapping')
    return record,result

with ThreadPoolExecutor(max_workers=4) as pool:
    prepared=list(pool.map(prepare,master['albums']))
albums=[r for r,_ in prepared]
report={'records':len(albums),'source_bytes':sum(x['source_bytes'] for _,x in prepared),'web_bytes':sum(x['web_bytes'] for _,x in prepared),'thumbnail_bytes':sum(x['thumbnail_bytes'] for _,x in prepared),'cover_issues':[x for _,x in prepared if x['errors']]}
payload={'schema_version':1,'title':"Tom’s Music Library",'source_exported_at':master.get('exported_at'),'albums':albums}
temp=out / 'catalog.tmp'; temp.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8');temp.replace(out / 'catalog.json')
(BASE / 'reports/preparation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
