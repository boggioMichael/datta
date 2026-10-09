import { actor,handle,json,body,db,audit,rate,setSecret,uid,now,boundedFetch,getSecret } from '@/lib/server';
import { getDraft,saveDraft } from '@/lib/documents';
import { tree,importEntry,preparePublication,finishPublication,gh,ghWrite } from '@/lib/github';
import { insist,PROVIDERS } from '@/lib/policy.mjs';
import { assist } from '@/lib/ai';
export const dynamic='force-dynamic';
export async function GET(request:Request){return handle(async()=>{
  const owner=await actor(request);const url=new URL(request.url);const action=url.searchParams.get('action');
  if(action==='draft')return json(await getDraft(owner,url.searchParams.get('id')||''));
  if(action==='entries')return json((await tree(owner)).filter(f=>/^content\/(writing|research|projects|lab|music|civic)\/[a-z0-9-]+\/meta.yaml$/.test(f.path)).map(f=>f.path.replace(/^content\//,'').replace(/\/meta.yaml$/,'')));
  if(action==='import')return json(await importEntry(owner,url.searchParams.get('ref')||''));
  if(action==='history'){const id=url.searchParams.get('id')||'';await getDraft(owner,id);return json((await db().prepare('SELECT id,created,document FROM revisions WHERE draft=? AND owner=? ORDER BY created DESC LIMIT 30').bind(id,owner).all()).results);}
  if(action==='activity')return json((await db().prepare('SELECT action,detail,created FROM activity WHERE owner=? ORDER BY created DESC LIMIT 60').bind(owner).all()).results);
  if(action==='connections')return json((await db().prepare('SELECT provider,model FROM vault WHERE owner=?').bind(owner).all()).results);
  if(action==='publications')return json((await db().prepare('SELECT id,state,result,created FROM operations WHERE owner=? ORDER BY created DESC LIMIT 25').bind(owner).all()).results);
  if(action==='github-status'){const repo=await gh(owner,'');return json({repo:repo.full_name,permissions:repo.permissions||{},connected:true});}
  const rows=(await db().prepare('SELECT id,document,version,updated FROM drafts WHERE owner=? ORDER BY updated DESC LIMIT 200').bind(owner).all()).results as any[];
  return json(rows.map(r=>({...r,document:JSON.parse(r.document)})));
});}
export async function POST(request:Request){return handle(async()=>{
  const owner=await actor(request,true);await rate(owner,'write',80);const input=await body(request);
  if(input.action==='save')return json(await saveDraft(owner,input));
  if(input.action==='connect'){
    insist([...PROVIDERS,'github'].includes(input.provider),'Unknown provider.');insist(typeof input.key==='string'&&input.key.length>=12&&input.key.length<5000,'Enter an API key.');
    insist(input.provider==='github'||(typeof input.model==='string'&&/^[a-zA-Z0-9_.:/-]{1,150}$/.test(input.model)),'Enter a valid model ID from your provider account.');
    await setSecret(owner,input.provider,input.key,input.model||'');await audit(owner,'connection.saved',input.provider);return json({saved:true});
  }
  if(input.action==='disconnect'){insist([...PROVIDERS,'github','github-app'].includes(input.provider),'Unknown provider.');await db().prepare('DELETE FROM vault WHERE id=? AND owner=?').bind(`${owner}:${input.provider}`,owner).run();return json({removed:true});}
  if(input.action==='ai')return json(await assist(owner,input));
  if(input.action==='publish')return json(await preparePublication(owner,input.id,input.operation));
  if(input.action==='release')return json(await finishPublication(owner,input.operation));
  if(input.action==='message'){
    insist(Number.isInteger(input.issue)&&input.issue>0,'Enter a GitHub issue or pull request number.');insist(typeof input.text==='string'&&input.text.trim()&&input.text.length<=10000,'Write a message up to 10,000 characters.');
    insist(typeof input.operation==='string'&&/^[\w-]{8,100}$/.test(input.operation),'Invalid operation identifier.');
    const exists=await db().prepare('SELECT id FROM operations WHERE id=? AND owner=?').bind(input.operation,owner).first();insist(!exists,'This message was already submitted. Check GitHub before sending again.',409);
    await db().prepare('INSERT INTO operations VALUES (?,?,?,?,?)').bind(input.operation,owner,'message-sending','{}',now()).run();
    const result=await ghWrite(owner,`/issues/${input.issue}/comments`,{body:input.text});await db().prepare('UPDATE operations SET state=?,result=? WHERE id=? AND owner=?').bind('message-sent',JSON.stringify({url:result.html_url}),input.operation,owner).run();
    await audit(owner,'collaborator.message',`Issue/PR #${input.issue}`);return json({url:result.html_url});
  }
  if(input.action==='app-manifest'){
    const state=uid();await setSecret(owner,'github-state',JSON.stringify({state,expires:Date.now()+3600000}));const origin=new URL(request.url).origin;
    return json({url:`https://github.com/settings/apps/new?state=${state}`,manifest:{name:`DATTA Studio ${state.slice(0,8)}`,url:origin,redirect_url:`${origin}/api/github/callback`,setup_url:origin,public:false,hook_attributes:{url:`${origin}/api/github/webhook`,active:false},default_permissions:{contents:'write',pull_requests:'write',issues:'write',checks:'read',actions:'read'},default_events:[]}});
  }
  return json({error:'Unknown action.'},400);
});}
