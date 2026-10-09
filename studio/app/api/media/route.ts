import { actor,handle,json,bucket,uid,rate } from '@/lib/server';
import { insist,rasterType } from '@/lib/policy.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request){return handle(async()=>{
  const owner=await actor(request,true);await rate(owner,'upload',20);insist(Number(request.headers.get('content-length')||0)<=4500000,'Images must be smaller than 4 MB.',413);
  const reader=request.body?.getReader();insist(reader,'Choose an image.');let size=0;const chunks:Uint8Array[]=[];
  while(true){const r=await reader!.read();if(r.done)break;size+=r.value.length;if(size>4000000){await reader!.cancel();return json({error:'Images must be smaller than 4 MB.'},413);}chunks.push(r.value);}
  const data=new Uint8Array(size);let at=0;for(const c of chunks){data.set(c,at);at+=c.length;}const [type,extension]=rasterType(data);const id=`${uid()}.${extension}`;
  await bucket().put(`${owner}/${id}`,data,{httpMetadata:{contentType:type}});return json({url:`/api/media/${id}`});
});}
