'use strict';
const HEAT_SECONDS=5, CRASH_SECONDS=420;
function durationMs(t,now=Date.now()){
 if(!Number.isFinite(t.startedAt))return 0;
 return Math.max(0,(Number.isFinite(t.finishedAt)?t.finishedAt:now)-t.startedAt);
}
function adjustedSeconds(t,now=Date.now()){
 return Math.ceil(durationMs(t,now)/1000)+t.heat*HEAT_SECONDS+t.crashes*CRASH_SECONDS;
}
function compare(a,b){
 const af=a.status==='finished', bf=b.status==='finished';
 if(af!==bf)return af?-1:1;
 if(!af && a.completed!==b.completed)return b.completed-a.completed;
 return a.adjustedSeconds-b.adjustedSeconds || b.life-a.life || a.name.localeCompare(b.name);
}
function rank(rows){
 const list=[...rows].sort(compare);let prev=null,r=0;
 return list.map((x,i)=>{const signature=[x.status==='finished',x.status==='finished'?10:x.completed,x.adjustedSeconds,x.life].join('/');
   if(signature!==prev)r=i+1;prev=signature;return {...x,rank:r};});
}
module.exports={HEAT_SECONDS,CRASH_SECONDS,durationMs,adjustedSeconds,compare,rank};
