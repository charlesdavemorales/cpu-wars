'use strict';
const { TOTAL, assess }=require('./challenges');
const {currentMission}=require('./mission-order');
function score(team){return Math.max(0,team.results.reduce((a,r)=>a+(r?.score||0),0)-team.crashes*10);}
function attempt(team, raw, now=Date.now()){
 if(team.status!=='playing') throw Error('Your team is not in an active mission.');
 if(team.index>=TOTAL) throw Error('All missions have been completed.');
 if(now-team.lastAttempt<900) throw Error('Allow a moment between CPU tests.');
 team.lastAttempt=now;
 const result=assess(currentMission(team),raw,team.variant||0);
 team.config=result.config;
 team.attempts++;
 const before=team.heat;
 // One missed criterion adds damage, even when main objective succeeds.
 const delta=result.score===20 ? -6 : result.passed ? Math.max(6,(20-result.score)*3) : 24;
 team.heat=Math.min(100,Math.max(0,team.heat+delta));
 const feedback={ mission:team.index+1, result,  heatBefore:before, heatAfter:team.heat, heatChange:team.heat-before,
   message:result.score===20?'Perfect optimization: the CPU cools slightly.':result.passed?'Mission passed, but missed optimization criteria increased CPU heat.':'Processing objective FAILED: the CPU overheats from the mistake.'};
 team.lastFeedback=feedback;
 if(team.heat>=100){team.status='crashed';team.crashes++;feedback.message='CPU CRASH! Previously earned points are saved. Your team can retry this mission with a 420-second ranking penalty and a 10-point mission-score deduction. Your timer continues.';}
 else if(result.passed){
   team.results[team.index]={score:result.score,attempts:team.attempts,heat:team.heat,breakdown:result.breakdown};
   team.status=team.index===TOTAL-1?'finished':'debrief';
   if(team.status==='finished')team.finishedAt=now;
   team.nextAt=team.status==='debrief'?now+8000:null;
 }
 // Failure stays on the same mission. A successful submission is stored only once.
 return feedback;
}
function advance(team){
 if(team.status!=='debrief') return false;
 team.index++;
 team.attempts=0;
 team.lastAttempt=0;
 team.nextAt=null;
 team.lastFeedback=null;
 team.status=team.index>=TOTAL?'finished':'playing';
 return true;
}
function retry(team){
 if(team.status!=='crashed') throw Error('Your CPU has not crashed.');
 team.status='playing'; team.heat=25;team.attempts=0;team.lastAttempt=0;team.nextAt=null;team.lastFeedback=null;
 return team;
}
module.exports={score,attempt,advance,retry};
