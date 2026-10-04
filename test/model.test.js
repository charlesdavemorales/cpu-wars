'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Model=require('../public/model');
const Challenge=require('../challenges');
const Progress=require('../progression');
const Ranking=require('../rankings');
const Orders=require('../mission-order');
const {assign,assignRole}=require('../teams');
const Runs=require('../runs');
function best(m){const p=m.parameters;switch(m.type){case 0:case 2:case 3:return p.opt;case 1:return {freq:p.optFreq,voltage:p.optVoltage};case 4:return {awake:p.minAwake,mode:'deep',sensor:true,radio:true};}}
function team(order=Array.from({length:10},(_,i)=>i)){return {index:0,status:'playing',heat:0,crashes:0,attempts:0,lastAttempt:0,results:Array(10).fill(null),missionOrder:order,variant:0,config:{...Model.defaultConfigs[order[0]%5]},lastFeedback:null,nextAt:null,startedAt:1000,finishedAt:null};}
test('exactly 10 graded missions, all with full-credit solutions and lessons',()=>{
 const names=new Set();
 for(let i=0;i<10;i++){const m=Challenge.missionFor(i);assert.equal(m.number,i+1);assert.ok(m.brief.length>50);assert.ok(m.goal.length>20);assert.ok(m.lesson.length>25);assert.equal(Challenge.assess(i,best(m)).score,20);names.add(m.brief);}
 assert.equal(names.size,10);assert.equal(Challenge.BANK_COUNT,25);assert.throws(()=>Challenge.missionFor(25));
});
test('each order is a valid permutation; 10 tasks remain the same while sequence and story vary',()=>{
 const first=Orders.missionOrder(1),second=Orders.missionOrder(15);assert.ok(Orders.validOrder(first));assert.ok(Orders.validOrder(second));assert.notDeepEqual(first,second);
 assert.notEqual(Challenge.missionFor(0,0).scenario,Challenge.missionFor(0,1).scenario);
 assert.deepEqual(Challenge.missionFor(0,0).parameters,Challenge.missionFor(0,1).parameters);
});
test('a shuffled team can complete every mission with optimal configuration',()=>{
 const t=team(Orders.missionOrder(1337));let now=2000;
 while(t.status!=='finished'){
  const current=Orders.currentMission(t);const result=Progress.attempt(t,best(Challenge.missionFor(current,t.variant)),now);assert.equal(result.result.score,20);
  if(t.status==='debrief')assert.ok(Progress.advance(t));now+=1000;
 }
 assert.equal(t.results.filter(Boolean).length,10);assert.equal(Progress.score(t),200);assert.equal(t.finishedAt,now-1000);
});
test('unsafe CPU configurations fail the objective and raise heat',()=>{
 const cases=[{core:'off',graphics:'run',radio:'run',timer:'run'},{freq:2,voltage:.7},{control:'run',sensor:'off',network:'off',accelerator:'off'},{freq:2,cores:4,cooling:false},{awake:4,mode:'deep',sensor:true,radio:false}];
 for(let i=0;i<5;i++){assert.equal(Challenge.assess(i,cases[i]).passed,false);}
 const t=team();const f=Progress.attempt(t,cases[0],2000);assert.equal(f.result.passed,false);assert.equal(t.heat,24);
});
test('voltage has squared effect on switching power at fixed frequency',()=>{
 const a=Model.simulate(1,{freq:1.4,voltage:.9}).values.dynamic;
 const b=Model.simulate(1,{freq:1.4,voltage:1.2}).values.dynamic;
 assert.ok(Math.abs(a/b-0.5625)<1e-9);
});
test('incomplete teams accept late joining but never exceed three students',()=>{
 const a={id:'a',members:[]},b={id:'b',members:[]},all=[a,b];assert.equal(assign(all,null),a);
 assert.equal(assignRole(a),'reader');a.members.push({role:'reader'});
 assert.equal(assignRole(a),'engineer');a.members.push({role:'engineer'});
 assert.equal(assign(all,'a'),a);a.members.push({role:'engineer'});
 assert.equal(assign(all,null),b);assert.throws(()=>assign(all,'a'),/three members/);
});
test('partially correct submissions pass but damage the CPU',()=>{
 const t=team();const f=Progress.attempt(t,{core:'run',graphics:'off',radio:'off',timer:'run'},2000);
 assert.equal(f.result.passed,true);assert.ok(f.result.score<20);assert.ok(t.heat>0);assert.equal(t.status,'debrief');assert.ok(Progress.advance(t));
});
test('CPU crash saves prior points; retry does not change the start time',()=>{
 const t=team();Progress.attempt(t,best(Challenge.missionFor(0)),2000);assert.equal(t.results[0].score,20);Progress.advance(t);
 for(let i=1;i<=5 && t.status==='playing';i++)Progress.attempt(t,{freq:2,voltage:.7},2000+1000*i);
 assert.equal(t.status,'crashed');assert.equal(t.crashes,1);assert.equal(t.heat,100);assert.equal(Progress.score(t),10);
 const timer=t.startedAt;Progress.retry(t);assert.equal(t.status,'playing');assert.equal(t.heat,25);assert.equal(t.startedAt,timer);
});
test('a completed stage cannot be submitted twice for repeat points',()=>{
 const t=team();Progress.attempt(t,best(Challenge.missionFor(0)),2000);
 assert.throws(()=>Progress.attempt(t,best(Challenge.missionFor(0)),3000),/not in an active mission/);
});
test('ranking prioritizes finishers and uses time, life and crash penalties',()=>{
 const now=1_000_000;
 const r=[{name:'FastHot',completed:10,status:'finished',startedAt:0,finishedAt:300_000,heat:70,crashes:0,life:30},
 {name:'SteadyCool',completed:10,status:'finished',startedAt:0,finishedAt:360_000,heat:10,crashes:0,life:90},
 {name:'Crashes',completed:10,status:'finished',startedAt:0,finishedAt:225_000,heat:5,crashes:1,life:95},
 {name:'Racing',completed:9,status:'playing',startedAt:0,finishedAt:null,heat:0,crashes:0,life:100}].map(x=>({...x,adjustedSeconds:Ranking.adjustedSeconds(x,now)}));
 assert.deepEqual(Ranking.rank(r).map(x=>x.name),['SteadyCool','FastHot','Crashes','Racing']);
 assert.equal(Ranking.durationMs(r[0],now),300000);assert.equal(Ranking.durationMs(r[3],now),now);
});
test('a deliberate crash/retry cannot gain ranking advantage solely by resetting heat',()=>{
 const before={startedAt:0,finishedAt:1000,heat:100,crashes:0};
 const after={startedAt:0,finishedAt:1000,heat:25,crashes:1};
 assert.ok(Ranking.adjustedSeconds(after)>Ranking.adjustedSeconds(before));
});

// Ensure the activity stays anchored to the uploaded four-page manual.
test('manual-aligned missions have ten unique topics and traceable report sections',()=>{
 const titles=new Set();
 const expected=['dynamic power','DVFS','gating','throttling','deep sleep','idle','DVFS','power gating','temperature','energy'];
 for(let i=0;i<10;i++){const m=Challenge.missionFor(i);titles.add(m.title);assert.match(m.source,/Manual p/);assert.ok(m.lesson.length>85);assert.match(m.brief,/core|processor|CPU|sensor|smartphone|node|farm/i);assert.match(m.lesson,new RegExp(expected[i],'i'));}
 assert.equal(titles.size,10);
 assert.match(Challenge.missionFor(4).brief,/15 minutes/);
 assert.match(Challenge.missionFor(9).brief,/15 minutes/);
 assert.equal(Challenge.missionFor(4).parameters.minAwake,4);
 assert.equal(Challenge.missionFor(9).parameters.minAwake,8);
 assert.equal(Challenge.missionFor(5).parameters.graphicsSoon,true);
 assert.equal(Challenge.missionFor(5).parameters.radioSoon,true);
});
test('live simulation feedback does not claim fixed targets from a different mission',()=>{
 const d=Model.simulate(1,{freq:.6,voltage:.7});
 assert.ok(!JSON.stringify(d.observations).includes('70% minimum'));
 const t=Model.simulate(3,{freq:1.4,cores:2,cooling:false});
 assert.ok(!JSON.stringify(t.metrics).includes('Work target'));
 assert.ok(!JSON.stringify(t.observations).includes('at least 90'));
 const f=Model.simulate(4,{awake:8,mode:'deep',sensor:true,radio:true});
 assert.ok(!JSON.stringify(f.metrics).includes('Six-joule budget'));
 assert.ok(!JSON.stringify(f.observations).includes('only requires four seconds'));
});

test('15 extra questions have distinct manual references and optimal full-credit configurations',()=>{
 const titles=new Set();
 for(let i=0;i<25;i++){
  const m=Challenge.missionFor(i);assert.match(m.source,/Manual pp?\./);assert.ok(m.lesson.length>80);
  assert.equal(Challenge.assess(i,best(m)).score,20,m.title);
  titles.add(m.title);
 }
 assert.equal(titles.size,25);
 assert.equal(Challenge.TOTAL,10);
});
test('each replay has five of original ten plus five extra missions, individually shuffled',()=>{
 const first=Orders.missionOrder(101,1);
 assert.ok(Orders.validOrder(first,1));assert.ok(first.every(n=>n<10));
 const retry2=Orders.missionOrder(101,2),retry3=Orders.missionOrder(101,3),retry4=Orders.missionOrder(101,4);
 for(let run=2;run<=30;run++){
  const order=Orders.missionOrder(101,run);
  assert.ok(Orders.validOrder(order,run),`run ${run}`);
  assert.equal(order.filter(i=>i<10).length,5);
  assert.equal(order.filter(i=>i>=10&&i<25).length,5);
  assert.notDeepEqual(order,Orders.missionOrder(101,run+1));
 }
 const overlap=(a,b)=>a.filter(x=>b.includes(x)).length;
 assert.equal(overlap(retry2.filter(i=>i<10),retry3.filter(i=>i<10)),0);
 assert.equal(overlap(retry2.filter(i=>i>=10),retry3.filter(i=>i>=10)),0);
 assert.equal(overlap(retry3.filter(i=>i>=10),retry4.filter(i=>i>=10)),0);
});
test('finishing, archiving, replaying and leaderboard keeps every original run immutable',()=>{
 const t={...team(Orders.missionOrder(777,1)),id:'teamABC',name:'Squad 01',members:[{name:'Student A',studentId:'001',role:'reader'},{name:'Student B',studentId:'002',role:'engineer'}],history:[],runNumber:1,orderSeed:777,variant:0};
 function finishRun(start){let now=start+1000;
  while(t.status!=='finished'){
   const id=Orders.currentMission(t),m=Challenge.missionFor(id,t.variant);
   Progress.attempt(t,best(m),now);
   if(t.status==='debrief')Progress.advance(t);
   now+=1000;
  }
  Runs.archive(t);return now;
 }
 finishRun(1000);
 assert.equal(t.history.length,1);assert.equal(t.history[0].name,'Squad 01-1');
 const first=structuredClone(t.history[0]);
 assert.throws(()=>Runs.startReplay({...t,status:'playing'},30000),/Finish all/);
 Runs.startReplay(t,30_000);
 assert.equal(t.runNumber,2);assert.equal(t.status,'playing');assert.equal(t.heat,0);assert.equal(t.crashes,0);assert.equal(t.startedAt,30000);
 assert.ok(Orders.validOrder(t.missionOrder,2));assert.equal(t.results.filter(Boolean).length,0);
 assert.deepEqual(t.history[0],first);
 const interim=Runs.allRows([t],31000);
 assert.deepEqual(interim.map(x=>x.name),['Squad 01-1','Squad 01-2']);
 assert.equal(interim[0].status,'finished');assert.equal(interim[1].status,'playing');
 finishRun(30_000);
 assert.equal(t.history.length,2);assert.equal(t.history[1].name,'Squad 01-2');
 assert.deepEqual(t.history[0],first);
 assert.deepEqual(Runs.allRows([t]).map(x=>x.name),['Squad 01-1','Squad 01-2']);
 Runs.startReplay(t,60_000);
 assert.ok(Orders.validOrder(t.missionOrder,3));
 assert.deepEqual(Runs.allRows([t]).map(x=>x.name),['Squad 01-1','Squad 01-2','Squad 01-3']);
 assert.equal(t.history[0].memberRecords.length,2);
});
test('each completed attempt retains separate crash, heat, clock and member roster',()=>{
 const t={...team(Orders.missionOrder(42,1)),id:'t2',name:'Squad 02',members:[{name:'A',role:'reader',studentId:''}],history:[],runNumber:1,orderSeed:42,variant:0};
 t.status='finished';t.startedAt=1000;t.finishedAt=11_000;t.heat=40;t.crashes=1;t.results=Array.from({length:10},()=>({score:15}));
 Runs.archive(t);const archived=t.history[0];
 t.members.push({name:'Late Joiner',role:'engineer',studentId:''});Runs.startReplay(t,100_000);
 assert.equal(archived.memberRecords.length,1);assert.equal(t.members.length,2);
 assert.equal(archived.heat,40);assert.equal(archived.crashes,1);
 assert.equal(archived.score,140);assert.equal(Ranking.durationMs(archived),10_000);
 assert.equal(Ranking.adjustedSeconds(archived),10+200+420);
 assert.equal(Runs.allRows([t],101_000)[1].elapsedMs,1000);
});
