"""Read-only comparison of every local web cover with its hosted counterpart."""
import argparse
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from PIL import Image

parser=argparse.ArgumentParser()
parser.add_argument('base_url',help='Public HTTPS base URL containing the covers/ folder')
args=parser.parse_args()
base=args.base_url.rstrip('/')
parsed=urlsplit(base)
if parsed.scheme!='https' or not parsed.netloc or parsed.query or parsed.fragment:
    parser.error('Provide an HTTPS base URL without a query or fragment')
root=Path(__file__).resolve().parents[1]
files=sorted((root/'site/covers').glob('*.webp'))

def verify(file):
    url=base+'/covers/'+file.name
    try:
        with urlopen(Request(url,headers={'User-Agent':'TomsMusicLibrary-CoverVerification/1.0'}),timeout=30) as response:
            content_type=response.headers.get('Content-Type','').split(';')[0].lower()
            data=response.read()
        if content_type!='image/webp':
            raise ValueError('Unexpected content type: '+content_type)
        if hashlib.sha256(data).digest()!=hashlib.sha256(file.read_bytes()).digest():
            raise ValueError('Downloaded file differs from optimized local file')
        with Image.open(BytesIO(data)) as image:
            if image.format!='WEBP': raise ValueError('Image is not WebP')
            image.verify()
        return {'file':file.name,'ok':True,'bytes':len(data)}
    except Exception as error:
        return {'file':file.name,'ok':False,'error':str(error)}

with ThreadPoolExecutor(max_workers=6) as pool:
    results=[]
    for index,result in enumerate(pool.map(verify,files),1):
        results.append(result)
        if index%200==0: print(f'Checked {index}/{len(files)}',flush=True)
report={'base_url':base,'expected':len(files),'passed':sum(r['ok'] for r in results),'failed':[r for r in results if not r['ok']]}
(root/'reports').mkdir(exist_ok=True)
(root/'reports/hosted-cover-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({**report,'failed_count':len(report['failed']),'failed':report['failed'][:5]},indent=2))
raise SystemExit(0 if report['passed']==report['expected'] else 1)
