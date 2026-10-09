import yaml from 'js-yaml';
import { importPKCS8, SignJWT } from 'jose';
import { db,getSecret,boundedFetch,bucket,audit,uid,now } from './server';
import { REPO,cleanPath,insist,Problem,checkGreen,validateDoc } from './policy.mjs';
import { getDraft } from './documents';
const root=`https://api.github.com/repos/${REPO}`;
async function appToken(owner:string){
  const config=await getSecret(owner,'github-app');if(!config)return null;
  const app=JSON.parse(config.value);
  const key=await importPKCS8(app.pem,'RS256');
  const jwt=await new SignJWT({}).setProtectedHeader({alg:'RS256'}).setIssuer(String(app.id)).setIssuedAt(Math.floor(Date.now()/1000)-60).setExpirationTime('8m').sign(key);
  const headers={'Authorization':`Bearer ${jwt}`,'Accept':'application/vnd.github+json','User-Agent':'DATTA-Studio'};
  const found=await boundedFetch(`${root}/installation`,{headers});insist(found.ok,'Install the DATTA GitHub App on boggioMichael/datta in Connections.',409);
  const install:any=await found.json();
  const response=await boundedFetch(`https://api.github.com/app/installations/${install.id}/access_tokens`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({repositories:['datta'],permissions:{contents:'write',pull_requests:'write',issues:'write',checks:'read',actions:'read'}})});
  insist(response.ok,'GitHub installation access failed.',502);return (await response.json() as any).token as string;
}
export async function gh(owner:string,path:string,init:RequestInit={}){
  insist((path===''||path.startsWith('/'))&&!path.includes('..'),'Invalid GitHub request.');
  const secret=await getSecret(owner,'github');const token=secret?.value||await appToken(owner);
  if(init.method&&init.method!=='GET')insist(token,'Connect the GitHub App or a repository-scoped token in Connections.',409);
  const response=await boundedFetch(root+path,{...init,headers:{'Accept':'application/vnd.github+json','User-Agent':'DATTA-Studio','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',...(token?{'Authorization':`Bearer ${token}`} : {}),...init.headers}});
  if(response.status===404)throw new Problem('GitHub resource not found or access is missing.',404);
  insist(response.ok,response.status===403||response.status===429?'GitHub access or rate limit prevented this operation. Try again later.':`GitHub operation failed (${response.status}).`,502);
  return response.status===204?{}:response.json() as Promise<any>;
}
export const ghWrite=(owner:string,path:string,value:any,method='POST')=>gh(owner,path,{method,body:JSON.stringify(value)});
export async function tree(owner:string){const t=await gh(owner,'/git/trees/main?recursive=1');insist(!t.truncated,'Repository is too large to load in one request.',413);return t.tree as {path:string;sha:string;type:string;size?:number}[];}
export async function readFile(owner:string,path:string){
  cleanPath(path);const f=await gh(owner,`/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=main`);
  insist(f.type==='file'&&f.size<=350000,'Only text files up to 350 KB can be read here.');
  return {text:new TextDecoder().decode(Uint8Array.from(atob(f.content.replace(/\s/g,'')),c=>c.charCodeAt(0))),sha:f.sha};
}
export async function importEntry(owner:string,ref:string){
  insist(/^(writing|research|projects|lab|music|civic)\/[a-z0-9-]+$/.test(ref),'Invalid entry.');
  const paths=await tree(owner);const prefix=`content/${ref}`;const base:Record<string,string>={};
  const read=async(name:string)=>{const p=`${prefix}/${name}`;if(!paths.some(f=>f.path===p)){base[p]='';return ''; }const f=await readFile(owner,p);base[p]=f.sha;return f.text;};
  const [meta,en,he]=await Promise.all([read('meta.yaml'),read('en.md'),read('he.md')]);
  const [collection,slug]=ref.split('/');
  return validateDoc({collection,slug,meta:yaml.load(meta,{schema:yaml.CORE_SCHEMA}),body:{en,he},base});
}
function toBase64(bytes:Uint8Array){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.slice(i,i+8192));return btoa(s);}
export async function preparePublication(owner:string,draftId:string,requestId:string){
  insist(/^[\w-]{8,100}$/.test(requestId),'Invalid operation identifier.');
  const existing=await db().prepare('SELECT * FROM operations WHERE id=? AND owner=?').bind(requestId,owner).first<any>();
  if(existing){insist(existing.state!=='working','Publication is in progress. Check Activity before trying again.',409);return JSON.parse(existing.result);}
  const draft=await getDraft(owner,draftId);const doc=validateDoc(draft.document);
  insist(doc.body.en.trim(),'Add English content before publishing.');
  insist(!doc.body.en.includes('<!-- TODO')&&!doc.body.he.includes('<!-- TODO'),'Resolve unfinished content markers before publishing.');
  await db().prepare('INSERT INTO operations VALUES (?,?,?,?,?)').bind(requestId,owner,'working','{}',now()).run();
  try{
    const ref=await gh(owner,'/git/ref/heads/main');const commit=await gh(owner,`/git/commits/${ref.object.sha}`);const current=await gh(owner,`/git/trees/${commit.tree.sha}?recursive=1`);
    const files=new Map(current.tree.map((f:any)=>[f.path,f.sha]));const prefix=`content/${doc.collection}/${doc.slug}`;
    for(const name of ['meta.yaml','en.md','he.md']){const path=`${prefix}/${name}`;insist((doc.base?.[path]||'')===(files.get(path)||''),'This entry changed on GitHub. Import the latest version before publishing.',409);}
    const changes:any[]=[];const media=new Set<string>();
    for(const text of [doc.body.en,doc.body.he])for(const m of text.matchAll(/\/api\/media\/([a-f0-9-]+\.(?:png|jpg|webp))/g))media.add(m[1]);
    insist(media.size<=15,'Use at most 15 new images per publication.');
    for(const id of media){const object=await bucket().get(`${owner}/${id}`);insist(object,'A draft image is missing.',409);const blob=await ghWrite(owner,'/git/blobs',{content:toBase64(new Uint8Array(await object!.arrayBuffer())),encoding:'base64'});changes.push({path:`public/images/uploads/${id}`,mode:'100644',type:'blob',sha:blob.sha});}
    const replace=(s:string)=>s.replace(/\/api\/media\/([a-f0-9-]+\.(?:png|jpg|webp))/g,'/images/uploads/$1');
    const meta={...doc.meta,public:true,publication:'published',updated:now().slice(0,10),date:doc.meta.date||now().slice(0,10)};
    const payload:Record<string,string>={'meta.yaml':yaml.dump(meta,{noRefs:true,lineWidth:120}), 'en.md':replace(doc.body.en),'he.md':replace(doc.body.he)};
    for(const [name,content]of Object.entries(payload)){if(name==='he.md'&&!content&&!files.has(`${prefix}/${name}`))continue;changes.push({path:`${prefix}/${name}`,mode:'100644',type:'blob',content});}
    const result=await createChange(owner,requestId,ref.object.sha,commit.tree.sha,changes,`Publish ${doc.meta.title.en}`,`Bilingual publication from DATTA Studio. Automated validation must pass before release.`);
    await db().prepare('UPDATE operations SET state=?,result=? WHERE id=? AND owner=?').bind('review',JSON.stringify({...result,draftId,version:draft.version}),requestId,owner).run();
    await audit(owner,'publication.prepared',`${doc.collection}/${doc.slug} · PR #${result.number}`);
    return {...result,draftId,version:draft.version};
  }catch(e){await db().prepare('UPDATE operations SET state=?,result=? WHERE id=? AND owner=?').bind('uncertain',JSON.stringify({error:'Publication stopped. Inspect repository branches/PRs before retrying.'}),requestId,owner).run();throw e;}
}
async function createChange(owner:string,id:string,parent:string,baseTree:string,changes:any[],title:string,description:string){
  const t=await ghWrite(owner,'/git/trees',{base_tree:baseTree,tree:changes});
  const commit=await ghWrite(owner,'/git/commits',{message:title,tree:t.sha,parents:[parent]});
  const branch=`studio/${id}`;await ghWrite(owner,'/git/refs',{ref:`refs/heads/${branch}`,sha:commit.sha});
  const pr=await ghWrite(owner,'/pulls',{title,body:description,head:branch,base:'main'});
  return {number:pr.number,url:pr.html_url,sha:commit.sha,branch,state:'checking'};
}
export async function sourceChange(owner:string,changes:{path:string;content:string}[],message:string){
  insist(changes.length>0&&changes.length<=12,'Use 1–12 source files per change.');
  for(const c of changes){cleanPath(c.path);insist(typeof c.content==='string'&&c.content.length<=100000,'File too large.');}
  const ref=await gh(owner,'/git/ref/heads/main');const commit=await gh(owner,`/git/commits/${ref.object.sha}`);
  const result=await createChange(owner,uid(),ref.object.sha,commit.tree.sha,changes.map(c=>({...c,mode:'100644',type:'blob'})),message.slice(0,100),'Source change proposed from the DATTA Studio AI workspace. Review the diff and passing checks before merging.');
  await audit(owner,'source.proposed',result.url);return result;
}
export async function finishPublication(owner:string,requestId:string){
  const row=await db().prepare('SELECT * FROM operations WHERE id=? AND owner=?').bind(requestId,owner).first<any>();insist(row,'Publication not found.',404);const op=JSON.parse(row.result);
  if(row.state==='published')return op;
  insist(row.state==='review','Inspect Activity and GitHub before continuing.',409);
  const pr=await gh(owner,`/pulls/${op.number}`);insist(pr.head.sha===op.sha,'The publication branch changed. Review it on GitHub.',409);
  if(!pr.merged){const checks=await gh(owner,`/commits/${op.sha}/check-runs`);if(!checkGreen(checks.check_runs,op.sha))return {...op,state:'checking',checks:checks.check_runs.map((r:any)=>({name:r.name,status:r.status,conclusion:r.conclusion,url:r.html_url}))};
    insist(pr.base.ref==='main'&&pr.head.ref===op.branch,'Publication target changed.',409);
    await ghWrite(owner,`/pulls/${op.number}/merge`,{sha:op.sha,merge_method:'squash'},'PUT');
  }
  const latest=await importEntry(owner,`${(await getDraft(owner,op.draftId)).document.collection}/${(await getDraft(owner,op.draftId)).document.slug}`);
  const local=await getDraft(owner,op.draftId);
  // Keep any newer local writing; refresh only the base used for conflict detection.
  await db().prepare('UPDATE drafts SET document=?,version=version+1,updated=? WHERE id=? AND owner=? AND version=?').bind(JSON.stringify({...local.document,base:latest.base}),now(),local.id,owner,local.version).run();
  const result={...op,state:'published',site:'https://boggiomichael.github.io/datta/'};
  await db().prepare('UPDATE operations SET state=?,result=? WHERE id=? AND owner=?').bind('published',JSON.stringify(result),requestId,owner).run();
  await audit(owner,'publication.merged',`PR #${op.number}; GitHub Pages deployment follows.`);
  return result;
}
