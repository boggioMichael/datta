import { actor,handle,bucket,json } from '@/lib/server';
import { insist } from '@/lib/policy.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{
  const owner=await actor(request);const {id}=await params;insist(/^[a-f0-9-]+\.(png|jpg|webp)$/.test(id),'Invalid image.');const object=await bucket().get(`${owner}/${id}`);if(!object)return json({error:'Image not found.'},404);
  return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
});}
