'use client';
import {useEffect,useState} from 'react';
import {validRequest} from '@/lib/bridge-policy.mjs';
export default function Bridge({origin,channel}:{origin:string;channel:string}) {
  const [state,setState] = useState('Connecting your private session…');
  useEffect(()=>{
    const parent = window.opener;
    if (!parent) {setState('Signed in. Return to DATTA and select Connect private session again.');return;}
    const seen = new Set<string>();
    let running = 0;
    let active = true;
    const send = (data:object) => parent.postMessage({...data,channel},origin);
    const receive = async (event:MessageEvent) => {
      if (event.origin !== origin || event.source !== parent || event.data?.channel !== channel) return;
      if (event.data.type === 'datta-ping') {send({type:'datta-ready'});return;}
      const data = event.data;
      if (!validRequest(data,channel) || seen.has(data.id)) return;
      seen.add(data.id);if (seen.size > 1000) seen.delete(seen.values().next().value!);
      if (running >= 24) {send({type:'datta-response',id:data.id,error:'Too many simultaneous requests. Please try again.'});return;}
      running++;
      try {
        const response = await fetch(data.path,{method:data.method,headers:data.contentType?{'Content-Type':data.contentType}:{},body:data.method==='POST'?data.body:undefined,credentials:'same-origin',cache:'no-store',redirect:'error'});
        const body = await response.arrayBuffer();
        if (active) send({type:'datta-response',id:data.id,status:response.status,contentType:response.headers.get('content-type')||'application/octet-stream',body});
      } catch {if(active)send({type:'datta-response',id:data.id,error:'The private service did not respond. Check Activity before repeating a write.'});}
      finally {running--;}
    };
    window.addEventListener('message',receive);
    send({type:'datta-ready'});
    setState('Connected. You can return to DATTA and keep writing.');
    const notifyClosed=()=>send({type:'datta-disconnected'});
    window.addEventListener('pagehide',notifyClosed);
    return ()=>{active=false;window.removeEventListener('message',receive);window.removeEventListener('pagehide',notifyClosed);};
  },[origin,channel]);
  return <main className="session-page"><a className="wordmark" href="https://boggiomichael.github.io/datta/admin/" target="_blank" rel="noopener">DATTA <span lang="he">דאטא</span></a><p className="eyebrow">PRIVATE SESSION · חיבור פרטי</p><h1>Your notebook is open.</h1><p role="status">{state}</p><p>Keep this window open while you write at <strong>boggiomichael.github.io/datta/admin/</strong>. Your drafts, images, and keys stay on the private service.</p><p dir="rtl" lang="he">יש להשאיר חלון זה פתוח בזמן העבודה בסטודיו שבאתר DATTA. הטיוטות והמפתחות נשמרים בשירות הפרטי.</p><button className="primary" onClick={()=>window.opener?.focus()}>Back to DATTA / חזרה לסטודיו</button><p><a href="/signout-with-chatgpt?return_to=%2F">Sign out / יציאה מהחשבון</a></p></main>;
}
