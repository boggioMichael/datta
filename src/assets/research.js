// Keep the large diagram renderer off the network on ordinary pages.
if(document.querySelector('pre.mermaid')){
 const {default:mermaid}=await import('mermaid');
 mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'neutral',flowchart:{htmlLabels:false},maxTextSize:25000});
 try{await mermaid.run({querySelector:'pre.mermaid'});}catch{document.querySelectorAll('pre.mermaid').forEach(el=>el.setAttribute('title','Diagram source — syntax could not be rendered.'));}
}
