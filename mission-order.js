'use strict';
const {TOTAL, ORIGINAL_COUNT, BANK_COUNT}=require('./challenges');
// Seeded shuffle: server alone chooses and stores a team's repeat-run seed.
function rng(seed){let x=(seed>>>0)||1;return ()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x;};}
function shuffle(items,seed){const next=rng(seed),a=[...items];for(let i=a.length-1;i>0;i--){const j=next()%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
const oldIds=()=>Array.from({length:ORIGINAL_COUNT},(_,i)=>i);
const newIds=()=>Array.from({length:BANK_COUNT-ORIGINAL_COUNT},(_,i)=>i+ORIGINAL_COUNT);
function missionOrder(seed,runNumber=1){
 if(!Number.isInteger(runNumber)||runNumber<1)throw Error('Invalid attempt number.');
 if(runNumber===1)return shuffle(oldIds(),seed);
 // Every repeat: five original missions plus five extra missions.
 // Five original missions are not repeated until the other five have appeared.
 // The 15 extra missions rotate in three blocks of five before their pool reshuffles.
 const n=runNumber-2,oldCycle=Math.floor(n/2),newCycle=Math.floor(n/3);
 const old=shuffle(oldIds(),(seed ^ Math.imul(oldCycle+1,0x9e3779b1))>>>0).slice((n%2)*5,(n%2+1)*5);
 const fresh=shuffle(newIds(),(seed ^ Math.imul(newCycle+1,0x85ebca6b))>>>0).slice((n%3)*5,(n%3+1)*5);
 return shuffle([...old,...fresh],(seed ^ Math.imul(runNumber,0xc2b2ae35))>>>0);
}
function currentMission(team){return (team.missionOrder||oldIds())[team.index];}
function validOrder(o,runNumber=1){
 if(!Array.isArray(o)||o.length!==TOTAL||new Set(o).size!==TOTAL||!o.every(x=>Number.isInteger(x)&&x>=0&&x<BANK_COUNT))return false;
 if(runNumber===1)return o.every(x=>x<ORIGINAL_COUNT)&&new Set(o).size===ORIGINAL_COUNT;
 return o.filter(x=>x<ORIGINAL_COUNT).length===5&&o.filter(x=>x>=ORIGINAL_COUNT).length===5;
}
module.exports={missionOrder,currentMission,validOrder};
