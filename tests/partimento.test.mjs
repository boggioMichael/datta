import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExercise,initialNotes,analyze,suggest,validSavedNotes,spelling,musicXML,midiFile,noteSpan,LEVEL_COUNT} from '../src/assets/partimento-engine.js';
test('all 24 studies have a complete, passing model and playable missing notes',()=>{
 for(let i=0;i<LEVEL_COUNT;i++){const e=makeExercise(i),r=analyze(e,e.model);assert.equal(r.passed,true,`Study ${i+1}: ${JSON.stringify(r.issues)}`);assert.equal(r.score,100);assert.equal(analyze(e,initialNotes(e)).passed,false);assert.ok(r.total>0);assert.equal(validSavedNotes(e,e.model),true);}
});
test('each chapter removes scaffolding as its studies progress',()=>{
 for(let c=0;c<6;c++){let prior=0;for(let j=0;j<4;j++){const e=makeExercise(c*4+j),n=analyze(e,initialNotes(e)).total;assert.ok(n>=prior);prior=n;}}
});
test('parallel fifths are flagged; an unchanged reference is not penalized',()=>{
 const e=makeExercise(7),n=e.model.map(r=>r.slice()),bass=n.at(-1);n[0][0]=bass[0]+19;n[0][1]=bass[1]+19;
 assert.ok(analyze(e,n).issues.some(i=>i.rule==='parallel'&&i.index===1));
 assert.equal(analyze(e,e.model).issues.some(i=>i.rule==='parallel'),false);
});
test('crossing, unsupported harmony, and failed cadence receive specific feedback',()=>{
 const e=makeExercise(11),n=e.model.map(r=>r.slice());n[0][2]=n[1][2]-1;n[0][7]=e.model[0][7]-2;
 const rules=analyze(e,n).issues.map(i=>i.rule);assert.ok(rules.includes('crossing'));assert.ok(rules.includes('harmony'));assert.ok(rules.includes('cadence'));
});
test('suspension must be prepared and resolve down; fugal answer keeps its interval pattern',()=>{
 const e=makeExercise(19),n=e.model.map(r=>r.slice());n[0][12]-=1;assert.ok(analyze(e,n).issues.some(i=>i.rule==='suspension'));
 const f=makeExercise(23),answer=f.model.map(r=>r.slice());answer[1][5]++;assert.ok(analyze(f,answer).issues.some(i=>i.rule==='answer'));
});
test('hints propose a legal editable note and never edit the composition',()=>{
 for(let i=0;i<24;i++){const e=makeExercise(i),notes=initialNotes(e),before=JSON.stringify(notes),h=suggest(e,notes);assert.ok(h);assert.equal(e.locked[h.part][h.index],false);assert.ok(h.note>=e.parts[h.part].range[0]&&h.note<=e.parts[h.part].range[1]);assert.equal(JSON.stringify(notes),before);}
});
test('corrupted saves and altered givens are rejected',()=>{
 const e=makeExercise(0),n=initialNotes(e);assert.equal(validSavedNotes(e,n),true);n[0][0]++;assert.equal(validSavedNotes(e,n),false);assert.equal(validSavedNotes(e,[]),false);
});
test('MusicXML exports complete measures, correct pitch spelling and duration in every key',()=>{
 const natural={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
 for(let i=0;i<24;i++){const e=makeExercise(i),xml=musicXML(e,e.model,96);assert.match(xml,/<score-partwise version="4.0">/);assert.equal((xml.match(/<note>/g)||[]).length,e.parts.length*e.steps);for(const n of e.model.flat()){const s=spelling(n,e.key);assert.equal((s.octave+1)*12+natural[s.step]+s.alter,n);}assert.match(xml,/<sound tempo="96"/);assert.equal((xml.match(/<duration>/g)||[]).length,e.parts.length*e.steps);}
});
test('MIDI export has a valid single-track header and nonempty track',()=>{
 const e=makeExercise(23),m=midiFile(e,e.model);assert.equal(new TextDecoder().decode(m.slice(0,4)),'MThd');assert.equal(new TextDecoder().decode(m.slice(14,18)),'MTrk');assert.equal(new DataView(m.buffer).getUint32(18),m.length-22);assert.deepEqual([...m.slice(-4)],[0,255,47,0]);
});
test('prepared suspensions sustain once and export start/stop ties',()=>{
 for(let i=16;i<20;i++){const e=makeExercise(i),{part,index}=e.suspension,xml=musicXML(e,e.model);assert.equal(noteSpan(e,e.model,part,index-1),2);assert.equal(noteSpan(e,e.model,part,index),0);assert.equal((xml.match(/<tie type="start"/g)||[]).length,1);assert.equal((xml.match(/<tie type="stop"/g)||[]).length,1);const changed=e.model.map(r=>r.slice());changed[part][index-1]--;assert.equal(noteSpan(e,changed,part,index),1);assert.doesNotMatch(musicXML(e,changed),/<tie /);}
});
