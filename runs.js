'use strict';
const Progress=require('./progression');
const Ranking=require('./rankings');
const {missionOrder}=require('./mission-order');
const {TOTAL}=require('./challenges');
function displayName(team){return `${team.name}-${team.runNumber||1}`;}
function takeSnapshot(team){
 if(team.status!=='finished'||!Number.isFinite(team.finishedAt))throw Error('Only completed runs can be archived.');
 return {id:`${team.id}:${team.runNumber}`,teamId:team.id,runNumber:team.runNumber,name:displayName(team),
  memberRecords:team.members.map(m=>({name:m.name,studentId:m.studentId,role:m.role})),
  missionOrder:[...team.missionOrder],variant:team.variant,results:team.results.map(r=>r?{...r}:null),
  completed:team.results.filter(Boolean).length,score:Progress.score(team),heat:team.heat,life:100-team.heat,crashes:team.crashes,
  status:'finished',startedAt:team.startedAt,finishedAt:team.finishedAt};
}
function archive(team){
 team.history=team.history||[];
 const id=`${team.id}:${team.runNumber||1}`;
 if(team.history.some(r=>r.id===id))return false;
 team.history.push(takeSnapshot(team));return true;
}
function currentRow(team){
 return {id:`${team.id}:${team.runNumber||1}`,teamId:team.id,runNumber:team.runNumber||1,name:displayName(team),
  memberRecords:team.members.map(m=>({name:m.name,studentId:m.studentId,role:m.role})),missionOrder:[...team.missionOrder],variant:team.variant,results:team.results,
  completed:team.results.filter(Boolean).length,score:Progress.score(team),heat:team.heat,life:100-team.heat,
  crashes:team.crashes,status:team.status,startedAt:team.startedAt,finishedAt:team.finishedAt};
}
function allRows(teams,now=Date.now()){
 return teams.flatMap(t=>{
  const history=t.history||[];
  const current=history.some(h=>h.runNumber===(t.runNumber||1))?[]:[currentRow(t)];
  return [...history,...current].map(r=>({...r,members:r.memberRecords.map(m=>m.name),online:r.status==='finished'?0:t.members.filter(m=>m.socketId).length,
   elapsedMs:Ranking.durationMs(r,now),adjustedSeconds:Ranking.adjustedSeconds(r,now)}));
 });
}
function startReplay(team,now=Date.now()){
 if(team.status!=='finished')throw Error('Finish all 10 missions before starting another attempt.');
 archive(team);
 team.runNumber=(team.runNumber||1)+1;
 if(!Number.isInteger(team.orderSeed)||team.orderSeed<=0)throw Error('Run seed is missing; contact the host.');
 team.missionOrder=missionOrder(team.orderSeed,team.runNumber);
 team.index=0;team.status='playing';team.startedAt=now;team.finishedAt=null;
 team.heat=0;team.crashes=0;team.attempts=0;team.lastAttempt=0;team.results=Array(TOTAL).fill(null);
 team.lastFeedback=null;team.nextAt=null;team.variant=(team.variant+1)%10000;
 return team;
}
module.exports={displayName,takeSnapshot,archive,currentRow,allRows,startReplay};
