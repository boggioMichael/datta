'use client';
export const LIVE_BACKEND = 'https://datta-publishing-studio.mikebojio.chatgpt.site';
export function onPages() {return typeof document !== 'undefined' && document.documentElement.dataset.studioHost === 'pages';}
export function backendOrigin() {return onPages() ? document.documentElement.dataset.studioBackend || LIVE_BACKEND : location.origin;}
let session:Window|null = null;
let channel = '';
let ready = false;
let listening = false;
const pending = new Map<string,{resolve:(r:Response)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
const notify = (message:string,connected=ready) => window.dispatchEvent(new CustomEvent('datta-session',{detail:{connected,message}}));
function disconnected(message:string) {
  ready=false;
  for (const p of pending.values()) {clearTimeout(p.timer);p.reject(Error('Session disconnected. Check Activity before repeating a write.'));}
  pending.clear();notify(message,false);
}
export function connectSession() {
  if (!listening) {
    listening=true;
    window.addEventListener('message',(event)=>{
      if (event.origin!==backendOrigin() || event.source!==session || event.data?.channel!==channel) return;
      const data=event.data;
      if(data.type==='datta-ready') {ready=true;notify('Private session connected.');return;}
      if(data.type==='datta-disconnected') {disconnected('Private session closed. Reconnect to save or publish.');return;}
      if(data.type!=='datta-response')return;
      const p=pending.get(data.id);if(!p)return;
      clearTimeout(p.timer);pending.delete(data.id);
      if(data.error)p.reject(Error(data.error));
      else if(data.body instanceof ArrayBuffer && Number.isInteger(data.status)&&data.status>=200&&data.status<=599)p.resolve(new Response(data.body,{status:data.status,headers:{'Content-Type':data.contentType}}));
      else p.reject(Error('Invalid response from private service.'));
    });
    setInterval(()=>{if(ready&&session?.closed)disconnected('Private session closed. Reconnect to save or publish.');},1500);
  }
  if(ready&&session&&!session.closed){session.focus();return;}
  disconnected('Complete sign-in in the session window, then return here.');
  channel=crypto.randomUUID();
  const url=new URL('/bridge',backendOrigin());url.searchParams.set('origin',location.origin);url.searchParams.set('channel',channel);
  session=window.open(url.href,'datta-private-session','popup,width=600,height=680');
  if(!session)notify('Allow the sign-in window, then select Connect private session again.',false);
}
export function lockStudio() {session?.close();session=null;disconnected('Studio locked.');location.reload();}
export async function studioRequest(path:string,init:RequestInit={}) {
  if(!onPages())return fetch(path,init);
  if(!ready||!session||session.closed)throw Error('Connect your private session to save, load, or publish.');
  const id=crypto.randomUUID();
  const body=init.body instanceof Blob ? await init.body.arrayBuffer() : init.body;
  return new Promise<Response>((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('The request timed out. Check Activity before repeating a write.'));},360000);
    pending.set(id,{resolve,reject,timer});
    session!.postMessage({type:'datta-request',channel,id,path,method:init.method||'GET',contentType:new Headers(init.headers).get('content-type')||'',body},backendOrigin());
  });
}
const media = new Map<string,Promise<string>>();
export function displayImage(src:string):Promise<string> {
  if(/^\/api\/media\/[a-f0-9-]{36}\.(?:png|jpg|webp)$/.test(src) && onPages()) {
    if(!media.has(src))media.set(src,studioRequest(src).then(async r=>{if(!r.ok)throw Error('Private image unavailable.');return URL.createObjectURL(await r.blob());}).catch(e=>{media.delete(src);throw e;}));
    return media.get(src)!;
  }
  return Promise.resolve(src.startsWith('/')&&!src.startsWith('/api/media/')?'https://boggiomichael.github.io/datta'+src:src);
}
