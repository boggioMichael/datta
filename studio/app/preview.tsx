'use client';
import { useEffect,useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {displayImage} from './transport';
import katex from 'katex';
import 'katex/dist/katex.min.css';
const live='https://boggiomichael.github.io/datta';
export default function Preview({text,locale}:{text:string;locale:string}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{let active=true;(async()=>{
  const md=text.replace(/\[\[([a-z]+\/[a-z0-9-]+)(?:\|([^\]]+))?\]\]/g,(_,path,label)=>`[${label||path}](${live}/${locale}/${path}/)`).replace(/<Figure\s+([^>]+)\/>/g,(_,a)=>`![${a.match(/alt="([^"]*)"/)?.[1]||''}](${a.match(/src="([^"]+)"/)?.[1]||''})`);
  const html=DOMPurify.sanitize(await marked.parse(md),{FORBID_TAGS:['style','iframe','form','input'],FORBID_ATTR:['style']});
  if(!active||!ref.current)return;ref.current.innerHTML=html;
  for(const image of ref.current.querySelectorAll('img')){const src=image.getAttribute('src')||'';displayImage(src).then(url=>{if(active)image.src=url;}).catch(()=>{image.alt+=' (Reconnect to load image)';});}
  for(const code of ref.current.querySelectorAll('code.language-math,code.language-latex')){const block=document.createElement('div');block.innerHTML=katex.renderToString(code.textContent||'',{displayMode:true,throwOnError:false,trust:false});code.parentElement?.replaceWith(block);}
  const diagrams=Array.from(ref.current.querySelectorAll('code.language-mermaid'));
  if(diagrams.length){const {default:mermaid}=await import('mermaid');mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'neutral',flowchart:{htmlLabels:false},maxTextSize:25000});for(const code of diagrams){try{const {svg}=await mermaid.render(`diagram-${crypto.randomUUID()}`,code.textContent||'');if(!active)return;const el=document.createElement('figure');el.innerHTML=DOMPurify.sanitize(svg,{USE_PROFILES:{svg:true,svgFilters:true}});code.parentElement?.replaceWith(el);}catch{}}}
 })();return()=>{active=false;};},[text,locale]);
 return <div ref={ref} className="prose preview-body" dir={locale==='he'?'rtl':'auto'} lang={locale}/>;
}
