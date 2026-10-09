import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedOrigin,validRequest} from '../lib/bridge-policy.mjs';
const channel='6c98422d-ce9c-4c8c-ab0c-a1715f32a998';
const request={type:'datta-request',channel,id:'76acb967-6543-48ae-a18b-3eb8cc1e431b',path:'/api/studio?action=entries',method:'GET',contentType:''};
test('bridge only trusts the exact DATTA origin; loopback is development-only',()=>{
 assert.equal(allowedOrigin('https://boggiomichael.github.io'),true);
 for(const origin of ['null','https://boggiomichael.github.io.evil.test','https://evil.test','http://localhost:4321'])assert.equal(allowedOrigin(origin),false);
 assert.equal(allowedOrigin('http://localhost:4321',true),true);
});
test('bridge only forwards bounded requests to studio or media, never arbitrary URLs',()=>{
 assert.equal(validRequest(request,channel),true);
 for(const ext of ['jpg','png','webp'])assert.equal(validRequest({...request,path:`/api/media/${channel}.${ext}`},channel),true);
 assert.equal(validRequest({...request,path:`/api/media/${channel}.svg`},channel),false);
 for(const path of ['https://evil.test/','//evil.test','/api/studio/../github/callback','/api/media/../../secrets','/signin-with-chatgpt','/api/studio#x'])assert.equal(validRequest({...request,path},channel),false);
 assert.equal(validRequest({...request,channel:'wrong'},channel),false);
 assert.equal(validRequest({...request,method:'DELETE'},channel),false);
 assert.equal(validRequest({...request,path:'/api/studio',method:'POST',contentType:'application/json',body:'{}'},channel),true);
 assert.equal(validRequest({...request,path:'/api/studio',method:'POST',contentType:'application/json',body:'x'.repeat(650001)},channel),false);
 assert.equal(validRequest({...request,path:'/api/media',method:'POST',contentType:'image/png',body:new ArrayBuffer(12)},channel),true);
 assert.equal(validRequest({...request,path:'/api/media',method:'POST',contentType:'image/svg+xml',body:new ArrayBuffer(12)},channel),false);
});
