import test from 'node:test';import assert from 'node:assert/strict';
import {move,spawn,suggest,over,directions} from '../src/assets/counterpoint-engine.js';
test('tiles merge once per move, with correct score',()=>{const a=move([2,2,2,2,...Array(12).fill(0)],'left');assert.deepEqual(a.board.slice(0,4),[4,4,0,0]);assert.equal(a.score,8);assert.equal(a.changed,true);});
test('vertical movement and non-move',()=>{const a=move([2,0,0,0,2,0,0,0,...Array(8).fill(0)],'down');assert.equal(a.board[12],4);assert.equal(a.score,4);assert.equal(move(a.board,'down').changed,false);});
test('spawn only fills an empty cell, preserves input',()=>{const a=[2,...Array(15).fill(0)];const b=spawn(a,()=>0);assert.equal(b[0],2);assert.equal(b[1],2);assert.equal(a[1],0);});
test('bot always chooses a legal move, and detects game over',()=>{let b=spawn(spawn(Array(16).fill(0)));for(let i=0;i<300;i++){const d=suggest(b);if(d===null){assert.equal(over(b),true);break;}assert.ok(directions.includes(d));const m=move(b,d);assert.equal(m.changed,true);b=spawn(m.board);}assert.equal(over([2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2]),true);});
test('mass is conserved by every slide',()=>{for(let i=0;i<80;i++){const b=Array.from({length:16},()=>Math.random()<.3?0:2**(1+Math.floor(Math.random()*5)));for(const d of directions)assert.equal(move(b,d).board.reduce((a,v)=>a+v,0),b.reduce((a,v)=>a+v,0));}});

