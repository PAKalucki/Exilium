import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const suffix = randomUUID().slice(0, 8),
  container = `exilium-smoke-${suffix}`,
  volume = `exilium-smoke-${suffix}`;
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const node = (script) =>
  docker(
    'exec',
    container,
    'node',
    '--input-type=module',
    '-e',
    `
  const {request:httpRequest}=await import('node:http');
  // Node fetch strips caller-supplied Host. Exercise real HTTP with the public
  // Host preserved, exactly as the browser/reverse proxy proxy sends it.
  globalThis.fetch=(input,init={})=>new Promise((resolve,reject)=>{
    const headers=new Headers(init.headers);if(!headers.has('Host'))headers.set('Host','exilium.test');
    const req=httpRequest(input,{method:init.method||'GET',headers:Object.fromEntries(headers)},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',reject);
      res.on('end',()=>{const h=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)h.append(res.rawHeaders[i],res.rawHeaders[i+1]);resolve(new Response([204,205,304].includes(res.statusCode)?null:Buffer.concat(chunks),{status:res.statusCode,headers:h}))});
    });req.on('error',reject);req.end(init.body);
  });
  ${script}
`,
  );
const assert = (value, message) => {
  if (!value) throw new Error(message);
};
try {
  docker('volume', 'create', volume);
  docker(
    'run',
    '-d',
    '--name',
    container,
    '--network',
    'none',
    '--read-only',
    '--tmpfs',
    '/tmp',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '--memory',
    '512m',
    '--mount',
    `source=${volume},target=/data`,
    '-e',
    'APP_ORIGIN=https://exilium.test',
    '-e',
    'APP_ADDITIONAL_ORIGINS=http://192.0.2.10:5173',
    '-e',
    'DEV_LOGIN_ENABLED=true',
    '-e',
    'DISCORD_GUILD_ID=200000000000000001',
    '-e',
    'DISCORD_CLIENT_ID=smoke-client',
    '-e',
    'DISCORD_CLIENT_SECRET=smoke-only-placeholder',
    process.argv[2] || 'exilium:0.2.1',
  );
  const health = () =>
    node(
      "const r=await fetch('http://127.0.0.1:3000/api/health'); if(!r.ok)process.exit(1); console.log(await r.text())",
    );
  let ready = false;
  for (let i = 0; i < 25; i++) {
    try {
      health();
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  assert(ready, 'Container did not become healthy');
  const expectedRelease = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ).version;
  assert(
    JSON.parse(health()).version === expectedRelease,
    'Health version differs from package version',
  );
  node(`
    const r=await fetch('http://127.0.0.1:3000/auth/discord?probe=1',{headers:{'CF-Visitor':JSON.stringify({scheme:'http'})}});
    if(r.status!==308 || r.headers.get('location')!=='https://exilium.test/auth/discord?probe=1')throw Error('Cloudflare HTTP redirect failed');
  `);
  const version = node(
    "import {DatabaseSync} from 'node:sqlite';const d=new DatabaseSync('/data/exilium.sqlite');console.log(d.prepare('select sqlite_version() v').get().v);d.prepare('INSERT INTO users(id,discord_id,name,role) VALUES(?,?,?,?)').run('smoke-user','100000000000000001','Test','gm');d.close();",
  );
  assert(
    Number(version.split('.')[0]) === 3 && Number(version.split('.')[1]) >= 52,
    'Use a patched SQLite runtime',
  );
  const devStatus = node(
    "const r=await fetch('http://127.0.0.1:3000/auth/dev',{method:'POST',headers:{Origin:'https://exilium.test','Content-Type':'application/json'},body:'{}'});console.log(r.status)",
  );
  assert(devStatus === '404', 'Production build exposed development authentication');
  const html = node("console.log(await (await fetch('http://127.0.0.1:3000/')).text())");
  assert(!html.includes('Wejdź do lokalnego podglądu'), 'Development login appeared in production');
  node(`
    for(const [host,origin,secure] of [['exilium.test','https://exilium.test',true],['192.0.2.10:5173','http://192.0.2.10:5173',false]]){
      const r=await fetch('http://127.0.0.1:3000/auth/discord',{redirect:'manual',headers:{Host:host,'X-Forwarded-Proto':secure?'http':'https','X-Forwarded-Host':'evil.test','X-Exilium-Protocol':secure?'http':'https'}});
      if(r.status!==302)throw Error('OAuth start unavailable: '+origin+' '+r.status);
      const target=new URL(r.headers.get('location'));
      if(target.searchParams.get('redirect_uri')!==origin+'/auth/discord/callback')throw Error('Wrong OAuth origin');
      const cookies=r.headers.getSetCookie();
      if(cookies.length!==2||cookies.some(c=>/; Secure(?:;|$)/i.test(c)!==secure))throw Error('Wrong cookie transport policy');
    }
    const bad=await fetch('http://127.0.0.1:3000/',{headers:{Host:'evil.test','X-Forwarded-Host':'exilium.test'}});
    if(bad.status!==421)throw Error('Unconfigured Host accepted');
  `);
  const unauthorized = node(
    "console.log((await fetch('http://127.0.0.1:3000/api/characters/test/pdf')).status)",
  );
  assert(unauthorized === '401', 'PDF endpoint did not require authentication');
  node(`
    import {DatabaseSync} from 'node:sqlite';
    import {createHash} from 'node:crypto';
    const d=new DatabaseSync('/data/exilium.sqlite');
    const cases=[['smoke-valid','200000000000000001',201],['smoke-old','',401],['smoke-other','200000000000000002',401]];
    for(const [token,guildId] of cases)d.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at,guild_id) VALUES(?,?,?,?)').run(createHash('sha256').update(token).digest('hex'),'smoke-user',Date.now()+60000,guildId);
    d.close();
    for(const [token,,expected] of cases){
      const r=await fetch('http://127.0.0.1:3000/api/characters',{method:'POST',headers:{Origin:'https://exilium.test','Content-Type':'application/json',Cookie:'exilium_session='+token},body:JSON.stringify({name:'Membership smoke'})});
      if(r.status!==expected)throw Error('Guild-bound session check failed: '+token+' '+r.status);
    }
    const headers={Host:'192.0.2.10:5173',Origin:'http://192.0.2.10:5173','Content-Type':'application/json',Cookie:'exilium_session=smoke-valid'};
    const good=await fetch('http://127.0.0.1:3000/api/characters',{method:'POST',headers,body:JSON.stringify({name:'LAN smoke'})});
    if(good.status!==201)throw Error('LAN mutation rejected: '+good.status);
    const cross=await fetch('http://127.0.0.1:3000/api/characters',{method:'POST',headers:{...headers,Origin:'https://exilium.test'},body:JSON.stringify({name:'Cross-origin'})});
    if(cross.status!==403)throw Error('Cross-origin mutation accepted');
    const logout=await fetch('http://127.0.0.1:3000/auth/logout',{method:'POST',redirect:'manual',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:''});
    if(logout.status!==303)throw Error('LAN form logout rejected: '+logout.status);
  `);
  assert(
    node(
      "console.log((await fetch('http://127.0.0.1:3000/api/characters/test/portrait')).status)",
    ) === '401',
    'Portrait endpoint did not require authentication',
  );
  node(`
    import {DatabaseSync} from 'node:sqlite';import {createHash,randomUUID} from 'node:crypto';
    const db=new DatabaseSync('/data/exilium.sqlite');
    db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at,guild_id) VALUES(?,?,?,?)').run(createHash('sha256').update('catalog-smoke').digest('hex'),'smoke-user',Date.now()+300000,'200000000000000001');db.close();
    const root='http://127.0.0.1:3000/api/compendium';
    if((await fetch(root)).status!==401)throw Error('Anonymous compendium access allowed');
    const headers={Origin:'https://exilium.test','Content-Type':'application/json',Cookie:'exilium_session=catalog-smoke'};
    const minted=await fetch('http://127.0.0.1:3000/api/tokens',{method:'POST',headers,body:JSON.stringify({name:'production-smoke',scopes:['read','compendium:write'],days:1})});
    if(minted.status!==201)throw Error('Production token creation failed');
    const token=await minted.json(),apiHeaders={Authorization:'Bearer '+token.token,'Content-Type':'application/json'};
    if((await fetch('http://127.0.0.1:3000/api/diagnostics',{headers:apiHeaders})).status!==200)throw Error('Production token read failed');
    const specResponse=await fetch('http://127.0.0.1:3000/api/openapi.json',{headers:apiHeaders});
    if(specResponse.status!==200 || (await specResponse.json()).openapi!=='3.1.0')throw Error('Production OpenAPI unavailable');
    const docs=await fetch('http://127.0.0.1:3000/api-docs/ui',{headers});
    if(docs.status!==200 || docs.headers.get('x-frame-options')!=='SAMEORIGIN')throw Error('Swagger frame unavailable');
    const markup=await docs.text();
    const script=markup.match(/<script src="([^"]+)"/)[1],css=markup.match(/<link rel="stylesheet" href="([^"]+)"/)[1];
    for(const asset of [script,css]){
      if(!asset.startsWith('/_app/'))throw Error('Swagger asset is not self-hosted');
      if(!(await fetch('http://127.0.0.1:3000'+asset)).ok)throw Error('Production Swagger asset unavailable');
    }

    if((await fetch('http://127.0.0.1:3000/api/users',{headers:apiHeaders})).status!==403)throw Error('Token reached user management');
    const entries=await (await fetch(root,{headers})).json();
    if(entries.length!==117)throw Error('Compendium bootstrap incomplete');
    const entry=entries.find(e=>e.document.item.name==='Glock (9mm)');
    const body={revision:entry.revision,commandId:randomUUID(),command:{type:'update',document:{...entry.document,item:{...entry.document.item,price:321}}}};
    const changed=await fetch(root+'/'+entry.id,{method:'POST',headers:apiHeaders,body:JSON.stringify(body)});
    if(changed.status!==200)throw Error('Runtime compendium editing failed');
    const retry=await fetch(root+'/'+entry.id,{method:'POST',headers:apiHeaders,body:JSON.stringify(body)});
    if(retry.status!==200||(await retry.json()).revision!==2)throw Error('Catalog retry was not deduplicated');
    const blocked=await fetch(root+'/'+entry.id,{method:'POST',headers:{...headers,Origin:'https://untrusted.invalid'},body:JSON.stringify(body)});
    if(blocked.status!==403)throw Error('Cross-origin catalog write accepted');
    if((await fetch('http://127.0.0.1:3000/api/tokens/'+token.id,{method:'DELETE',headers})).status!==200)throw Error('Production token revoke failed');
    if((await fetch(root,{headers:apiHeaders})).status!==401)throw Error('Revoked production token accepted');
  `);
  node(
    "import {PNG} from 'pngjs';import jpeg from 'jpeg-js';import {imageSize} from 'image-size';const p=new PNG({width:2,height:3});p.data.fill(255);const decoded=PNG.sync.read(PNG.sync.write(p));const encoded=jpeg.encode(decoded,82).data;if(imageSize(encoded).height!==3||jpeg.decode(encoded).width!==2)throw Error('Portrait codecs unavailable')",
  );
  node(`
    import {readdir} from 'node:fs/promises';import {imageSize} from 'image-size';
    const files=await readdir('build/client/_app/immutable/assets');
    for(const [name,width,limit] of [['exilium-hero-1536',1536,500000],['exilium-hero-768',768,160000],['portrait-default',320,60000]]){
      const file=files.find(f=>f.startsWith(name+'.')&&f.endsWith('.webp'));
      if(!file)throw Error('Missing optimized artwork: '+name);
      const url='http://127.0.0.1:3000/_app/immutable/assets/'+file;
      const response=await fetch(url,{headers:{Cookie:'exilium_session=smoke-valid'}});
      const bytes=new Uint8Array(await response.arrayBuffer());const dimensions=imageSize(bytes);
      if(!response.ok||dimensions.type!=='webp'||dimensions.width!==width||bytes.length>limit)throw Error('Artwork delivery budget or format failed: '+name);
      if(!response.headers.get('cache-control')?.includes('immutable'))throw Error('Artwork lacks immutable caching');
      const cached=await fetch(url,{headers:{'If-None-Match':response.headers.get('etag')}});
      if(cached.status!==304||(await cached.arrayBuffer()).byteLength!==0)throw Error('Artwork conditional caching failed');
    }
  `);
  node(
    "import {readFile} from 'node:fs/promises';const PDF=(await import('pdfkit')).default;const d=new PDF({size:'A4'});let bytes=0;d.on('data',b=>bytes+=b.length);d.on('end',()=>{if(bytes<1000)process.exit(1);console.log('PDF fonts OK')});d.font(await readFile('static/fonts/DejaVuSans.ttf')).text('Żółć Łucja Gęślą');d.end()",
  );
  docker('exec', container, 'node', 'scripts/backup.mjs', '/data/backups/smoke.sqlite');
  docker('restart', container);
  ready = false;
  for (let i = 0; i < 25; i++) {
    try {
      health();
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  assert(ready, 'Container did not recover after restart');
  node(`
    import {DatabaseSync} from 'node:sqlite';import {restore} from './scripts/restore.mjs';
    const db=new DatabaseSync('/data/exilium.sqlite');
    const item=db.prepare("SELECT document,revision FROM equipment_catalog WHERE name='Glock (9mm)'").get();
    if(JSON.parse(item.document).item.price!==321||item.revision!==2)throw Error('Restart overwrote catalog edits');
    if(db.prepare('SELECT count(*) n FROM equipment_catalog').get().n!==117)throw Error('Restart duplicated catalog seed');db.close();
    restore('/data/backups/smoke.sqlite','/tmp/catalog-restored.sqlite');
    const copy=new DatabaseSync('/tmp/catalog-restored.sqlite');
    if(JSON.parse(copy.prepare("SELECT document FROM equipment_catalog WHERE name='Glock (9mm)'").get().document).item.price!==321)throw Error('Catalog backup/restore failed');copy.close();
  `);
  assert(
    node(
      "import {DatabaseSync} from 'node:sqlite';const d=new DatabaseSync('/data/exilium.sqlite');console.log(d.prepare('SELECT count(*) n FROM users').get().n)",
    ) === '1',
    'Persistent data was lost',
  );
  console.log(
    `Production container passed: SQLite ${version}, nonroot read-only runtime, HTTPS/LAN origins and cookie flags, forwarded-header spoof rejection, same-origin writes/logout, no development login, guild-bound sessions, authenticated PDF/portrait routes, portrait codecs, generated art, Polish fonts, snapshot and restart persistence.`,
  );
} catch (e) {
  console.error(e.message);
  if (e.stderr) console.error(String(e.stderr).slice(-1500));
  try {
    const logs = spawnSync('docker', ['logs', '--tail', '25', container], { encoding: 'utf8' });
    console.error(logs.stdout, logs.stderr);
  } catch {}
  process.exitCode = 1;
} finally {
  try {
    docker('rm', '-f', container);
  } catch {}
  try {
    docker('volume', 'rm', volume);
  } catch {}
}
