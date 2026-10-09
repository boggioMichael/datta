// Original implementation of the 2048 merge mechanic; no third-party game assets.
export const directions=['left','up','right','down'];
export function move(board,direction){
 if(!directions.includes(direction))throw Error('Unknown direction');
 const result=board.slice();let score=0;
 for(let line=0;line<4;line++){
  const indices=Array.from({length:4},(_,i)=>direction==='left'?line*4+i:direction==='right'?line*4+3-i:direction==='up'?i*4+line:(3-i)*4+line);
  const values=indices.map(i=>board[i]).filter(Boolean),merged=[];
  for(let i=0;i<values.length;i++){if(values[i]===values[i+1]){merged.push(values[i]*2);score+=values[i]*2;i++;}else merged.push(values[i]);}
  while(merged.length<4)merged.push(0);indices.forEach((index,i)=>result[index]=merged[i]);
 }
 return {board:result,score,changed:result.some((v,i)=>v!==board[i])};
}
export function spawn(board,rng=Math.random){const empty=board.flatMap((v,i)=>v?[]:[i]);if(!empty.length)return board.slice();const b=board.slice();b[empty[Math.min(empty.length-1,Math.floor(rng()*empty.length))]]=rng()<.9?2:4;return b;}
export function over(board){return directions.every(d=>!move(board,d).changed);}
function evaluate(b){let value=b.filter(v=>v===0).length*280;const max=Math.max(...b),corners=[0,3,12,15];if(corners.some(i=>b[i]===max))value+=Math.log2(max||1)*90;for(let y=0;y<4;y++)for(let x=0;x<4;x++){const i=y*4+x;if(x<3)value-=Math.abs(Math.log2(b[i]||1)-Math.log2(b[i+1]||1))*10;if(y<3)value-=Math.abs(Math.log2(b[i]||1)-Math.log2(b[i+4]||1))*10;}return value;}
// Two-step expected-value search. The bot sees exactly the board the player sees.
export function suggest(board){let best=null,bestValue=-Infinity;for(const d of directions){const m=move(board,d);if(!m.changed)continue;const cells=m.board.flatMap((v,i)=>v?[]:[i]);let expected=0;for(const i of cells){const b=m.board.slice();b[i]=2;expected+=Math.max(...directions.map(next=>{const n=move(b,next);return evaluate(n.board)+n.score;}));}const score=m.score+evaluate(m.board)+(cells.length?expected/cells.length:0);if(score>bestValue){bestValue=score;best=d;}}return best;}
