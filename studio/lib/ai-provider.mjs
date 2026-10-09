import { insist } from './policy.mjs';
/** @param {(url:string, init?:RequestInit)=>Promise<Response>} transport */
export async function generate(provider,key,model,messages,tools,instructions,transport=fetch){
  let url='',payload,headers={'Content-Type':'application/json'};
  if(provider==='anthropic'){
    url='https://api.anthropic.com/v1/messages';headers={...headers,'x-api-key':key,'anthropic-version':'2023-06-01'};
    payload={model,max_tokens:5000,system:instructions,messages,tools:tools.map(t=>({name:t.name,description:t.description,input_schema:t.parameters}))};
  }else if(provider==='openai'){
    url='https://api.openai.com/v1/responses';headers.Authorization=`Bearer ${key}`;
    payload={model,instructions,input:messages,store:false,max_output_tokens:5000,tools:tools.map(t=>({type:'function',...t,strict:true}))};
  }else{
    url=provider==='gemini'?'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions':'https://api.x.ai/v1/chat/completions';headers.Authorization=`Bearer ${key}`;
    payload={model,messages:[{role:'system',content:instructions},...messages],max_tokens:5000,...(tools.length?{tools:tools.map(t=>({type:'function',function:t}))}:{})};
  }
  const r=await transport(url,{method:'POST',headers,body:JSON.stringify(payload)});
  insist(r.ok,`The ${provider} request failed (${r.status}). Check the API key, model access, and provider quota in Connections.`,502);
  const data=await r.json();const calls=[];let text='';let continuation=[];
  if(provider==='openai'){
    continuation=data.output||[];
    for(const o of continuation){if(o.type==='message')text+=(o.content||[]).filter((c)=>c.type==='output_text').map((c)=>c.text).join('\n');if(o.type==='function_call')calls.push({id:o.call_id,name:o.name,args:JSON.parse(o.arguments)});}
  }else if(provider==='anthropic'){
    for(const c of data.content||[]){if(c.type==='text')text+=c.text;if(c.type==='tool_use')calls.push({id:c.id,name:c.name,args:c.input});}
    continuation=[{role:'assistant',content:data.content}];
  }else{const m=data.choices?.[0]?.message;insist(m,'Provider returned no response.',502);text=m.content||'';for(const c of m.tool_calls||[])calls.push({id:c.id,name:c.function.name,args:JSON.parse(c.function.arguments)});continuation=[m];}
  return {text,calls,continuation};
}
