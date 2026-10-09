import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { Problem, insist, sameOrigin } from './policy.mjs';
export const db = () => { insist(env.DB,'Database is unavailable.',503); return env.DB!; };
export const bucket = () => { insist(env.BUCKET,'Media storage is unavailable.',503); return env.BUCKET!; };
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export async function actor(request:Request,write=false) {
  const user=await getChatGPTUser();
  insist(user,'Sign in to your private studio.',401);
  if(write) sameOrigin(request);
  return user!.userId;
}
export function json(value:unknown,status=200) { return Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}}); }
export async function handle(fn:()=>Promise<Response>) { try{return await fn();}catch(e){console.error(e instanceof Error ? e.name + ": " + e.message : "Unknown server error");return json({error:e instanceof Problem?e.message:'The operation could not complete. Your saved work is safe.'},e instanceof Problem?e.status:500);} }
export async function body(request:Request,max=650000) {
  insist(Number(request.headers.get('content-length')||0)<=max,'Request too large.',413);
  const reader=request.body?.getReader(); insist(reader,'Request body required.');
  let size=0;const chunks:Uint8Array[]=[];
  while(true){const r=await reader!.read();if(r.done)break;size+=r.value.length;if(size>max){await reader!.cancel();throw new Problem('Request too large.',413);}chunks.push(r.value);}
  const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
  try{return JSON.parse(new TextDecoder().decode(data));}catch{throw new Problem('Invalid JSON.');}
}
export async function audit(owner:string,action:string,detail:string){await db().prepare('INSERT INTO activity VALUES (?,?,?,?,?)').bind(uid(),owner,action,detail.slice(0,500),now()).run();}
export async function rate(owner:string,action:string,max=30){
  const id=`${owner}:${action}:${Math.floor(Date.now()/60000)}`;
  const r=await db().prepare('INSERT INTO limits VALUES (?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(id).first<{count:number}>();
  insist(r&&r.count<=max,'Please wait a minute before trying again.',429);
}
function b64(data:Uint8Array){let s='';for(const b of data)s+=String.fromCharCode(b);return btoa(s);}
function unb64(s:string){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function vaultKey(){const key=(env as unknown as {VAULT_KEY?:string}).VAULT_KEY;insist(key,'Server encryption is not configured.',503);return crypto.subtle.importKey('raw',unb64(key!),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function setSecret(owner:string,provider:string,value:string,model=''){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(`${owner}:${provider}`)},await vaultKey(),new TextEncoder().encode(value));
  await db().prepare('INSERT INTO vault VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET ciphertext=excluded.ciphertext,model=excluded.model').bind(`${owner}:${provider}`,owner,provider,`${b64(iv)}.${b64(new Uint8Array(encrypted))}`,model).run();
}
export async function getSecret(owner:string,provider:string){
  const r=await db().prepare('SELECT ciphertext,model FROM vault WHERE id=? AND owner=?').bind(`${owner}:${provider}`,owner).first<{ciphertext:string;model:string}>();
  if(!r)return null;
  const [iv,data]=r.ciphertext.split('.');
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:new TextEncoder().encode(`${owner}:${provider}`)},await vaultKey(),unb64(data));
  return {value:new TextDecoder().decode(decrypted),model:r.model};
}
export async function boundedFetch(url:string,init:RequestInit={}){const response=await fetch(url,{...init,signal:AbortSignal.timeout(60000),redirect:'manual'});insist(response.status<300||response.status>=400,'Unexpected provider redirect was blocked.',502);return response;}

