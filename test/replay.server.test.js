'use strict';
// Event-flow integration test with minimal Express/Socket.IO stand-ins. It tests the
// actual server handler logic without requiring a network or package installation.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const Module=require('node:module');
const Challenge=require('../challenges');
function best(m){const p=m.parameters;switch(m.type){case 0:case 2:case 3:return p.opt;case 1:return {freq:p.optFreq,voltage:p.optVoltage};case 4:return {awake:p.minAwake,mode:'deep',sensor:true,radio:true};}}
test('the real host/join/finish/replay/CSV/backup socket handlers retain earlier runs',()=>{
 const originalLoad=Module._load,originalSetTimeout=global.setTimeout,originalClearTimeout=global.clearTimeout;
 const dirname=fs.mkdtempSync(path.join(os.tmpdir(),'cpu-wars-v4-test-'));
 process.env.STATE_FILE=path.join(dirname,'state.json');
 let fakeIO,pending=[];
 const express=()=>{const app=()=>{};app.disable=()=>app;app.use=()=>app;app.get=()=>app;return app;};
 express.static=()=>((_req,_res,_next)=>{});
 class FakeIO{constructor(){this.sockets={sockets:new Map()};this.handlers={};fakeIO=this;}on(evt,fn){this.handlers[evt]=fn;}}
 Module._load=function(request,parent,isMain){if(request==='express')return express;if(request==='socket.io')return {Server:FakeIO};return originalLoad.call(this,request,parent,isMain);};
 global.setTimeout=function(fn,ms,...args){if(ms<=8000){const task={fake:true};pending.push(()=>fn(...args));return task;}return originalSetTimeout(fn,ms,...args);};
 global.clearTimeout=function(timer){if(timer?.fake)return;return originalClearTimeout(timer);};
 try{
  delete require.cache[require.resolve('../server')];
  const server=require('../server');
  function createSocket(id){const s={id,data:{},handlers:{},state:null,on(k,fn){this.handlers[k]=fn;},emit(k,p){if(k==='state')this.state=p;}};fakeIO.sockets.sockets.set(id,s);fakeIO.handlers.connection(s);return s;}
  function call(s,key,data){let result;assert.ok(s.handlers[key],`Missing handler ${key}`);s.handlers[key](data,r=>result=r);assert.ok(result,`No response for ${key}`);return result;}
  const host=createSocket('teacher');assert.equal(call(host,'host:auth','classdemo').ok,true);
  const created=call(host,'host:create',{});assert.equal(created.ok,true);const pin=created.pin;
  const reader=createSocket('reader'),engineer=createSocket('engineer');
  const r=call(reader,'person:join',{pin,name:'First Student',studentId:'001'});assert.equal(r.role,'reader');
  const eng=call(engineer,'person:join',{pin,name:'Second Student',studentId:'002'});assert.equal(eng.role,'engineer');
  assert.equal(call(host,'host:start',{}).ok,true);
  function completeAttempt(){for(let step=0;step<10;step++){
    assert.equal(engineer.state.me.status,'playing');
    const title=engineer.state.me.mission.title;
    const id=Array.from({length:Challenge.BANK_COUNT},(_,i)=>i).find(i=>Challenge.missionFor(i).title===title);
    assert.ok(Number.isInteger(id),`Unknown mission ${title}`);
    const f=call(engineer,'team:attempt',best(Challenge.missionFor(id)));
    assert.equal(f.ok,true,JSON.stringify(f));assert.equal(f.feedback.result.score,20,title);
    if(step<9){assert.ok(pending.length);pending.shift()();}
  }}
  completeAttempt();
  assert.equal(engineer.state.me.status,'finished');
  assert.equal(engineer.state.me.runLabel,'Squad 01-1');
  assert.deepEqual(server.rankings().map(x=>x.name),['Squad 01-1']);
  const oldScore=server.rankings()[0].score;
  let csv=call(host,'host:export',{}).csv;
  assert.match(csv,/Squad 01-1/);assert.equal(csv.includes('Squad 01-2'),false);
  assert.ok(!Object.hasOwn(server.rankings()[0],'memberRecords'),'private Student IDs not on public leaderboard');
  const replay=call(reader,'team:replay',{});
  assert.equal(replay.ok,true);assert.equal(replay.runLabel,'Squad 01-2');
  assert.equal(engineer.state.me.status,'playing');assert.equal(engineer.state.me.heat,0);
  assert.equal(engineer.state.me.runNumber,2);
  const ranked=server.rankings();assert.equal(ranked.length,2);
  assert.equal(ranked.find(x=>x.name==='Squad 01-1').score,oldScore);
  assert.equal(ranked.find(x=>x.name==='Squad 01-1').status,'finished');
  assert.equal(call(engineer,'team:replay',{}).ok,false,'cannot replay unfinished attempt');
  completeAttempt();
  assert.equal(engineer.state.me.status,'finished');
  assert.deepEqual(server.rankings().map(x=>x.name).sort(),['Squad 01-1','Squad 01-2']);
  csv=call(host,'host:export',{}).csv;
  assert.match(csv,/Squad 01-1/);assert.match(csv,/Squad 01-2/);
  assert.ok(csv.includes('Attempt number'));
  const backup=call(host,'host:backup',{});assert.equal(backup.ok,true);
  assert.equal(JSON.parse(backup.json).teams[0].history.length,2);
  assert.equal(call(host,'host:restore',backup.json).ok,true);
  assert.equal(server.rankings().length,2);
  server.server.close();
 } finally {
  Module._load=originalLoad;global.setTimeout=originalSetTimeout;global.clearTimeout=originalClearTimeout;
  delete process.env.STATE_FILE;fs.rmSync(dirname,{recursive:true,force:true});
 }
});
