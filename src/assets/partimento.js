import {Renderer,Stave,StaveNote,Voice,Formatter,Accidental,Annotation,StaveConnector,StaveTie} from 'vexflow';
import {makeExercise,initialNotes,analyze,suggest,spelling,figures,pc,validSavedNotes,musicXML,midiFile,noteSpan,SOURCES,CHAPTERS,LEVEL_COUNT} from './partimento-engine.js';

const root=document.querySelector('[data-partimento]');
if(root)start();
function start(){
  const he=document.documentElement.lang==='he',L=(en,heb)=>he?heb:en;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=s=>root.querySelector(s),storageKey='datta-partimento-v1';
  let saved={current:0,unlocked:0,best:{},studies:{}};
  try{const v=JSON.parse(localStorage.getItem(storageKey)||'null');if(v&&Number.isInteger(v.unlocked)&&v.unlocked>=0&&v.unlocked<LEVEL_COUNT&&v.best&&v.studies)saved=v;}catch{}
  let index=Math.max(0,Math.min(LEVEL_COUNT-1,Number.isInteger(saved.current)?saved.current:0)),ex=makeExercise(index);
  let notes=validSavedNotes(ex,saved.studies[ex.id]?.notes)?saved.studies[ex.id].notes:initialNotes(ex);
  let selected=firstEditable(),history=[],report=null,hint=null,assisted=Boolean(saved.studies[ex.id]?.assisted),tempo=80,playing=false,playIndex=-1,autoAdvance=false;
  let context,nodes=[],timers=[],transportId=0;
  function firstEditable(){for(let i=0;i<ex.steps;i++)for(let p=0;p<ex.parts.length;p++)if(!ex.locked[p][i])return {part:p,index:i};return {part:0,index:0};}
  const partName=p=>ex.parts[p].label[he?1:0];
  const place=i=>L(`Bar ${Math.floor(i*ex.duration/4)+1} · beat ${(i*ex.duration)%4+1}`,`תיבה ${Math.floor(i*ex.duration/4)+1} · פעמה ${(i*ex.duration)%4+1}`);
  function persist(){saved.current=index;saved.studies[ex.id]={notes,assisted};try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{status(L('Device storage is unavailable. Export MusicXML to keep your work.','אחסון מקומי אינו זמין. יש לייצא MusicXML כדי לשמור את העבודה.'));}}
  function status(text){$('[data-status]').textContent=text;}
  function buildShell(){
    root.innerHTML=`<div class="partimento-appbar"><div><span class="score-file-icon">𝄞</span><strong>${L('Partimento','פרטימנטו')}</strong><span class="file-caption">${L('a notebook for the ear','מחברת לאוזן')}</span></div><div class="file-actions"><button data-export="xml">MusicXML ↓</button><button data-export="midi">MIDI ↓</button><button data-print>${L('Print','הדפסה')}</button></div></div>
    <div class="partimento-toolbar"><div class="transport-buttons"><button class="play-button" data-play aria-label="${L('Play composition','נגינת היצירה')}">▶ <span>${L('Listen','האזנה')}</span></button><button data-stop aria-label="${L('Stop playback','עצירת נגינה')}">■</button><label class="tempo-label">♩ = <input data-tempo type="number" min="40" max="160" value="${tempo}" aria-label="${L('Tempo','מפעם')}"></label><select data-instrument aria-label="${L('Instrument','כלי')}"><option value="harpsichord">${L('Harpsichord','צ׳מבלו')}</option><option value="soft">${L('Soft keys','קלידים רכים')}</option></select><label class="solo-label"><input type="checkbox" data-solo>${L('Solo selected voice','הקול הנבחר בלבד')}</label></div><div class="edit-actions"><button data-undo title="${L('Undo (Ctrl+Z)','ביטול (Ctrl+Z)')}">↶</button><button data-reset>${L('Start again','התחלה מחדש')}</button><button class="analyze-button" data-analyze>✳ ${L('Ask the coach','ניתוח עם המלווה')}</button></div></div>
    <div class="partimento-workspace"><aside class="study-library"><p class="panel-label">${L('THE CONSERVATORY','הקונסרבטוריון')}</p><div data-levels></div><label class="practice-label">${L('Explore a study','חקירת תרגיל')}<select data-practice aria-label="${L('Explore a study','חקירת תרגיל')}">${Array.from({length:LEVEL_COUNT},(_,i)=>`<option value="${i}">${i+1}. ${CHAPTERS[Math.floor(i/4)][he?1:0]}</option>`).join('')}</select></label><p class="practice-help">${L('Explore freely. Unlock the course in order.','אפשר לחקור בחופשיות. ההתקדמות בקורס לפי הסדר.')}</p><div class="progress-note"><strong data-total-stars>0</strong><span>${L('stars, earned slowly','כוכבים, צעד אחר צעד')}</span></div></aside>
    <section class="score-workspace"><div class="score-heading"><div><p class="panel-label" data-study-number></p><h2 data-study-title></h2></div><span class="key-badge" data-key></span></div><p class="study-brief" data-brief></p><div class="score-legend"><span class="ink-swatch given"></span>${L('given','נתון')}<span class="ink-swatch editable"></span>${L('your notes','הצלילים שלך')}<span class="ink-swatch selected"></span>${L('selected','נבחר')}<span data-meter></span></div><div class="score-viewport" dir="ltr"><div class="score-paper"><div class="paper-title"><strong data-paper-title></strong><span>${L('Original DATTA study · your realization','תרגיל מקורי של DATTA · המימוש שלך')}</span></div><div data-score class="notation-score" aria-label="${L('Editable musical score','פרטיטורה לעריכה')}"></div></div></div><div class="note-entry"><div class="selection-label" data-selection></div><div class="note-edit-actions"><button data-step="-1" aria-label="${L('Previous editable note','התו הקודם לעריכה')}">←</button><button data-step="1" aria-label="${L('Next editable note','התו הבא לעריכה')}">→</button><button data-octave="-12">−8va</button><button data-octave="12">+8va</button><button data-semitone="-1">♭</button><button data-semitone="1">♯</button><button data-clear>${L('Erase','מחיקה')}</button><label><input type="checkbox" data-advance>${L('Advance after entry','מעבר לתו הבא')}</label></div><div class="pitch-palette" data-pitches dir="ltr"></div><p class="keyboard-help">${L('Click a note or empty beat, then choose a pitch. A–G enter notes; ↑/↓ move by scale step; Shift+↑/↓ change a semitone.','בחרו תו או פעמה ריקה ואז צליל. A–G מזינים תווים; ↑/↓ מזיזים בדרגה; Shift+↑/↓ מזיזים בחצי טון.')}</p></div><div class="score-status" data-status role="status" aria-live="polite"></div></section>
    <aside class="theory-coach"><div class="coach-heading"><span>✳</span><div><h2>${L('The listening desk','שולחן ההקשבה')}</h2><p>${L('An exacting, patient companion.','מלווה קפדן וסבלני.')}</p></div></div><div class="coach-grade" data-grade></div><div class="coach-actions"><button data-hint>${L('Suggest one note','הצעה לתו אחד')} ↗</button><button data-example>${L('Hear one realization','האזנה למימוש לדוגמה')} ♫</button></div><div data-hint-card></div><div data-feedback class="coach-feedback"></div><button data-next class="next-study" disabled>${L('Next study','התרגיל הבא')} →</button><details class="coach-library"><summary>${L('On the music stand','על מעמד התווים')}</summary><p>${L('The coach checks stated study rules, not beauty. It accepts different realizations. Fugal studies check a short real answer, not a complete fugue.','המלווה בודק את כללי התרגיל, לא יופי. הוא מקבל מימושים שונים. תרגילי הפוגה בודקים תשובה ריאלית קצרה, לא פוגה שלמה.')}</p>${Object.entries(SOURCES).map(([id,s])=>`<article><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a><p>${esc(he?s.he:s.focus)}</p></article>`).join('')}<p>${L('Notation by VexFlow. Export MusicXML to continue in MuseScore or another score editor.','תיווי באמצעות VexFlow. אפשר לייצא MusicXML ולהמשיך ב-MuseScore או בעורך תווים אחר.')}</p></details></aside></div>`;
    bind();renderAll();
  }
  function renderAll(){
    $('[data-practice]').value=String(index);
    $('[data-study-number]').textContent=L(`STUDY ${index+1} / ${LEVEL_COUNT}`,`תרגיל ${index+1} / ${LEVEL_COUNT}`);
    $('[data-study-title]').textContent=ex.chapterTitle[he?1:0];
    $('[data-paper-title]').textContent=`${String(index+1).padStart(2,'0')}. ${ex.title[he?1:0]}`;
    $('[data-key]').textContent=he?ex.key.he:ex.key.name;
    $('[data-meter]').textContent=`4/4 · ${ex.duration===2?L('half notes','חצאים'):L('quarter notes','רבעים')}`;
    const instructions=[
      L('Complete the missing bass notes beneath the given melody. Follow the bass-degree map; listen for the return home.','השלימו את צלילי הבס מתחת למלודיה הנתונה. עקבו אחרי מפת הדרגות והקשיבו לחזרה הביתה.'),
      L('Realize the figured bass with one upper voice. Use consonant chord tones and avoid parallel fifths and octaves.','ממשו את הבס הממוספר בקול עליון. השתמשו בצלילי אקורד קונסוננטיים והימנעו מקווינטות ואוקטבות מקבילות.'),
      L('Give the bass two independent companions. Keep the voices in order, follow the figures, and make each line sing.','הוסיפו לבס שני קולות עצמאיים. שמרו על סדר הקולות, עקבו אחרי הספרות ותנו לכל קו לשיר.'),
      L('Shape three upper voices over the bass. Every pair matters now: watch crossings, parallel perfect intervals, and large leaps.','עצבו שלושה קולות עליונים מעל הבס. כל זוג קולות חשוב: שימו לב להצטלבויות, מרווחים זכים מקבילים וקפיצות רחבות.'),
      L('Prepare the marked 4–3 suspension: hold the previous pitch over the new bass, then resolve a step down. Matching notes are tied automatically.','הכינו את ההשהיה 4–3: השהו את הצליל הקודם מעל הבס החדש ופתרו בצעד מטה. תווים תואמים נקשרים אוטומטית.'),
      L('The soprano gives a four-note subject. Answer it in the alto, starting at bar 2, a perfect fourth lower (dominant). Complete the surrounding counterpoint.','הסופרן מציג נושא בן ארבעה צלילים. ענו לו באלט בתחילת תיבה 2, קוורטה זכה למטה (דומיננטה). השלימו את הקונטרפונקט שמסביב.'),
    ];
    $('[data-brief]').textContent=instructions[ex.chapter];
    $('[data-levels]').innerHTML=CHAPTERS.map((chapter,c)=>`<div class="study-chapter"><h3><span>${String(c+1).padStart(2,'0')}</span>${chapter[he?1:0]}</h3><div>${Array.from({length:4},(_,j)=>{const i=c*4+j,stars=Number(saved.best[i])||0;return `<button data-level="${i}" ${i>saved.unlocked?'disabled':''} aria-current="${i===index?'step':'false'}" title="${esc(L('Study','תרגיל')+' '+(i+1))}"><span>${i+1}</span><small>${i>saved.unlocked?'·':stars?'★'.repeat(Math.min(3,stars)):'○'}</small></button>`;}).join('')}</div></div>`).join('');
    $('[data-total-stars]').textContent=Object.values(saved.best).filter(n=>Number.isInteger(n)&&n>=0&&n<=3).reduce((a,n)=>a+n,0);
    $('[data-undo]').disabled=!history.length;
    $('[data-next]').disabled=index>=saved.unlocked||index===LEVEL_COUNT-1;
    renderScore();renderInput();renderReport();
  }
  function signature(){const acc={};const order=ex.key.fifths>0?'FCGDAEB':'BEADGCF';for(const c of order.slice(0,Math.abs(ex.key.fifths)))acc[c]=Math.sign(ex.key.fifths);return acc;}
  function renderScore(){
    const host=$('[data-score]');host.innerHTML='';
    const width=Math.max(540,Math.min(940,host.parentElement.clientWidth-40)),perBar=4/ex.duration,measures=Math.ceil(ex.steps/perBar),perSystem=width<760?2:4,systems=Math.ceil(measures/perSystem),height=systems*(ex.parts.length*115+45)+30;
    const renderer=new Renderer(host,Renderer.Backends.SVG);renderer.resize(width,height);const ctx=renderer.getContext(),hits=[];
    for(let system=0;system<systems;system++){
      const bars=Math.min(perSystem,measures-system*perSystem),barWidth=(width-70)/bars;
      for(let m=0;m<bars;m++){
        const measure=system*perSystem+m,x=42+m*barWidth,staves=[],voices=[];
        for(let p=0;p<ex.parts.length;p++){
          const y=system*(ex.parts.length*115+45)+p*115;
          const stave=new Stave(x,y,barWidth);if(m===0){stave.addClef(ex.parts[p].clef);stave.addKeySignature(ex.key.name.replace(' major','').replace(' minor','m').replace('♭','b'));if(system===0)stave.addTimeSignature('4/4');}
          stave.setContext(ctx).draw();staves.push(stave);
          if(m===0){ctx.save();ctx.setFont('Arial',10);ctx.fillText(partName(p),x+4,y+16);ctx.restore();}
          const accidentals={},sig=signature();
          const staveNotes=Array.from({length:perBar},(_,j)=>{
            const i=measure*perBar+j,n=notes[p][i],s=n==null?null:spelling(n,ex.key);
            const note=new StaveNote({clef:ex.parts[p].clef,keys:[s?s.key:ex.parts[p].clef==='bass'?'d/3':'b/4'],duration:(ex.duration===2?'h':'q')+(s?'':'r'),auto_stem:true});
            if(s){const memory=s.step+s.octave,prior=accidentals[memory]??sig[s.step]??0;if(prior!==s.alter)note.addModifier(new Accidental(s.alter===1?'#':s.alter===-1?'b':'n'),0);accidentals[memory]=s.alter;}
            const problem=report?.issues.some(v=>v.part===p&&v.index===i&&v.severity==='error');
            const colour=playIndex===i?'#cb4e28':problem?'#b64536':ex.locked[p][i]?'#555950':'#243e48';note.setStyle({fillStyle:colour,strokeStyle:colour});
            if(n==null)note.setStyle({fillStyle:'#bcc4bf',strokeStyle:'#bcc4bf'});
            if(p===ex.parts.length-1){let label=figures(ex,i);if(ex.chapter===0){const scale=ex.key.mode==='minor'?[0,2,3,5,7,8,11]:[0,2,4,5,7,9,11];label=String(scale.indexOf(pc(ex.model[p][i]-ex.key.offset))+1);}note.addModifier(new Annotation(label).setFont('Arial',10).setVerticalJustification(Annotation.VerticalJustify.BOTTOM),0);}
            hits.push({note,p,i,y,editable:!ex.locked[p][i]});return note;
          });
          voices.push(new Voice({num_beats:4,beat_value:4}).addTickables(staveNotes));
        }
        const startX=Math.max(...staves.map(s=>s.getNoteStartX()));for(const stave of staves)stave.setNoteStartX(startX);
        const formatter=new Formatter();for(const voice of voices)formatter.joinVoices([voice]);formatter.format(voices,Math.max(60,x+barWidth-startX-20));voices.forEach((voice,p)=>voice.draw(ctx,staves[p]));
        if(m===0)new StaveConnector(staves[0],staves.at(-1)).setType(StaveConnector.type.SINGLE_LEFT).setContext(ctx).draw();
        ctx.save();ctx.setFont('Arial',10);ctx.fillText(String(measure+1),x+4,system*(ex.parts.length*115+45)+ex.parts.length*115+22);ctx.restore();
      }
    }
    if(ex.suspension){const {part,index:i}=ex.suspension;if(notes[part][i]!=null&&notes[part][i]===notes[part][i-1]){const before=hits.find(h=>h.p===part&&h.i===i-1),after=hits.find(h=>h.p===part&&h.i===i);if(before.y===after.y)new StaveTie({first_note:before.note,last_note:after.note,first_indices:[0],last_indices:[0]}).setContext(ctx).draw();else{new StaveTie({first_note:before.note,first_indices:[0],last_indices:[0]}).setContext(ctx).draw();new StaveTie({last_note:after.note,first_indices:[0],last_indices:[0]}).setContext(ctx).draw();}}}
    const svg=host.querySelector('svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','group');svg.setAttribute('aria-label',L('Score: select a note to edit','פרטיטורה: בחירת תו לעריכה'));
    for(const h of hits){const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');rect.setAttribute('x',String(h.note.getAbsoluteX()-12));rect.setAttribute('y',String(h.y+25));rect.setAttribute('width','30');rect.setAttribute('height','76');rect.setAttribute('rx','4');const active=selected.part===h.p&&selected.index===h.i;rect.setAttribute('fill',active?'#bc4d2820':playIndex===h.i?'#bc4d2810':'transparent');rect.setAttribute('stroke',active?'#c3522a':'transparent');rect.setAttribute('stroke-dasharray',notes[h.p][h.i]==null?'3 3':'none');rect.dataset.part=String(h.p);rect.dataset.index=String(h.i);rect.setAttribute('role','button');rect.setAttribute('tabindex',h.editable?'0':'-1');rect.setAttribute('aria-disabled',String(!h.editable));rect.setAttribute('aria-pressed',String(active));rect.setAttribute('aria-label',`${partName(h.p)}, ${place(h.i)}, ${notes[h.p][h.i]==null?L('empty','ריק'):spelling(notes[h.p][h.i],ex.key).name}${h.editable?'':L(', given',', נתון')}`);rect.style.cursor=h.editable?'pointer':'default';svg.appendChild(rect);}
  }
  function renderInput(){
    const {part,index:i}=selected,n=notes[part][i],range=ex.parts[part].range;
    $('[data-selection]').innerHTML=`<strong>${partName(part)}</strong><span>${place(i)}</span><b>${n==null?'—':spelling(n,ex.key).name}</b><small>${L('Range','מנעד')}: ${spelling(range[0],ex.key).name}–${spelling(range[1],ex.key).name}</small>`;
    const centre=n??notes[part].slice(0,i).filter(n=>n!=null).at(-1)??Math.round((range[0]+range[1])/2),octave=Math.floor(centre/12)*12;
    const low=Math.max(range[0],octave-2),high=Math.min(range[1],octave+14);
    $('[data-pitches]').innerHTML=Array.from({length:high-low+1},(_,j)=>{const pitch=low+j,s=spelling(pitch,ex.key);return `<button data-pitch="${pitch}" class="${s.alter?'accidental':''} ${n===pitch?'current':''}" aria-label="${s.name}">${s.name}</button>`;}).join('');
  }
  function renderReport(){
    if(!report){$('[data-grade]').innerHTML=`<span>—</span><p>${L('Make a phrase. Then let’s listen.','בנו משפט מוזיקלי. ואז נקשיב.')}</p>`;$('[data-feedback]').innerHTML='';return;}
    const stars=report.passed?(assisted?2:report.score>=96?3:2):0;
    $('[data-grade]').innerHTML=`<span>${report.score}<small>/100</small></span><p>${report.passed?L('A convincing realization.','מימוש משכנע.'):report.coverage<1?L(`${report.filled}/${report.total} notes completed`,`${report.filled}/${report.total} תווים הושלמו`):L('A few voices need attention.','כמה קולות דורשים תשומת לב.')}<b>${'★'.repeat(stars)}</b></p>`;
    const positives=report.passed?`<div class="coach-positive">${L('The assigned notes are complete, the voices stay independent, and the cadence arrives home. Now listen for phrasing.','הצלילים הושלמו, הקולות שומרים על עצמאות והקדנצה מגיעה הביתה. עכשיו הקשיבו לפרזות.')}</div>`:'';
    $('[data-feedback]').innerHTML=positives+report.issues.slice(0,12).map((r,j)=>`<article class="feedback-item ${r.severity}"><button data-issue="${j}"><strong>${partName(r.part)} · ${place(r.index)}</strong><span>${he?r.he:r.en}</span></button><a href="${esc(SOURCES[r.source].url)}" target="_blank" rel="noopener">${esc(SOURCES[r.source].name.split(' · ')[0])} ↗</a></article>`).join('')+(!report.issues.length&&!report.passed?`<p class="coach-placeholder">${L('No rule conflicts in the notes entered so far. Keep completing the blank beats.','לא נמצאו התנגשויות בכללים בצלילים שהוזנו. המשיכו להשלים את הפעימות הריקות.')}</p>`:'');
  }
  function remember(){history.push(notes.map(r=>r.slice()));if(history.length>80)history.shift();}
  function edit(value){const {part,index:i}=selected;if(ex.locked[part][i])return;const [lo,hi]=ex.parts[part].range;if(value!=null&&(value<lo||value>hi)){status(L('That pitch is outside this voice’s study range.','הצליל מחוץ למנעד הקול בתרגיל.'));return;}stop();remember();notes[part][i]=value;report=null;hint=null;$('[data-hint-card]').innerHTML='';persist();if(value!=null)audition(value);if(autoAdvance)step(1,false);renderAll();$('[data-score]').querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});status(L('Saved on this device.','נשמר במכשיר הזה.'));}
  function focusNote(){$('[data-score]').querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});}
  function step(delta,render=true){for(let i=selected.index+delta;i>=0&&i<ex.steps;i+=delta)if(!ex.locked[selected.part][i]){selected={...selected,index:i};break;}if(render){renderScore();renderInput();focusNote();}}
  function evaluate(){report=analyze(ex,notes);if(report.passed){const stars=assisted?2:report.score>=96?3:2;saved.best[index]=Math.max(Number(saved.best[index])||0,stars);if(index<=saved.unlocked)saved.unlocked=Math.max(saved.unlocked,Math.min(LEVEL_COUNT-1,index+1));persist();}renderAll();status(report.passed?L('Study complete. Your stars are saved.','התרגיל הושלם. הכוכבים נשמרו.'):L('Feedback is ready. Select a comment to find its notes.','המשוב מוכן. בחרו הערה כדי למצוא את הצלילים שלה.'));}
  function load(i,explore=false){if(!Number.isInteger(i)||i<0||(!explore&&i>saved.unlocked)||i>=LEVEL_COUNT)return;stop();index=i;ex=makeExercise(index);notes=validSavedNotes(ex,saved.studies[ex.id]?.notes)?saved.studies[ex.id].notes:initialNotes(ex);assisted=Boolean(saved.studies[ex.id]?.assisted);history=[];report=null;hint=null;selected=firstEditable();$('[data-hint-card]').innerHTML='';persist();renderAll();status(L('A new study. Take your time.','תרגיל חדש. קחו את הזמן.'));}
  function audio(){context??=new(window.AudioContext||window.webkitAudioContext)();return context;}
  function sound(ctx,note,time,duration,volume=.15){const master=ctx.createGain(),soft=$('[data-instrument]').value==='soft';master.gain.setValueAtTime(.0001,time);master.gain.exponentialRampToValueAtTime(volume,time+.018);master.gain.exponentialRampToValueAtTime(volume*(soft?.55:.18),time+Math.min(.25,duration*.4));master.gain.exponentialRampToValueAtTime(.0001,time+duration+.12);master.connect(ctx.destination);const osc=ctx.createOscillator();osc.type=soft?'triangle':'sine';osc.frequency.value=440*2**((note-69)/12);osc.connect(master);osc.start(time);osc.stop(time+duration+.14);nodes.push(osc);if(!soft){const overtone=ctx.createOscillator(),gain=ctx.createGain();gain.gain.value=.24;overtone.frequency.value=osc.frequency.value*2;overtone.type='triangle';overtone.connect(gain);gain.connect(master);overtone.start(time);overtone.stop(time+duration+.14);nodes.push(overtone);}}
  async function audition(note){try{const ctx=audio();await ctx.resume();sound(ctx,note,ctx.currentTime,.35,.12);}catch{status(L('Sound is unavailable in this browser. You can export MIDI.','הצליל אינו זמין בדפדפן. אפשר לייצא MIDI.'));}}
  function stop(){transportId++;for(const n of nodes)try{n.stop();}catch{}nodes=[];timers.forEach(clearTimeout);timers=[];playing=false;playIndex=-1;if($('[data-play]'))$('[data-play]').innerHTML=`▶ <span>${L('Listen','האזנה')}</span>`;}
  async function play(example=false){stop();const id=transportId;try{const ctx=audio();await ctx.resume();if(id!==transportId)return;playing=true;const data=example?ex.model:notes,seconds=60/tempo*ex.duration,start=ctx.currentTime+.06,solo=$('[data-solo]').checked;data.forEach((row,p)=>row.forEach((n,i)=>{const span=noteSpan(ex,data,p,i);if(n!=null&&span&&(!solo||p===selected.part))sound(ctx,n,start+i*seconds,seconds*(span-.1),p===data.length-1?.1:.13);}));$('[data-play]').innerHTML=`❚❚ <span>${L('Playing','מנגן')}</span>`;status(example?L('Listening to one possible realization. Your notes are unchanged.','האזנה למימוש אפשרי אחד. הצלילים שלכם לא השתנו.'):L('Playing your composition.','מנגן את היצירה שלכם.'));for(let i=0;i<ex.steps;i++)timers.push(setTimeout(()=>{playIndex=i;renderScore();},(i*seconds+.06)*1000));timers.push(setTimeout(()=>{stop();renderScore();status(L('Playback finished.','הנגינה הסתיימה.'));},(ex.steps*seconds+.3)*1000));}catch{stop();status(L('Sound is unavailable. Export MIDI to listen in a score editor.','הצליל אינו זמין. אפשר לייצא MIDI ולהאזין בעורך תווים.'));}}
  function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function bind(){
    root.addEventListener('click',event=>{
      const t=event.target.closest('button,[data-part]');if(!t)return;
      if(t.hasAttribute('data-part')){const p=Number(t.dataset.part),i=Number(t.dataset.index);if(ex.locked[p][i]){status(L('This note is given. Choose an empty beat or one of your notes.','זהו תו נתון. בחרו פעמה ריקה או תו שלכם.'));return;}selected={part:p,index:i};renderScore();renderInput();focusNote();}
      else if(t.hasAttribute('data-level'))load(Number(t.dataset.level));
      else if(t.hasAttribute('data-pitch'))edit(Number(t.dataset.pitch));
      else if(t.hasAttribute('data-step'))step(Number(t.dataset.step));
      else if(t.hasAttribute('data-octave')||t.hasAttribute('data-semitone'))edit((notes[selected.part][selected.index]??Math.round(ex.parts[selected.part].range.reduce((a,b)=>a+b)/2))+Number(t.dataset.octave||t.dataset.semitone));
      else if(t.hasAttribute('data-clear'))edit(null);
      else if(t.hasAttribute('data-undo')){stop();if(history.length){notes=history.pop();report=null;persist();renderAll();}}
      else if(t.hasAttribute('data-reset')){stop();remember();notes=initialNotes(ex);report=null;assisted=false;selected=firstEditable();persist();renderAll();}
      else if(t.hasAttribute('data-analyze'))evaluate();
      else if(t.hasAttribute('data-play')){if(playing){stop();renderScore();}else play();}
      else if(t.hasAttribute('data-stop')){stop();renderScore();status(L('Playback stopped.','הנגינה נעצרה.'));}
      else if(t.hasAttribute('data-example'))play(true);
      else if(t.hasAttribute('data-next'))load(index+1);
      else if(t.hasAttribute('data-hint')){hint=suggest(ex,notes,notes[selected.part][selected.index]==null?selected:null);if(hint){selected={part:hint.part,index:hint.index};$('[data-hint-card]').innerHTML=`<div class="hint-card"><strong>${L('Try','נסו')} ${spelling(hint.note,ex.key).name}</strong><p>${partName(hint.part)} · ${place(hint.index)}</p><p>${L('This is a candidate from the local rule checker. Listen to its neighbours before deciding.','זוהי הצעה של בודק הכללים המקומי. הקשיבו לצלילים השכנים לפני ההחלטה.')}</p><button data-apply-hint>${L('Write this note','כתיבת התו')}</button></div>`;renderScore();renderInput();}else status(L('Your study is complete. Ask the coach for a final review.','התרגיל מלא. בקשו מהמלווה סקירה מסכמת.'));}
      else if(t.hasAttribute('data-apply-hint')&&hint){const h=hint;selected={part:h.part,index:h.index};assisted=true;edit(h.note);}
      else if(t.hasAttribute('data-issue')){const r=report?.issues[Number(t.dataset.issue)];if(r){selected={part:r.part,index:r.index};renderScore();renderInput();}}
      else if(t.hasAttribute('data-export')){if(t.dataset.export==='xml')download(`datta-study-${index+1}.musicxml`,musicXML(ex,notes,tempo),'application/vnd.recordare.musicxml+xml');else download(`datta-study-${index+1}.mid`,midiFile(ex,notes,tempo),'audio/midi');status(L('Exported. Open the file in MuseScore or another notation editor.','יוצא. אפשר לפתוח את הקובץ ב-MuseScore או בעורך תווים אחר.'));}
      else if(t.hasAttribute('data-print'))window.print();
    });
    $('[data-tempo]').addEventListener('change',e=>{tempo=Math.max(40,Math.min(160,Number(e.target.value)||80));e.target.value=String(tempo);if(playing)play();});
    $('[data-advance]').addEventListener('change',e=>autoAdvance=e.target.checked);
    $('[data-practice]').addEventListener('change',e=>load(Number(e.target.value),true));
    root.addEventListener('keydown',event=>{
      if(event.target.matches('input,select,textarea')||event.altKey||event.metaKey)return;
      if(event.ctrlKey&&event.key.toLowerCase()==='z'){event.preventDefault();$('[data-undo]').click();return;}if(event.ctrlKey)return;
      const key=event.key,n=notes[selected.part][selected.index]??Math.round(ex.parts[selected.part].range.reduce((a,b)=>a+b)/2);
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Delete','Backspace'].includes(key)){event.preventDefault();if(key==='ArrowLeft'||key==='ArrowRight')step(key==='ArrowLeft'?-1:1);else if(key==='Delete'||key==='Backspace')edit(null);else{let next=n+(key==='ArrowUp'?1:-1);if(!event.shiftKey){const scale=ex.key.mode==='minor'?[0,2,3,5,7,8,11]:[0,2,4,5,7,9,11];while(!scale.includes(pc(next-ex.key.offset)))next+=key==='ArrowUp'?1:-1;}edit(next);}return;}
      if(/^[a-g]$/i.test(key)){event.preventDefault();const [lo,hi]=ex.parts[selected.part].range,candidates=Array.from({length:hi-lo+1},(_,i)=>lo+i).filter(m=>spelling(m,ex.key).step===key.toUpperCase());candidates.sort((a,b)=>Math.abs(a-n)-Math.abs(b-n));if(candidates.length)edit(candidates[0]);}
      if((key==='Enter'||key===' ')&&event.target.hasAttribute('data-part')){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();renderScore();}});
    window.addEventListener('pagehide',stop);
    window.addEventListener('resize',()=>requestAnimationFrame(renderScore));
  }
  buildShell();
}
