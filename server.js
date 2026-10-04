'use strict';
const express=require('express');
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const { Server }=require('socket.io');
const Model=require('./public/model');
const {TOTAL,missionFor}=require('./challenges');
const Prog=require('./progression');
const {assign,assignRole,MAX_MEMBERS}=require('./teams');
const Ranking=require('./rankings');
const {missionOrder,currentMission,validOrder}=require('./mission-order');
const Runs=require('./runs');

const HOST_PASSWORD=process.env.HOST_PASSWORD||(process.env.NODE_ENV==='production'?'':'classdemo');
if(!HOST_PASSWORD||(process.env.NODE_ENV==='production'&&HOST_PASSWORD.length<10))throw Error('Set HOST_PASSWORD to a private password with 10+ characters.');
const STATE_FILE=path.resolve(process.env.STATE_FILE||path.join(__dirname,'.game-state.json'));
const MAX_TEAMS=60;
const app=express(); app.disable('x-powered-by');
app.use(express.static(path.join(__dirname,'public'),{index:'index.html',maxAge:0}));
app.get('/health',(_req,res)=>res.json({ok:true,version:4,totalMissions:TOTAL}));
const server=http.createServer(app);
const io=new Server(server,{maxHttpBufferSize:8_000_000,cors:{origin:false}});
let game=null;
const timers=new Map();
const ack=(cb,obj)=>{if(typeof cb==='function')cb(obj);};
const pin=()=>String(crypto.randomInt(100000,1000000));
const token=()=>crypto.randomBytes(24).toString('hex');
const isHost=s=>s.data.host===true;
const identity=s=>{
 if(!game||!s.data.memberToken)return null;
 for(const team of game.teams){const member=team.members.find(m=>m.token===s.data.memberToken);if(member)return {team,member};}
 return null;
};
const clean=x=>typeof x==='string'?x.trim():'';
function save(){
 if(!game)return;
 // Render Free has ephemeral filesystem; this snapshot helps local recovery, not cloud durability.
 try{fs.writeFileSync(STATE_FILE+'.tmp',JSON.stringify(game));fs.renameSync(STATE_FILE+'.tmp',STATE_FILE);}catch(err){console.error('WARNING: Could not write local snapshot:',err.message);}
}
try{if(fs.existsSync(STATE_FILE)){const raw=JSON.parse(fs.readFileSync(STATE_FILE,'utf8'));if(raw?.version===4&&Array.isArray(raw.teams)){
 game=raw;for(const t of game.teams){for(const m of t.members)m.socketId=null;}
 console.log('Restored v4 classroom game from local snapshot.');
}}}catch(err){console.error('Snapshot could not be restored:',err.message);}
function rankings(){
 if(!game)return [];
 // Each finished run is immutable history. The currently racing run is an additional row.
 const rows=Runs.allRows(game.teams).map(({memberRecords,missionOrder,results,variant,...publicRow})=>publicRow);
 return Ranking.rank(rows);
}
function stateFor(s){
 if(!game)return {exists:false,role:isHost(s)?'host':'visitor',version:4};
 const self=identity(s), host=isHost(s);
 const base={exists:true,version:4,role:host?'host':self?'member':'visitor',pin:game.pin,phase:game.phase,serverNow:Date.now(),
  maxMembers:MAX_MEMBERS,totalMissions:TOTAL,teamCount:game.teams.length,leaderboard:(host||self)?rankings():[]};
 if(host){base.teams=game.teams.map(t=>({id:t.id,name:t.name,members:t.members.map(m=>({name:m.name,studentId:m.studentId,role:m.role,online:!!(m.socketId&&io.sockets.sockets.has(m.socketId))})),
  level:t.index+1,runNumber:t.runNumber,runLabel:Runs.displayName(t),previousRuns:t.history?.length||0,completed:t.results.filter(Boolean).length,score:Prog.score(t),heat:t.heat,crashes:t.crashes,status:t.status,attempts:t.attempts,startedAt:t.startedAt,finishedAt:t.finishedAt,elapsedMs:Ranking.durationMs(t),adjustedSeconds:Ranking.adjustedSeconds(t)}));}
 if(self){
  const {team:t,member:m}=self;
  let mission=t.index<TOTAL?missionFor(currentMission(t),t.variant||0):null;
  // The analyst gets the mission briefing; engineers get the instrument panel.
  const readerOnline=t.members.some(person=>person.role==='reader'&&person.socketId&&io.sockets.sockets.has(person.socketId));
  if(mission&&m.role!=='reader'&&readerOnline&&t.members.length>1&&t.status!=='debrief'&&t.status!=='finished') {
   mission={number:mission.number,type:mission.type,tier:mission.tier,title:mission.title,subtitle:mission.subtitle,scenario:mission.scenario};
  }
  base.me={memberId:m.id,name:m.name,studentId:m.studentId,role:m.role,
   teamId:t.id,teamName:t.name,runNumber:t.runNumber,runLabel:Runs.displayName(t),previousRuns:(t.history||[]).map(h=>({runNumber:h.runNumber,name:h.name,score:h.score,life:h.life,elapsedMs:Ranking.durationMs(h),adjustedSeconds:Ranking.adjustedSeconds(h)})),members:t.members.map(mm=>({id:mm.id,name:mm.name,role:mm.role,online:!!(mm.socketId&&io.sockets.sockets.has(mm.socketId))})),
   level:t.index+1,completed:t.results.filter(Boolean).length,status:t.status,heat:t.heat,crashes:t.crashes,
   attempts:t.attempts,score:Prog.score(t),startedAt:t.startedAt,finishedAt:t.finishedAt,elapsedMs:Ranking.durationMs(t),adjustedSeconds:Ranking.adjustedSeconds(t),config:t.config,lastFeedback:t.lastFeedback,nextAt:t.nextAt,mission,
   recentResults:t.results.slice(Math.max(0,t.index-4),t.index+1).map((r,i)=>({mission:Math.max(0,t.index-4)+i+1,score:r?.score??null}))};
 }
 return base;
}
function stateAll(){for(const s of io.sockets.sockets.values())s.emit('state',stateFor(s));}
function stateTeam(t){for(const m of t.members){const s=io.sockets.sockets.get(m.socketId);if(s)s.emit('state',stateFor(s));}}
function stateHosts(){for(const s of io.sockets.sockets.values())if(isHost(s))s.emit('state',stateFor(s));}
function newTeam(){
 const number=game.teams.length+1;
 const t={id:token(),name:`Squad ${String(number).padStart(2,'0')}`,members:[],index:0,status:game.phase==='running'?'playing':'waiting',
  orderSeed:crypto.randomInt(1,0x7fffffff),runNumber:1,history:[],missionOrder:null,variant:(number-1)%20,startedAt:game.phase==='running'?Date.now():null,finishedAt:null,
  heat:0,crashes:0,attempts:0,lastAttempt:0,results:Array(TOTAL).fill(null),config:{...Model.defaultConfigs[0]},lastFeedback:null,nextAt:null};
 t.missionOrder=missionOrder(t.orderSeed,1);
 t.config={...Model.defaultConfigs[currentMission(t)%5]};game.teams.push(t);return t;
}
function setMissionConfig(t){if(t.index<TOTAL)t.config={...Model.defaultConfigs[currentMission(t)%5]};}
function advanceAfterDebrief(t){
 const existing=timers.get(t.id);if(existing)clearTimeout(existing);
 const ms=Math.max(0,(t.nextAt||Date.now())-Date.now());
 timers.set(t.id,setTimeout(()=>{
  if(!game||!game.teams.includes(t)||t.status!=='debrief')return;
  Prog.advance(t);setMissionConfig(t);save();stateAll();timers.delete(t.id);
 },ms));
}
if(game)for(const t of game.teams)if(t.status==='debrief')advanceAfterDebrief(t);
function csvCell(x){let str=String(x??'');if(/^[\s]*[=+@-]/.test(str))str="'"+str;return '"'+str.replace(/"/g,'""')+'"';}
function exportCSV(){
 const rows=Ranking.rank(Runs.allRows(game.teams));
 const header=['Rank','Attempt entry','Base team','Attempt number','Member','Student ID','Role','Members in this attempt',
  'Missions completed','Elapsed time seconds','Elapsed time HH:MM:SS','Final/current CPU heat','Remaining CPU life','Crashes',
  'Time+heat+crash ranking seconds','Mission points / 200','Run status',
  ...Array.from({length:TOTAL},(_,i)=>[`Stage ${i+1} title`,`Stage ${i+1} / 20`]).flat()];
 const lines=[header];
 for(const r of rows){
  const base=game.teams.find(t=>t.id===r.teamId);
  for(const m of r.memberRecords)lines.push([r.rank,r.name,base?.name||'',r.runNumber,m.name,m.studentId,m.role,r.memberRecords.length,
   r.completed,Math.ceil(r.elapsedMs/1000),formatDuration(r.elapsedMs),r.heat,r.life,r.crashes,r.adjustedSeconds,r.score,r.status,
   ...r.results.flatMap((v,i)=>[require('./challenges').missionFor(r.missionOrder[i],r.variant||0).title,v?v.score:''])]);
 }
 return '\ufeff'+lines.map(cols=>cols.map(csvCell).join(',')).join('\r\n');
}
function formatDuration(ms){const sec=Math.floor(ms/1000);return [Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(x=>String(x).padStart(2,'0')).join(':');}
io.on('connection',s=>{
 s.emit('state',stateFor(s));
 s.on('host:auth',(raw,cb)=>{
  const a=Buffer.from(clean(raw)),b=Buffer.from(HOST_PASSWORD);
  if(!a.length||a.length!==b.length||!crypto.timingSafeEqual(a,b))return ack(cb,{ok:false,error:'Incorrect host password.'});
  s.data.host=true;s.data.memberToken=null;ack(cb,{ok:true});s.emit('state',stateFor(s));
 });
 s.on('host:create',(_,cb)=>{
  if(!isHost(s))return ack(cb,{ok:false,error:'Host access required.'});
  if(game&&game.teams.length)return ack(cb,{ok:false,error:'An existing game has participants. Export results and use Reset Room to start fresh.'});
  game={version:4,pin:pin(),phase:'lobby',teams:[],createdAt:Date.now()};save();ack(cb,{ok:true,pin:game.pin});stateAll();
 });
 s.on('host:reset',(p,cb)=>{
  if(!isHost(s)||!game||clean(p?.confirmPin)!==game.pin)return ack(cb,{ok:false,error:'Host must confirm the current PIN to reset.'});
  for(const timer of timers.values())clearTimeout(timer);timers.clear();
  game={version:4,pin:pin(),phase:'lobby',teams:[],createdAt:Date.now()};
  for(const socket of io.sockets.sockets.values())socket.data.memberToken=null;
  save();ack(cb,{ok:true,pin:game.pin});stateAll();
 });
 s.on('room:lookup',(p,cb)=>{
  if(!game||clean(p?.pin)!==game.pin)return ack(cb,{ok:false,error:'Room PIN not found.'});
  ack(cb,{ok:true,phase:game.phase,teams:game.teams.filter(t=>t.members.length<MAX_MEMBERS).map(t=>({id:t.id,name:t.name,occupancy:t.members.length,members:t.members.map(m=>m.name)}))});
 });
 s.on('person:join',(raw,cb)=>{
  const p=raw&&typeof raw==='object'?raw:{};
  if(!game||clean(p.pin)!==game.pin)return ack(cb,{ok:false,error:'Room PIN incorrect. Ask the presenter.'});
  if(typeof p.token==='string'&&p.token.length===48){
   for(const t of game.teams){const m=t.members.find(m=>m.token===p.token);
    if(m){const old=io.sockets.sockets.get(m.socketId);if(old&&old.id!==s.id){old.data.memberToken=null;old.emit('replaced');}
     m.socketId=s.id;s.data.memberToken=m.token;s.data.host=false;
     ack(cb,{ok:true,token:m.token,pin:game.pin,resumed:true});stateAll();return;
    }
   }
   return ack(cb,{ok:false,error:'Previous registration expired. Join again under your name if the room was reset.'});
  }
  const name=clean(p.name), studentId=clean(p.studentId);
  if(!/^[\p{L}\p{N} .,'_-]{2,70}$/u.test(name)||studentId.length>32)return ack(cb,{ok:false,error:'Enter a valid full name (2–70 characters); student ID is optional.'});
  if(game.teams.some(t=>t.members.some(m=>m.name.toLocaleLowerCase()===name.toLocaleLowerCase())))return ack(cb,{ok:false,error:'This full name is already registered. Resume on your original device or ask the host.'});
  if(game.teams.reduce((a,t)=>a+t.members.length,0)>=MAX_TEAMS*MAX_MEMBERS)return ack(cb,{ok:false,error:'The room is full.'});
  let t;
  try{t=assign(game.teams,clean(p.preferredTeam))|| (game.teams.length<MAX_TEAMS?newTeam():null);}catch(err){return ack(cb,{ok:false,error:err.message});}
  if(!t)return ack(cb,{ok:false,error:'Maximum number of teams reached.'});
  const m={id:token(),token:token(),name,studentId,role:assignRole(t),socketId:s.id,joinedAt:Date.now()};
  t.members.push(m);s.data.memberToken=m.token;s.data.host=false;
  save();ack(cb,{ok:true,token:m.token,pin:game.pin,resumed:false,team:t.name,role:m.role});stateAll();
 });
 s.on('host:start',(_,cb)=>{
  if(!isHost(s)||!game||game.phase!=='lobby')return ack(cb,{ok:false,error:'Create a lobby first.'});
  if(!game.teams.length)return ack(cb,{ok:false,error:'At least one student must register.'});
  game.phase='running';const now=Date.now();for(const t of game.teams)if(t.status==='waiting'){t.status='playing';t.startedAt=now;}
  save();ack(cb,{ok:true});stateAll();
 });
 s.on('team:config',(raw,cb)=>{
  const self=identity(s);if(!self||self.team.status!=='playing')return ack(cb,{ok:false,error:'No active team mission.'});
  const {team:t,member:m}=self;if(m.role!=='engineer'&&t.members.length>1)return ack(cb,{ok:false,error:'The mission reader has instructions; CPU Engineers operate the controls.'});
  try{t.config=Model.normalize(currentMission(t)%5,raw);ack(cb,{ok:true});
   for(const mm of t.members){const other=io.sockets.sockets.get(mm.socketId);if(other&&other.id!==s.id)other.emit('team:configuration',{config:t.config,by:m.name});}
  }catch(err){ack(cb,{ok:false,error:err.message});}
 });
 s.on('team:attempt',(raw,cb)=>{
  const self=identity(s);if(!self)return ack(cb,{ok:false,error:'Join a team first.'});
  const {team:t,member:m}=self;
  if(m.role!=='engineer'&&t.members.length>1)return ack(cb,{ok:false,error:'Only CPU Engineers can test a build; ask your teammate.'});
  try{
   const config=Model.normalize(currentMission(t)%5,raw);
   const feedback=Prog.attempt(t,config);
   if(t.status==='finished')Runs.archive(t);
   if(t.status==='debrief')advanceAfterDebrief(t);
   save();ack(cb,{ok:true,feedback});stateAll();
  }catch(err){ack(cb,{ok:false,error:err.message});}
 });
 s.on('team:retry',(_,cb)=>{
  const self=identity(s);if(!self)return ack(cb,{ok:false,error:'Join a team first.'});
  try{Prog.retry(self.team);setMissionConfig(self.team);save();ack(cb,{ok:true});stateAll();}
  catch(err){ack(cb,{ok:false,error:err.message});}
 });
 s.on('team:replay',(_,cb)=>{
  const self=identity(s);if(!self)return ack(cb,{ok:false,error:'Join your team first.'});
  const t=self.team;
  try{
   Runs.startReplay(t);setMissionConfig(t);
   save();ack(cb,{ok:true,runNumber:t.runNumber,runLabel:Runs.displayName(t)});stateAll();
  }catch(err){ack(cb,{ok:false,error:err.message});}
 });
 s.on('host:backup',(_,cb)=>{
  if(!isHost(s)||!game)return ack(cb,{ok:false,error:'Host access required.'});
  ack(cb,{ok:true,filename:`cpu-wars-v4-${game.pin}-PRIVATE-recovery.json`,json:JSON.stringify(game,null,2)});
 });
 s.on('host:restore',(raw,cb)=>{
  if(!isHost(s))return ack(cb,{ok:false,error:'Host access required.'});
  try{
   if(typeof raw!=='string'||raw.length>7_500_000)throw Error('Select a valid CPU WARS V4 backup under 7.5 MB.');
   const restored=JSON.parse(raw);
   if(restored.version!==4||!/^\d{6}$/.test(restored.pin)||!['lobby','running'].includes(restored.phase)||
      !Array.isArray(restored.teams)||restored.teams.length>MAX_TEAMS)throw Error('Unrecognized backup format.');
   for(const t of restored.teams){
     if(!Array.isArray(t.members)||t.members.length>3||!Array.isArray(t.results)||t.results.length!==TOTAL||!Number.isInteger(t.runNumber)||t.runNumber<1||!Number.isInteger(t.orderSeed)||!validOrder(t.missionOrder,t.runNumber)||!Array.isArray(t.history)||t.history.length>1000||
       !Number.isInteger(t.index)||t.index<0||t.index>=TOTAL||
       !['waiting','playing','debrief','crashed','finished'].includes(t.status)||!Number.isInteger(t.variant)||!Number.isFinite(t.startedAt)&&t.startedAt!==null)throw Error('Backup has invalid team data.');
     for(const h of t.history){if(h.status!=='finished'||!validOrder(h.missionOrder,h.runNumber)||!Array.isArray(h.results)||h.results.length!==TOTAL||h.teamId!==t.id)throw Error('Backup has invalid historical attempt.');}
     t.config=Model.normalize(currentMission(t)%5,t.config);
     for(const m of t.members){if(typeof m.token!=='string'||m.token.length!==48||!['reader','engineer'].includes(m.role))throw Error('Backup has invalid registration data.');m.socketId=null;}
   }
   for(const task of timers.values())clearTimeout(task);timers.clear();
   game=restored;
   for(const client of io.sockets.sockets.values())client.data.memberToken=null;
   for(const t of game.teams)if(t.status==='debrief')advanceAfterDebrief(t);
   save();ack(cb,{ok:true,pin:game.pin});stateAll();
  }catch(err){ack(cb,{ok:false,error:err.message});}
 });
 s.on('host:export',(_,cb)=>{
  if(!isHost(s)||!game)return ack(cb,{ok:false,error:'Host access required.'});
  ack(cb,{ok:true,csv:exportCSV(),filename:`cpu-wars-${game.pin}-all-attempts-individual-and-group-results.csv`});
 });
 s.on('disconnect',()=>{
  const self=identity(s);
  if(self&&self.member.socketId===s.id){self.member.socketId=null;stateAll();}
 });
});
const liveTicker=setInterval(()=>{if(game&&game.phase==='running'){const info={leaderboard:rankings(),serverNow:Date.now()};for(const client of io.sockets.sockets.values())if(isHost(client)||identity(client))client.emit('race:tick',info);}},3000);liveTicker.unref?.();
const port=Number(process.env.PORT)||3000;
if(require.main===module)server.listen(port,'0.0.0.0',()=>console.log(`CPU WARS v4 — 10 missions per attempt — listening on :${port}`));
module.exports={app,server,io,rankings,csvCell};
