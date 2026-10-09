// Run against local preview only; creates isolated test drafts and fake credentials.
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5173';
async function request(payload,{auth=true,originHeader=origin}={}){return fetch(origin+'/api/studio',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Cookie:'__sites_local_auth=1'}:{}),...(originHeader?{Origin:originHeader}:{})},body:JSON.stringify(payload)});}
assert.equal((await request({action:'save'},{auth:false})).status,401);
assert.equal((await request({action:'save'},{originHeader:'https://evil.test'})).status,403);
assert.equal((await request({action:'save'},{originHeader:null})).status,403);
const document={collection:'research',slug:'integration-test',meta:{title:{en:'Integration fixture',he:'בדיקה'},tags:['test']},body:{en:'Never published.',he:'לעולם לא יפורסם.'},base:null};
const created=await(await request({action:'save',document})).json();assert.ok(created.id);assert.equal(created.version,1);
const saved=await(await request({action:'save',id:created.id,version:1,document:{...document,body:{...document.body,en:'Revision'}}})).json();assert.equal(saved.version,2);
assert.equal((await request({action:'save',id:created.id,version:1,document})).status,409);
const revisions=await(await fetch(origin+'/api/studio?action=history&id='+created.id,{headers:{Cookie:'__sites_local_auth=1'}})).json();assert.equal(revisions.length,1);assert.equal(JSON.parse(revisions[0].document).body.he,document.body.he);
assert.equal((await request({action:'ai',provider:'openai',draftId:created.id,prompt:'Test'})).status,409);
const unauthed=await fetch(origin+'/api/studio?action=draft&id='+created.id);assert.equal(unauthed.status,401);
const image=await fetch(origin+'/api/media',{method:'POST',headers:{Cookie:'__sites_local_auth=1',Origin:origin},body:'<svg onload="alert(1)"></svg>'});assert.equal(image.status,400);
console.log('PASS: anonymous access, CSRF, draft persistence, version conflict, private history, missing provider, media rejection.');
