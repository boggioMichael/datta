import { createPrivateKey } from 'node:crypto';
import { actor,handle,db,getSecret,setSecret,boundedFetch,json,audit } from '@/lib/server';
import { insist } from '@/lib/policy.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return handle(async()=>{
  const owner=await actor(request);const u=new URL(request.url);const stored=await getSecret(owner,'github-state');insist(stored,'Start GitHub connection in the studio.',403);const state=JSON.parse(stored!.value);
  insist(state.state===u.searchParams.get('state')&&state.expires>Date.now(),'The connection request expired. Start again in Connections.',403);
  const code=u.searchParams.get('code');insist(code&&/^[a-zA-Z0-9_\-]+$/.test(code),'Missing GitHub connection code.');
  await db().prepare('DELETE FROM vault WHERE id=? AND owner=?').bind(`${owner}:github-state`,owner).run();
  const response=await boundedFetch(`https://api.github.com/app-manifests/${code}/conversions`,{method:'POST',headers:{Accept:'application/vnd.github+json','User-Agent':'DATTA-Studio'}});insist(response.ok,'GitHub App registration failed.',502);
  const app:any=await response.json();const pem=createPrivateKey(app.pem).export({type:'pkcs8',format:'pem'}).toString();
  await setSecret(owner,'github-app',JSON.stringify({id:app.id,pem,slug:app.slug}));await audit(owner,'github.app-created',app.slug);
  return Response.redirect(`https://github.com/apps/${encodeURIComponent(app.slug)}/installations/new`,303);
});}
