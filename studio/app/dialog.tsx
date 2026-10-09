'use client';
import {useEffect,useRef,useState} from 'react';
type Question={title:string;initial?:string;input?:boolean;accept:string;cancel:string};
export function useStudioDialog(){
 const [question,setQuestion]=useState<Question|null>(null),[value,setValue]=useState('');
 const element=useRef<HTMLDialogElement>(null),resolve=useRef<((v:string|null)=>void)|null>(null);
 useEffect(()=>{if(question)element.current?.showModal();},[question]);
 function finish(result:string|null){element.current?.close();setQuestion(null);resolve.current?.(result);resolve.current=null;}
 function ask(q:Question){resolve.current?.(null);setValue(q.initial||'');setQuestion(q);return new Promise<string|null>(done=>{resolve.current=done;});}
 const dialog=question?<dialog ref={element} className="studio-dialog" aria-labelledby="studio-dialog-title" onCancel={e=>{e.preventDefault();finish(null);}}><form onSubmit={e=>{e.preventDefault();finish(value);}}><h2 id="studio-dialog-title">{question.title}</h2>{question.input&&<input autoFocus aria-label={question.title} value={value} onChange={e=>setValue(e.target.value)}/>}<div><button type="button" onClick={()=>finish(null)}>{question.cancel}</button><button autoFocus={!question.input} className="primary" type="submit">{question.accept}</button></div></form></dialog>:null;
 return {ask,dialog};
}
