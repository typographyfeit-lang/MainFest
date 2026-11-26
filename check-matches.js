'use strict';
// Headless fixed-tick game test, no GPU. Simulated player (not a human or balance test).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
function element(){return {textContent:'',innerHTML:'',children:[],style:{},dataset:{},hidden:false,value:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element()},setAttribute(){}}}
const els=new Map();let seed=1;const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const context=vm.createContext({Math:math,console,document:{querySelector:k=>{if(!els.has(k))els.set(k,element());return els.get(k)},querySelectorAll:()=>[],addEventListener(){},hidden:false},localStorage:{getItem:()=>null,setItem(){}},performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},V:{ok:false,begin(){},stop(){},frame(){},preview(){}},setTimeout,clearTimeout});
vm.runInContext(fs.readFileSync(path.join(__dirname,'game.js'),'utf8'),context);const results=[];
for(const difficulty of ['easy','normal','hard'])for(let i=0;i<6;i++){
 seed=331+i*173;const r=vm.runInContext(`(()=>{S.difficulty='${difficulty}';S.deck=['guard','mage','colossus','spark'];start();let maxUnits=0,casts=0;
 for(let i=0;i<5401&&!G.done;i++){
  if(i%72===0){const ready=G.hand.filter(id=>G.cool[0][id]<=0);if(ready.length){const enemies=G.u.filter(u=>u.team===1);let id=ready[Math.floor(Math.random()*ready.length)];if(id==='spark'){const p=enemies.find(u=>enemies.filter(v=>dist(u,v)<30).length>=2)||enemies[0]||{x:180,y:52};if(playRune(0,id,p))casts++}else{const x=G.shrine.next<15?180:[96,180,264][Math.floor(Math.random()*3)];if(playRune(0,id,{x,y:335}))casts++}}}
  step(FIXED);maxUnits=Math.max(maxUnits,G.u.length);
  if(G.u.some(u=>!Number.isFinite(u.x+u.y+u.hp)||u.x<0||u.x>W||u.y<0||u.y>H))throw Error('Invalid unit state');
 }return JSON.stringify({done:!!G.done,result:G.result,seconds:Math.round(180-G.t),core:[Math.round(ratio(0)*100),Math.round(ratio(1)*100)],awards:G.shrine.awards,maxUnits,casts})})()`,context);
 const m=JSON.parse(r);assert(m.done);assert(m.maxUnits<=72);assert(m.awards.reduce((a,b)=>a+b,0)<=5);assert(m.casts>0);results.push({difficulty,seedIndex:i,...m});}
console.log(JSON.stringify({test:'18 complete deterministic simulated matches; not playtesting',results},null,2));
