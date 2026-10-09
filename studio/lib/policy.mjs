export const REPO = 'boggioMichael/datta';
export const COLLECTIONS = ['writing','research','projects','lab','music','civic'];
export const PROVIDERS = ['openai','gemini','anthropic','xai'];
export class Problem extends Error { constructor(message, status=400) { super(message); this.status=status; } }
export function insist(ok, message, status=400) { if (!ok) throw new Problem(message,status); }
export function sameOrigin(request) {
  insist(request.headers.get('origin') === new URL(request.url).origin, 'This action must come from the studio.',403);
  insist(request.headers.get('sec-fetch-site') !== 'cross-site','Cross-site request denied.',403);
}
export function cleanPath(path) {
  insist(typeof path==='string' && path.length<240 && !path.includes('..') && !/[\\\x00-\x1f%]/.test(path),'Invalid repository path.');
  insist(/^(content|src|public|docs)\//.test(path) || ['build.ts','README.md'].includes(path),'Only website source and content can be edited.');
  insist(!/(^|\/)(\.env|\.git|node_modules|credentials|secrets)(\/|\.|$)/i.test(path),'Secret and infrastructure paths are excluded.');
  return path;
}
export function validateDoc(input) {
  insist(input && typeof input==='object','A document is required.');
  insist(COLLECTIONS.includes(input.collection),'Invalid collection.');
  insist(typeof input.slug==='string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) && input.slug.length<=90,'Use a short URL slug with lowercase letters, numbers, and hyphens.');
  insist(input.meta && typeof input.meta==='object' && !Array.isArray(input.meta),'Metadata is required.');
  insist(typeof input.meta.title?.en==='string' && input.meta.title.en.trim().length>0,'Add an English title.');
  insist(input.body && typeof input.body.en==='string' && typeof input.body.he==='string','English and Hebrew text fields are required.');
  insist(JSON.stringify(input).length<=600000,'Document is too large.');
  const tags=Array.isArray(input.meta.tags)?input.meta.tags:[];
  insist(tags.length<=30 && tags.every(t=>typeof t==='string'&&t.length<=60),'Use up to 30 short tags.');
  return {collection:input.collection,slug:input.slug,meta:{...input.meta,tags},body:{en:input.body.en,he:input.body.he},base:input.base??null};
}
export function rasterType(bytes) {
  if(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47) return ['image/png','png'];
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff) return ['image/jpeg','jpg'];
  if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP') return ['image/webp','webp'];
  throw new Problem('Upload a PNG, JPEG, or WebP image.');
}
export function checkGreen(runs,sha) {
  return runs.some(r=>r.name==='validate'&&r.head_sha===sha&&r.status==='completed'&&r.conclusion==='success') && !runs.some(r=>r.head_sha===sha&&r.status==='completed'&&['failure','cancelled','timed_out','action_required'].includes(r.conclusion));
}
