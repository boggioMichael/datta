import { db,uid,now,audit } from './server';
import { validateDoc,insist } from './policy.mjs';
export type StudioDoc={collection:string;slug:string;meta:Record<string,any>;body:{en:string;he:string};base:Record<string,string>|null};
export async function getDraft(owner:string,id:string){const r=await db().prepare('SELECT * FROM drafts WHERE id=? AND owner=?').bind(id,owner).first<any>();insist(r,'Draft not found.',404);return {...r,document:JSON.parse(r.document)};}
export async function saveDraft(owner:string,input:any){
  const doc=validateDoc(input.document);const stamp=now();let id=input.id;
  if(id){
    const previous=await getDraft(owner,id);insist(previous.version===input.version,'This draft changed in another tab. Reload it before saving.',409);
    if(JSON.stringify(previous.document)===JSON.stringify(doc))return previous;
    const result=await db().prepare('UPDATE drafts SET document=?,version=version+1,updated=? WHERE id=? AND owner=? AND version=?').bind(JSON.stringify(doc),stamp,id,owner,input.version).run();
    insist(result.meta.changes===1,'This draft changed in another tab. Reload it before saving.',409);
    await db().prepare('INSERT INTO revisions VALUES (?,?,?,?,?)').bind(uid(),id,owner,JSON.stringify(previous.document),stamp).run();
  }else{id=uid();await db().prepare('INSERT INTO drafts VALUES (?,?,?,?,?)').bind(id,owner,JSON.stringify(doc),1,stamp).run();}
  await audit(owner,'draft.saved',`${doc.collection}/${doc.slug}`);
  return getDraft(owner,id);
}
