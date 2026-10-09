// Original teaching studies. Rules are deliberately narrower than free composition.
export const SOURCES = {
  fenaroli: {name:'Fedele Fenaroli · Regole musicali (1775)',url:'https://partimenti.org/partimenti/collections/fenaroli/fenaroli_book3.pdf',focus:'Consonances, parallel fifths/octaves, and bass figures.',he:'קונסוננסים, קווינטות ואוקטבות מקבילות וספרות הבס.'},
  fux: {name:'J. J. Fux · Gradus ad Parnassum (1725)',url:'https://imslp.org/wiki/Gradus_ad_Parnassum_(Fux,_Johann_Joseph)',focus:'A historical model for disciplined voice leading; these tonal exercises are not strict species counterpoint.',he:'מודל היסטורי להולכת קולות. התרגילים הטונאליים כאן אינם קונטרפונקט מינים מחמיר.'},
  octave: {name:'Robert O. Gjerdingen · Learning the Rule of the Octave',url:'https://partimenti.org/partimenti/about_parti/beginners_guide/learning_the_rule.pdf',focus:'Realizing a bass, learning melodic patterns, and practising in different keys.',he:'מימוש קו בס, לימוד דגמים מלודיים ותרגול בסולמות שונים.'},
  bach: {name:'J. S. Bach · Fugue in G minor, BWV 578',url:'https://imslp.org/wiki/Fugue_in_G_minor,_BWV_578_(Bach,_Johann_Sebastian)',focus:'A score to study for subject entries and voice independence. Our short imitation studies use original themes.',he:'פרטיטורה ללימוד כניסות נושא ועצמאות קולות. תרגילי החיקוי כאן משתמשים בנושאים מקוריים.'},
};
export const pc=n=>((n%12)+12)%12;
const KEYS=[
  {name:'C major',he:'דו מז׳ור',offset:0,fifths:0,mode:'major',letters:['C','D','E','F','G','A','B']},
  {name:'G major',he:'סול מז׳ור',offset:7,fifths:1,mode:'major',letters:['G','A','B','C','D','E','F']},
  {name:'F major',he:'פה מז׳ור',offset:5,fifths:-1,mode:'major',letters:['F','G','A','B','C','D','E']},
  {name:'D major',he:'רה מז׳ור',offset:2,fifths:2,mode:'major',letters:['D','E','F','G','A','B','C']},
  {name:'A minor',he:'לה מינור',offset:-3,fifths:0,mode:'minor',letters:['A','B','C','D','E','F','G']},
  {name:'D minor',he:'רה מינור',offset:2,fifths:-1,mode:'minor',letters:['D','E','F','G','A','B','C']},
  {name:'B♭ major',he:'סי במול מז׳ור',offset:-2,fifths:-2,mode:'major',letters:['B','C','D','E','F','G','A']},
  {name:'E minor',he:'מי מינור',offset:4,fifths:1,mode:'minor',letters:['E','F','G','A','B','C','D']},
];
export const CHAPTERS=[['The bass finds home','הבס מוצא בית'],['A second voice','קול שני'],['Three voices, one thought','שלושה קולות, מחשבה אחת'],['The four-part desk','שולחן ארבעת הקולות'],['The art of suspension','אמנות ההשהיה'],['The fugue notebook','מחברת הפוגה']];
const NAMES=[['A door left open','דלת שנותרה פתוחה'],['A longer way home','דרך ארוכה הביתה'],['Another colour','צבע אחר'],['Without the handrail','בלי המעקה']];
const natural={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const minor=n=>n==null?n:n-(pc(n)===4||pc(n)===9?1:0);
const consonant=n=>[0,3,4,7,8,9].includes(pc(n));
function parallel(a,b,c,d) {const before=pc(a-b),after=pc(c-d);return [0,7].includes(before)&&after===before&&Math.sign(c-a)===Math.sign(d-b)&&c!==a&&d!==b;}
function frameOK(notes,bass,previous,previousBass) {
  if(notes.some((n,i)=>n<= (notes[i+1]??bass)||!consonant(n-bass)))return false;
  const all=[...notes,bass],old=previous&&[...previous,previousBass];
  if(old)for(let a=0;a<all.length;a++){
    if(a<notes.length&&Math.abs(all[a]-old[a])>7)return false;
    for(let b=a+1;b<all.length;b++)if(parallel(old[a],old[b],all[a],all[b]))return false;
  }
  return true;
}
const modelCache=new Map();
function makeModel(count,isMinor,fugue=false) {
  const cacheKey=[count,isMinor,fugue].join(':');if(modelCache.has(cacheKey))return modelCache.get(cacheKey).map(x=>x.slice());
  const bass=fugue?[48,43,48,40,43,41,43,48,45,53,55,48]:[48,50,52,53,55,53,55,48];
  const chords=fugue?[[0,4,7],[7,11,2],[0,4,7],[0,4,7],[7,11,2],[5,9,0],[7,11,2],[0,4,7],[9,0,4],[5,9,0],[7,11,2],[0,4,7]]:[[0,4,7],[2,5,11],[0,4,7],[5,9,0],[7,11,2],[5,9,0],[7,11,2],[0,4,7]];
  if(isMinor){for(let i=0;i<bass.length;i++)bass[i]=minor(bass[i]);for(const chord of chords)for(let j=0;j<chord.length;j++)chord[j]=minor(chord[j]);}
  const ranges=count===1?[[60,79]]:count===2?[[65,81],[55,74]]:[[65,81],[59,74],[50,67]];
  let beam=[{frames:[],cost:0}];
  for(let i=0;i<bass.length;i++){
    const choices=ranges.map(([lo,hi],p)=>Array.from({length:hi-lo+1},(_,n)=>n+lo).filter(n=>chords[i].includes(pc(n))));
    if(fugue&&i<4)choices[0]=[72,74,76,72].slice(i,i+1);
    if(fugue&&i>=4&&i<8)choices[1]=[67,69,71,67].slice(i-4,i-3);
    // A prepared upper C over F, then B over G, then C: a 4–3 cadence scaffold.
    if(!fugue&&i===5)choices[0]=[72];
    if(i===bass.length-2)choices[0]=[71];
    if(i===bass.length-1)choices[0]=[72];
    const frames=[];
    function product(p,current){if(p===count){if(frameOK(current,bass[i]))frames.push(current);return;}for(const n of choices[p])product(p+1,[...current,n]);}
    product(0,[]);
    const next=[];
    for(const state of beam)for(const frame of frames){
      const prev=state.frames.at(-1);
      if(!frameOK(frame,bass[i],prev,bass[i-1]))continue;
      const leap=prev?frame.reduce((sum,n,p)=>sum+Math.abs(n-prev[p])+(Math.abs(n-prev[p])>4?3:0),0):frame.reduce((sum,n,p)=>sum+Math.abs(n-(72-p*7)),0)*.15;
      const noThird=count>1&&!frame.some(n=>[3,4].includes(pc(n-bass[i])))?1:0;
      next.push({frames:[...state.frames,frame],cost:state.cost+leap+noThird});
    }
    next.sort((a,b)=>a.cost-b.cost);beam=next.slice(0,80);
    if(!beam.length)throw Error(`No realization for ${cacheKey} at ${i}`);
  }
  const solution=Array.from({length:count},(_,p)=>beam[0].frames.map(f=>f[p]));solution.push(bass);
  modelCache.set(cacheKey,solution);return solution.map(x=>x.slice());
}
export const LEVEL_COUNT=24;
export function makeExercise(index=0) {
  index=Math.max(0,Math.min(LEVEL_COUNT-1,Math.floor(index)));
  const chapter=Math.floor(index/4),within=index%4;
  const key=KEYS[(chapter===5?[0,1,3,6]:chapter===0?[0,0,1,2]:[0,3,4,5])[within]];
  const count=chapter<2?1:chapter===3?3:2;
  let model=makeModel(count,key.mode==='minor',chapter===5);
  let duration=chapter===5?1:2,suspension=null;
  if(chapter===4){model=model.map(row=>row.flatMap(n=>[n,n]));model[0][12]=model[0][11];suspension={part:0,index:12};duration=1;}
  model=model.map(row=>row.map(n=>n+key.offset));
  const ids=count===1?['soprano','bass']:count===2?['soprano','alto','bass']:['soprano','alto','tenor','bass'];
  const labels={soprano:['Soprano','סופרן'],alto:['Alto','אלט'],tenor:['Tenor','טנור'],bass:['Bass','בס']};
  const parts=ids.map((id,p)=>({id,label:labels[id],clef:p>=2||id==='bass'?'bass':'treble',range:[Math.min(...model[p])-7,Math.max(...model[p])+7]}));
  const locked=model.map((row,p)=>row.map((n,i)=>{
    if(chapter===0)return p!==count||i===0||i===row.length-1||(within===0&&[1,3,5].includes(i))||(within===1&&[2,4].includes(i))||(within===2&&i===3);
    if(p===count)return true;
    if(chapter===5&&p===0&&i<4)return true;
    return (within===0&&i%4===0)||(within===1&&i===0);
  }));
  const harmonies=model[0].map((_,i)=>{
    const position=chapter===4?Math.floor(i/2):i;
    const major=chapter===5?[[0,4,7],[7,11,2],[0,4,7],[0,4,7],[7,11,2],[5,9,0],[7,11,2],[0,4,7],[9,0,4],[5,9,0],[7,11,2],[0,4,7]]:[[0,4,7],[2,5,11],[0,4,7],[5,9,0],[7,11,2],[5,9,0],[7,11,2],[0,4,7]];
    return major[position].map(n=>pc((key.mode==='minor'?minor(n):n)+key.offset));
  });
  return {id:`study-${index+1}`,index,chapter,within,key,parts,model,locked,harmonies,duration,steps:model[0].length,suspension,imitation:chapter===5?{part:1,start:4,length:4,transpose:-5}:null,title:NAMES[within],chapterTitle:CHAPTERS[chapter]};
}
export function initialNotes(ex){return ex.model.map((row,p)=>row.map((n,i)=>ex.locked[p][i]?n:null));}
export function spelling(midi,key) {
  const scale=key.mode==='minor'?[0,2,3,5,7,8,11]:[0,2,4,5,7,9,11];
  const degree=scale.findIndex(n=>pc(n+key.offset)===pc(midi));
  let step,alter;
  if(degree>=0){step=key.letters[degree];alter=pc(midi)-natural[step];if(alter>6)alter-=12;if(alter< -6)alter+=12;}
  else {const names=key.fifths<0?['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']:['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];const s=names[pc(midi)];step=s[0];alter=s[1]==='#'?1:s[1]==='b'?-1:0;}
  const octave=Math.round((midi-natural[step]-alter)/12)-1;
  return {step,alter,octave,name:step+(alter===1?'♯':alter===-1?'♭':'')+octave,key:step.toLowerCase()+'/'+octave};
}
export function figures(ex,index){const bass=ex.model.at(-1)[index],minor=ex.key.mode==='minor',raised=minor&&ex.harmonies[index].includes(pc(ex.key.offset+11));if(ex.suspension?.index===index)return minor?'4–♯3':'4–3';const intervals=[...new Set(ex.harmonies[index].map(n=>pc(n-bass)))];return intervals.some(n=>n===8||n===9)?(raised?'♯6/3':'6/3'):(raised?'5/♯3':'5/3');}
export function tieAt(ex,notes,part,index){const s=ex.suspension;if(!s||s.part!==part||notes[part][s.index]==null||notes[part][s.index]!==notes[part][s.index-1])return '';return index===s.index?'stop':index===s.index-1?'start':'';}
export function noteSpan(ex,notes,part,index){const tie=tieAt(ex,notes,part,index);return tie==='stop'?0:tie==='start'?2:1;}
export function analyze(ex,notes) {
  const issues=[];let filled=0,total=0;
  const issue=(rule,part,index,severity,en,he,source='fenaroli')=>issues.push({rule,part,index,severity,en,he,source});
  const bassIndex=ex.parts.length-1;
  for(let p=0;p<ex.parts.length;p++)for(let i=0;i<ex.steps;i++){
    const n=notes[p]?.[i];if(!ex.locked[p][i]){total++;if(Number.isInteger(n))filled++;}
    if(n==null)continue;
    if(!Number.isInteger(n)||n<ex.parts[p].range[0]||n>ex.parts[p].range[1]){issue('range',p,i,'error','Keep this voice inside the exercise range.','יש לשמור על מנעד הקול בתרגיל.','fux');continue;}
    if(ex.locked[p][i]&&n!==ex.model[p][i])issue('given',p,i,'error','Restore the given note.','יש להחזיר את התו הנתון.','octave');
    if(p===bassIndex&&ex.chapter===0&&pc(n)!==pc(ex.model[p][i]))issue('bass-pattern',p,i,'error','Follow the displayed bass-degree map. Octave choices are flexible.','יש לעקוב אחרי מפת דרגות הבס. אפשר לבחור אוקטבה אחרת.','octave');
    const isSusp=ex.suspension?.part===p&&ex.suspension.index===i;
    if(isSusp){const before=notes[p][i-1],after=notes[p][i+1],bass=notes[bassIndex][i];if(before!=null&&after!=null&&bass!=null&&(n!==before||![1,2].includes(n-after)||pc(n-bass)!==5||![3,4].includes(pc(after-bass))))issue('suspension',p,i,'error','Prepare the same pitch, hold a fourth above the bass, then resolve down by step to a third.','יש להכין אותו צליל, להשהות קוורטה מעל הבס ולפתור בצעד מטה לטרצה.');}
    else if(p!==bassIndex&&!ex.harmonies[i].includes(pc(n)))issue('harmony',p,i,'error','This study uses the supplied bass figures. Choose a chord tone here.','בתרגיל זה יש להשתמש בספרות הבס ולבחור כאן צליל אקורד.');
    const prev=notes[p][i-1];
    if(prev!=null){const leap=Math.abs(n-prev);if(leap>(p===bassIndex?12:7))issue('leap',p,i,'error','This leap exceeds the study limit; bring the line closer.','הקפיצה חורגת ממגבלת התרגיל. יש לקרב את הצלילים.','fux');else if(p!==bassIndex&&leap>4&&notes[p][i+1]!=null&&(Math.abs(notes[p][i+1]-n)>2||Math.sign(notes[p][i+1]-n)===Math.sign(n-prev)))issue('recovery',p,i,'tip','After a wide leap, try a step in the opposite direction.','אחרי קפיצה רחבה, נסו צעד בכיוון הנגדי.','fux');}
  }
  for(let i=0;i<ex.steps;i++)for(let p=0;p<ex.parts.length;p++)for(let q=p+1;q<ex.parts.length;q++){
    const a=notes[p]?.[i],b=notes[q]?.[i];if(a==null||b==null)continue;
    const target=!ex.locked[p][i]?p:q;
    if(a<b)issue('crossing',target,i,'error','The voices cross. Keep the upper staff above the lower staff.','הקולות מצטלבים. יש לשמור את הקול העליון מעל התחתון.','fux');
    const ap=notes[p]?.[i-1],bp=notes[q]?.[i-1];
    if(ap!=null&&bp!=null&&parallel(ap,bp,a,b))issue('parallel',target,i,'error',`Parallel ${pc(a-b)===7?'fifths':'octaves/unisons'}: let one voice stay still or move the other way.`,`תנועה מקבילה ב${pc(a-b)===7?'קווינטות':'אוקטבות או אוניסון'}: אפשר להשאיר קול במקום או לנוע בכיוון נגדי.`);
  }
  const last=ex.steps-1,top=notes[0]?.[last],bass=notes[bassIndex]?.[last];
  if(top!=null&&pc(top)!==pc(ex.key.offset))issue('cadence',0,last,'error','Finish the upper voice on the tonic for this closing cadence.','בקדנצה המסיימת של התרגיל יש לסיים את הקול העליון בטוניקה.');
  if(bass!=null&&pc(bass)!==pc(ex.key.offset))issue('cadence',bassIndex,last,'error','This cadence closes on the tonic in the bass.','קדנצה זו מסתיימת בטוניקה בבס.');
  if(ex.imitation){const {part,start,length,transpose}=ex.imitation;for(let i=0;i<length;i++){const n=notes[part][start+i];if(n!=null&&n!==ex.model[0][i]+transpose)issue('answer',part,start+i,'error','Keep the subject’s interval pattern in this real answer at the dominant.','יש לשמור על דגם מרווחי הנושא בתשובה ריאלית בדומיננטה.','bach');}}
  const errors=issues.filter(i=>i.severity==='error'),tips=issues.length-errors.length;
  const coverage=total?filled/total:1;
  const score=Math.max(0,Math.round((100-errors.length*9-tips*2)*coverage));
  return {score,filled,total,coverage,issues:issues.sort((a,b)=>(a.severity==='error'?0:1)-(b.severity==='error'?0:1)||a.index-b.index),passed:filled===total&&errors.length===0&&score>=80,errors:errors.length};
}
export function suggest(ex,notes,selected) {
  const report=analyze(ex,notes);
  let cell=selected&&!ex.locked[selected.part]?.[selected.index]?selected:null;
  if(!cell){const e=report.issues.find(i=>!ex.locked[i.part][i.index]);if(e)cell={part:e.part,index:e.index};}
  if(!cell)for(let i=0;i<ex.steps&&!cell;i++)for(let p=0;p<ex.parts.length;p++)if(!ex.locked[p][i]&&notes[p][i]==null){cell={part:p,index:i};break;}
  if(!cell)return null;
  const {part,index}=cell,[lo,hi]=ex.parts[part].range;
  let best=null;
  for(let note=lo;note<=hi;note++){
    const candidate=notes.map(row=>row.slice());candidate[part][index]=note;
    const r=analyze(ex,candidate),smooth=[notes[part][index-1],notes[part][index+1]].filter(n=>n!=null).reduce((sum,n)=>sum+Math.abs(n-note),0);
    const rank=r.score*100-r.errors*30-smooth-Math.abs(note-ex.model[part][index])*.1;
    if(!best||rank>best.rank)best={...cell,note,rank};
  }
  return best;
}
export function validSavedNotes(ex,notes){return Array.isArray(notes)&&notes.length===ex.parts.length&&notes.every((row,p)=>Array.isArray(row)&&row.length===ex.steps&&row.every((n,i)=>ex.locked[p][i]?n===ex.model[p][i]:n===null||(Number.isInteger(n)&&n>=ex.parts[p].range[0]&&n<=ex.parts[p].range[1])));}
const xmlEscape=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
export function musicXML(ex,notes,tempo=80) {
  const count=4/ex.duration,measureCount=Math.ceil(ex.steps/count);
  const partList=ex.parts.map((p,i)=>`<score-part id="P${i+1}"><part-name>${p.label[0]}</part-name><score-instrument id="I${i+1}"><instrument-name>Harpsichord</instrument-name></score-instrument><midi-instrument id="I${i+1}"><midi-channel>${i+1}</midi-channel><midi-program>7</midi-program></midi-instrument></score-part>`).join('');
  const parts=ex.parts.map((p,pi)=>`<part id="P${pi+1}">`+Array.from({length:measureCount},(_,m)=>`<measure number="${m+1}">${m===0?`<attributes><divisions>2</divisions><key><fifths>${ex.key.fifths}</fifths><mode>${ex.key.mode}</mode></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>${p.clef==='bass'?'F':'G'}</sign><line>${p.clef==='bass'?4:2}</line></clef></attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${tempo}</per-minute></metronome></direction-type><sound tempo="${tempo}"/></direction>`:''}`+Array.from({length:count},(_,j)=>{const index=m*count+j,n=notes[pi]?.[index],s=n==null?null:spelling(n,ex.key),tie=tieAt(ex,notes,pi,index);return `<note>${s?`<pitch><step>${s.step}</step>${s.alter?`<alter>${s.alter}</alter>`:''}<octave>${s.octave}</octave></pitch>`:'<rest/>'}<duration>${ex.duration*2}</duration>${tie?`<tie type="${tie}"/>`:""}<type>${ex.duration===2?'half':'quarter'}</type>${tie?`<notations><tied type="${tie}"/></notations>`:''}</note>`;}).join('')+'</measure>').join('')+'</part>').join('');
  return `<?xml version="1.0" encoding="utf-8"?><score-partwise version="4.0"><work><work-title>DATTA — Study ${ex.index+1}: ${xmlEscape(ex.chapterTitle[0])}</work-title></work><identification><creator type="composer">Your DATTA realization</creator></identification><part-list>${partList}</part-list>${parts}</score-partwise>`;
}
export function midiFile(ex,notes,tempo=80) {
  const data=[],events=[];const u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
  const vlq=n=>{const bytes=[n&127];while(n>>=7)bytes.unshift((n&127)|128);return bytes;};
  const micros=Math.round(60000000/tempo);events.push({tick:0,order:0,bytes:[255,81,3,(micros>>16)&255,(micros>>8)&255,micros&255]});
  notes.forEach((row,p)=>{events.push({tick:0,order:0,bytes:[192+p,6]});row.forEach((n,i)=>{const span=noteSpan(ex,notes,p,i);if(n==null||!span)return;events.push({tick:i*ex.duration*480,order:2,bytes:[144+p,n,p===notes.length-1?65:82]},{tick:Math.round((i+span-.08)*ex.duration*480),order:1,bytes:[128+p,n,0]});});});
  events.sort((a,b)=>a.tick-b.tick||a.order-b.order);let tick=0;for(const e of events){data.push(...vlq(e.tick-tick),...e.bytes);tick=e.tick;}data.push(0,255,47,0);
  return new Uint8Array([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,...u32(data.length),...data]);
}
