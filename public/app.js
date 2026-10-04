'use strict';
const socket=io({reconnection:true});
const Model=window.CPUModel;
const root=document.getElementById('app');
const isHostView=new URLSearchParams(location.search).has('host');
const key='cpu-wars-v4-individual';
let saved=null;try{saved=JSON.parse(localStorage.getItem(key));}catch(_){/* empty */}
let state={exists:false,role:'visitor'}, hostPassword='',hostAuthed=false,roomPreview=null,liveConfig=null,toastTimer=null;
let sending=false,clockOffset=0;
function timeText(ms){const z=Math.max(0,Math.floor(ms/1000));return [Math.floor(z/3600),Math.floor(z/60)%60,z%60].map(x=>String(x).padStart(2,'0')).join(':');}
function liveTime(start,finish){return !start?'00:00:00':timeText((finish||Date.now()+clockOffset)-start);}
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gate=[['run','RUN • powered and switching'],['clock','CLOCK GATE • no switching'],['off','POWER GATE • supply removed']];
function alertUser(msg,bad=false){const el=document.getElementById('toast');if(!el)return;el.textContent=msg;el.classList.toggle('error',bad);el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),5000);}
function net(yes){document.getElementById('net-dot').classList.toggle('online',yes);document.getElementById('net-label').textContent=yes?'LIVE SERVER':'RECONNECTING';}
function send(event,data={}){return new Promise(resolve=>socket.timeout(12000).emit(event,data,(err,r)=>{if(err){alertUser('Server timed out. Please check your connection.',true);return resolve(null);}if(!r?.ok)alertUser(r?.error||'Action failed.',true);resolve(r);}));}
function metrics(config,type){try{return Model.simulate(type,config);}catch(_){return null;}}
const number=x=>Number(x||0);
function selector(id,items,selected){return `<select class="control" id="${e(id)}" data-cfg>${items.map(([v,t])=>`<option value="${e(v)}" ${String(selected)===String(v)?'selected':''}>${e(t)}</option>`).join('')}</select>`;}
function downloadFile(body,filename,mime){const blob=new Blob([body],{type:mime});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function join(){const query=new URLSearchParams(location.search);const pin=query.get('pin')||saved?.pin||'';
 return `<section class="hero"><p class="eyebrow">10-MISSION TIME TRIAL</p><h1>One CPU.<br><span class="accent">Three engineers.</span></h1><p>Register individually. You will automatically join an incomplete squad of three. Late arrivals are welcome while the game is running.</p></section>
 <div class="card landing-card"><h2>Individual registration</h2><form id="join-form">
 <div class="field"><label for="pin">Six-digit room PIN</label><div class="button-row"><input id="pin" inputmode="numeric" minlength="6" maxlength="6" pattern="[0-9]{6}" value="${e(pin)}" required placeholder="123456" style="min-width:130px;flex:1"><button type="button" class="btn btn-secondary" data-action="lookup">Find teams</button></div></div>
 <div class="field"><label for="full-name">Your full name (individual)</label><input id="full-name" maxlength="70" required autocomplete="name" placeholder="Juan Dela Cruz"></div>
 <div class="field"><label for="student-id">Student ID (optional, for grading)</label><input id="student-id" maxlength="32" placeholder="Optional"></div>
 <div class="field"><label for="preferred-team">Your team</label><select id="preferred-team" class="control"><option value="">Auto-assign me to the first squad with space</option>${(roomPreview?.pin===pin?roomPreview.teams:[]).map(t=>`<option value="${e(t.id)}">${e(t.name)} (${t.occupancy}/3) — ${e(t.members.join(', '))}</option>`).join('')}</select></div>
 <p class="help">Want to join particular classmates? Find teams, then choose their squad if it still has fewer than three members. You can also join late, including mid-mission.</p>
 <button class="btn btn-primary btn-block" type="submit">REGISTER & JOIN ARENA →</button></form>
 <div class="divider"></div><p class="small muted">Presenting the game? <a href="/?host=1">Open Host Dashboard</a></p></div>`;
}
function auth(){return `<section class="hero"><p class="eyebrow">PRESENTER LOGIN</p><h1>Mission Control.</h1><p>Manage registration and watch every squad race through 10 CPU simulations.</p></section><div class="card landing-card"><form id="host-form"><div class="field"><label for="host-pass">HOST_PASSWORD from Render</label><input type="password" id="host-pass" required autocomplete="current-password"></div><button class="btn btn-primary btn-block">OPEN DASHBOARD →</button></form></div>`;}
function board(rows=[]){return `<section class="card" id="leaderboard"><h3>🏆 Live team leaderboard</h3><p class="small muted">Every attempt remains on the leaderboard under its own name (such as Squad 01-1 and Squad 01-2). Complete 10 missions to rank among finished attempts. Lower adjusted time wins: elapsed seconds + (5 × final heat) + (420 × crashes). A NEW attempt has a new timer and CPU, while crash repair within an attempt never resets its timer.</p><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Team</th><th>Progress</th><th>Time</th><th>Life / heat</th><th>Crashes</th><th>Adjusted</th><th>Points</th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.rank===1?'rank-first':''}"><td>#${r.rank}</td><td><strong>${e(r.name)}</strong><br><span class="small muted">${e(r.members.join(', '))}</span></td><td>${r.completed}/10 ${r.status==='finished'?'✓ FINISHED':'• '+e(r.status)}</td><td class="tabular">${timeText(r.elapsedMs)}</td><td>${r.life}/100 <span class="small muted">(${r.heat} heat)</span></td><td>${r.crashes}</td><td><strong>${timeText(r.adjustedSeconds*1000)}</strong></td><td>${r.score}/200</td></tr>`).join('')||'<tr><td colspan="8">No teams yet.</td></tr>'}</tbody></table></div></section>`;}
function host(s){if(!s.exists)return `<section class="hero"><p class="eyebrow">GAME MASTER</p><h1>Launch the CPU arena.</h1><p>Individuals will automatically form squads of three. Late joining remains enabled after you start.</p></section><div class="card landing-card"><button class="btn btn-primary btn-block" data-action="create">CREATE CLASSROOM GAME</button></div>`;
 return `<div class="head-row"><div><p class="eyebrow">HOST / MONITOR ONLY</p><h1 class="section-title" style="font-size:34px">CPU WARS: 10-MISSION SURVIVAL RACE</h1></div><span class="pill gold">${s.phase==='lobby'?'WAITING ROOM':'COMPETITION LIVE'}</span></div>
 <div class="grid-two"><section class="card"><p class="stage">JOIN PIN</p><p class="pin">${e(s.pin)}</p><p class="small muted">Students can register at any time. Teams automatically fill to three.</p>
 <code class="host-link">${e(location.origin+'/?pin='+s.pin)}</code><button class="btn btn-secondary btn-block" data-action="copy-link">COPY JOIN LINK</button>
 <div class="divider"></div><p class="muted">${s.teamCount} squad${s.teamCount===1?'':'s'} • Individual sign-up • Separate Mission Reader and CPU Engineer roles.</p>
 <div class="button-row">${s.phase==='lobby'?'<button class="btn btn-primary" data-action="start">START THE COMPETITION →</button>':'<span class="pill">10 missions • Automatic advancement • No next button</span>'}<button class="btn btn-secondary" data-action="export">DOWNLOAD GRADES CSV</button><button class="btn btn-secondary" data-action="backup">SAVE RECOVERY BACKUP</button></div>
 <p class="help">The host does not advance missions manually. After each successful mission, an 8-second lesson appears. After completing mission 10, the squad may choose PLAY AGAIN: that creates a separate result with suffix -2, -3, etc., and a fresh set of five original plus five new manual-based missions in random order. Previous attempt records are permanently retained for the current room. Export and back up regularly; Render Free storage is not permanent.</p>
 <div class="divider"></div><label class="small muted" for="recovery-file">Restore a previous private recovery backup (students must refresh afterward):</label><input class="recovery-input" type="file" id="recovery-file" accept=".json,application/json"><button class="btn btn-secondary btn-block" data-action="restore">RESTORE A BACKUP</button><div class="divider"></div><button class="btn btn-danger" data-action="reset">RESET ROOM AND DELETE CURRENT RESULTS</button></section>
 <section class="card"><h3>Automatic groups (3 members maximum)</h3><div class="table-wrap"><table><thead><tr><th>Team & assigned roles</th><th>Progress</th><th>CPU / score</th></tr></thead><tbody>${(s.teams||[]).map(t=>`<tr><td><strong>${e(t.runLabel)}</strong> (${t.members.length}/3)<br>${t.members.map(m=>`<span class="small ${m.online?'':'muted'}">${m.online?'●':'○'} ${e(m.name)} — ${m.role==='reader'?'Mission Reader':'CPU Engineer'}</span>`).join('<br>')}</td><td>Mission ${Math.min(t.level,10)}/10<br><span class="small muted">${e(t.status)} • ${timeText(t.elapsedMs)}</span></td><td>${100-t.heat}/100 CPU life<br><strong>${t.score}/200 pts</strong><br><span class="small muted">${t.crashes} crashes • ${t.previousRuns} saved prior attempts • Adjusted ${timeText(t.adjustedSeconds*1000)}</span></td></tr>`).join('')||'<tr><td colspan="3">Waiting for individual registrations…</td></tr>'}</tbody></table></div></section></div>
 <div style="margin-top:18px">${board(s.leaderboard)}</div>`;
}
function roster(me){return `<section class="card team-roster"><div class="head-row"><div><span class="stage">YOUR SQUAD</span><h3>${e(me.runLabel)} (${me.members.length}/3)</h3></div><span class="pill">${me.role==='reader'?'MISSION READER':'CPU ENGINEER'}</span></div>
 ${me.members.map(m=>`<div class="roster-line"><div><strong>${e(m.name)} ${m.id===me.memberId?'(YOU)':''}</strong><div class="small muted">${m.role==='reader'?'📖 Reads the secret mission':'🖥️ Operates and tests CPU controls'}</div></div><span class="team-tag ${m.online?'':'offline'}">${m.online?'Online':'Offline'}</span></div>`).join('')}
 ${me.members.length<3?'<p class="help">Late students can still join your squad using the PIN while there is an open slot.</p>':''}</section>`;}
function controls(type,c){if(type===0||type===2){const keys=type===0?[['core','Main processing core'],['graphics','Graphics unit'],['radio','Radio unit'],['timer','Near-future timer']]:[['control','Control CPU'],['sensor','Urgent sensor'],['network','Network controller'],['accelerator','Hardware accelerator']];
 return keys.map(([k,label])=>`<div class="block-row"><strong>${label}</strong>${selector(k,gate,c[k])}</div>`).join('');}
 if(type===1)return `<div class="slider-field"><span class="field-title">Clock frequency</span><span class="readout" id="freq-val">${c.freq.toFixed(1)} GHz</span><input data-cfg aria-label="Clock frequency" id="freq" type="range" min="0" max="4" step="1" value="${Model.freqs2.indexOf(c.freq)}"></div>
 <div class="slider-field"><span class="field-title">Supply voltage</span><span class="readout" id="voltage-val">${c.voltage.toFixed(2)} V</span><input data-cfg aria-label="CPU voltage" id="voltage" type="range" min="0" max="5" step="1" value="${Model.voltages2.indexOf(c.voltage)}"></div>`;
 if(type===3)return `<div class="slider-field"><span class="field-title">Clock frequency</span><span class="readout" id="freq-val">${c.freq.toFixed(1)} GHz</span><input data-cfg id="freq" aria-label="CPU frequency" type="range" min="0" max="3" step="1" value="${[1,1.4,1.8,2].indexOf(c.freq)}"></div>
 <div class="field"><label for="cores">Active CPU cores</label>${selector('cores',[[1,'1 core'],[2,'2 cores'],[4,'4 cores']],c.cores)}</div>
 <label class="choice-checkbox"><input data-cfg id="cooling" type="checkbox" ${c.cooling?'checked':''}> Use active cooling (+2 W in this simulation)</label>`;
 return `<div class="field"><label for="awake">Awake time each 15-minute cycle</label>${selector('awake',[4,8,15,30,60].map(n=>[n,n+' seconds']),c.awake)}</div>
 <div class="field"><label for="mode">Low-power mode</label>${selector('mode',[['deep','DEEP SLEEP'],['idle','IDLE MODE'],['always','ALWAYS ON']],c.mode)}</div>
 <label class="choice-checkbox"><input data-cfg id="sensor" type="checkbox" ${c.sensor?'checked':''}> Enable soil sensor</label>
 <label class="choice-checkbox"><input data-cfg id="radio" type="checkbox" ${c.radio?'checked':''}> Enable radio transmission</label>`;}
function readConfig(type){if(type===0||type===2){const k=type===0?['core','graphics','radio','timer']:['control','sensor','network','accelerator'];return Object.fromEntries(k.map(id=>[id,document.getElementById(id).value]));}
 if(type===1)return {freq:Model.freqs2[number(document.getElementById('freq').value)],voltage:Model.voltages2[number(document.getElementById('voltage').value)]};
 if(type===3)return {freq:[1,1.4,1.8,2][number(document.getElementById('freq').value)],cores:number(document.getElementById('cores').value),cooling:document.getElementById('cooling').checked};
 return {awake:number(document.getElementById('awake').value),mode:document.getElementById('mode').value,sensor:document.getElementById('sensor').checked,radio:document.getElementById('radio').checked};}
function telemetry(type,c){const sim=metrics(c,type);if(!sim)return '<p class="muted">Waiting for a valid CPU configuration.</p>';
 return `<div class="metrics">${Object.entries(sim.metrics).map(([k,v])=>`<div class="metric"><div class="label">${e(k)}</div><div class="number ${/INVALID|FAILED|MISSED|LATE|ACTIVE \(|EXCEEDED|UNDERVOLTAGE/.test(v)?'warn':''}">${e(v)}</div></div>`).join('')}</div><div class="divider"></div><h3>What the CPU is doing</h3><ul class="observations">${sim.observations.map(o=>`<li>${e(o)}</li>`).join('')}</ul>`;}
function feedbackPanel(f){if(!f)return '';
 const r=f.result;return `<section class="card feedback"><p class="eyebrow">LAST CPU TEST — MISSION ${f.mission}</p><h3 class="${r.passed?'good':'bad'}">${e(f.message)}</h3><p><strong>Test result: ${r.score}/20 potential points</strong> • Heat ${f.heatBefore}% → ${f.heatAfter}% (${f.heatChange>=0?'+':''}${f.heatChange})</p>
 ${r.breakdown.map(b=>`<div class="scoreline"><span>${b.passed?'✓':'✗'} ${e(b.label)}</span><strong class="${b.passed?'yes':'no'}">${b.earned}/${b.max}</strong></div>`).join('')}
 <div class="divider"></div><strong>Knowledge gained from this attempt</strong><ul class="observations">${r.observations.map(o=>`<li>${e(o)}</li>`).join('')}</ul></section>`;}
function member(s){const me=s.me;const m=me.mission;const c=liveConfig||me.config;const canBuild=me.role==='engineer'||me.members.length===1;
 const top=`<div class="head-row"><div><p class="stage">${e(me.runLabel)} • ${e(me.name)} • ATTEMPT ${me.runNumber}</p><h1 class="section-title" style="font-size:clamp(26px,4vw,38px)">${me.status==='waiting'?'Waiting Room':me.status==='finished'?'All 10 missions complete!':`Mission ${me.level} / 10`}</h1><p class="muted">${m?e(m.title):''}</p></div><div class="heat-meter"><div class="head-row"><strong>CPU HEAT</strong><strong class="${me.heat>=75?'bad':''}">${me.heat}/100</strong></div><div class="heat-track"><div style="width:${me.heat}%;background:${me.heat>=75?'var(--red)':me.heat>=45?'var(--yellow)':'var(--cyan)'}"></div></div><p class="small muted">Score ${me.score}/200 • Life ${100-me.heat}/100 • ${me.crashes} crash${me.crashes===1?'':'es'}<br>⏱ <span id="team-timer" data-start="${me.startedAt||0}" data-finish="${me.finishedAt||0}">${liveTime(me.startedAt,me.finishedAt)}</span></p></div></div>`;
 const side=`<div class="side-stack">${roster(me)}<section class="card"><h3>Progress · Attempt ${me.runNumber}</h3><p><strong>${me.completed}/10 missions completed</strong></p><p class="small muted">Wrong build = CPU heat. If heat reaches 100, retry the current mission. Previous scores remain recorded. Every crash adds a 7-minute ranking penalty; your timer continues during retries.</p>${me.recentResults.map(r=>`<div class="scoreline"><span>Mission ${r.mission}</span><strong>${r.score===null?'In progress':r.score+'/20'}</strong></div>`).join('')}</section></div>`;
 if(me.status==='waiting')return `${top}<div class="grid-two"><section class="card"><span class="pill">REGISTERED SUCCESSFULLY</span><h2>Meet your teammates!</h2><p>First arrival becomes Mission Reader; the next two become CPU Engineers. The reader communicates the task while engineers use the controls. Your presenter will start the competition.</p><p class="help">If your group has only one member, that person receives both roles until an engineer joins. Late registration stays open.</p></section>${side}</div>`;
 if(me.status==='crashed')return `${top}<div class="grid-two"><section class="card"><p class="eyebrow bad">GAME OVER — CPU CRASH</p><h2>CPU heat reached 100!</h2><p>Your completed mission scores are saved. Repairing resets heat to 25, but does NOT reset the race timer. Every crash adds 420 seconds to your adjusted ranking time and subtracts 10 mission points.</p><button class="btn btn-primary btn-block" data-action="retry">REPAIR CPU & RETRY THIS MISSION →</button></section>${side}</div>${feedbackPanel(me.lastFeedback)}<div style="margin-top:20px">${board(s.leaderboard)}</div>`;
 if(me.status==='debrief')return `${top}<div class="grid-two"><section class="card"><p class="eyebrow good">MISSION PASSED</p><h2>Knowledge unlocked!</h2><p>${e(m?.brief||'')}</p><div class="lesson"><strong>${e(m?.subtitle||'CPU power management')}</strong>${e(m?.lesson||'')}<p class="small muted">Related reading: ${e(m?.source||'CPU Power Consumption manual')}</p></div><p class="help">Your team advances AUTOMATICALLY after this short learning pause. No presenter Next button is required.</p><p class="countdown" id="next-countdown" data-next="${number(me.nextAt)}">Next stage in 8s</p></section>${side}</div>${feedbackPanel(me.lastFeedback)}<div style="margin-top:20px">${board(s.leaderboard)}</div>`;
 if(me.status==='finished')return `${top}<div class="grid-two"><section class="card"><p class="eyebrow good">10 / 10 COMPLETE</p><h2>Engineering campaign finished.</h2><p>Your team finished in <strong>${liveTime(me.startedAt,me.finishedAt)}</strong> with <strong>${100-me.heat} CPU life</strong> remaining. Your mission-points score: <strong>${me.score}/200</strong>. Adjusted ranking time: <strong>${timeText(me.adjustedSeconds*1000)}</strong>.</p><p>Your completed run is saved as <strong>${e(me.runLabel)}</strong>. Ready to improve your performance? You may start a NEW attempt; your previous result and rank remain saved. Your next ten missions contain five from the original ten and five from the extra manual-based bank, randomly sequenced.</p><button class="btn btn-primary btn-block" data-action="replay">PLAY AGAIN — ATTEMPT ${me.runNumber+1} →</button><p class="help">The whole squad shares one attempt. Starting again resets the new run's CPU heat, timer, and stage scores, but does not erase prior attempts. Coordinate with your teammates before clicking.</p><p>Ask the host to export the all-attempts grades CSV after the competition.</p><div class="lesson"><strong>Final concept</strong> Good embedded CPU design balances useful processing, leakage, frequency, voltage, sleep, and thermal limits — not maximum clock speed at all times.</div></section>${side}</div><div style="margin-top:20px">${board(s.leaderboard)}</div>`;
 if(!m)return `${top}<p>Waiting for mission...</p>`;
 const instruction=!m.goal?`<p class="objective"><strong>ENGINEER ROLE:</strong> Your Mission Reader has the detailed instructions and numeric requirements. Talk to them before testing the CPU.</p>`:`<div class="protected-content" data-watermark="${e(me.teamName)} • ${e(me.name)} • ATTEMPT ${me.runNumber} • LEVEL ${me.level}"><p class="objective"><strong>PRIVATE MISSION BRIEF:</strong> ${e(m.brief)}<br><br><strong>GOAL:</strong> ${e(m.goal)}</p></div>`;
 const left=canBuild?`<section class="card"><span class="pill">CPU ENGINEERING BENCH</span><h2>Build your configuration</h2>${instruction}<p class="small muted">Change the switches and read the live simulation. Another engineer on your team sees the same shared CPU setup. Instrument readings show circuit state; the Mission Reader supplies any additional objectives.</p><div id="control-area">${controls(m.type,c)}</div><button class="btn btn-primary btn-block" data-action="attempt" ${sending?'disabled':''}>TEST THIS CPU BUILD →</button><p class="help">Every test checks four criteria. One missed criterion increases CPU heat. A passing build earns its points and advances after the lesson screen; a failed build stays on the same stage.</p></section>`:
 `<section class="card reader-screen"><span class="pill gold">PRIVATE MISSION READER DISPLAY</span><h2>Read this aloud to your teammates!</h2><p class="small muted">Protected in-app reading: right-click, selection, copy, and printing are restricted. Screenshots taken outside the browser cannot be completely prevented.</p><div class="protected-content" data-watermark="${e(me.teamName)} • ${e(me.name)} • ATTEMPT ${me.runNumber} • LEVEL ${me.level}"><p class="objective">${e(m.brief)}</p><h3>Requirements you must communicate</h3><p class="lesson">${e(m.goal)}</p><p class="small muted">Manual section: ${e(m.source||'CPU Power Consumption')}</p></div><p><strong>Strategy:</strong> Ask your engineers to adjust the controls. Read the mission aloud rather than sending an image. The first attempt uses the original ten missions. Every later attempt gets five of those plus five additional manual-based missions, in a new random sequence.</p><p class="help">You cannot press Test for them. If alone, the website unlocks both roles until another student joins.</p></section>`;
 return `${top}<div class="game-layout"><div class="main-stack">${left}<section class="card"><h3>${canBuild?'Live CPU telemetry':'Shared CPU readings — help your engineers'}</h3><div id="telemetry">${telemetry(m.type,c)}</div></section>${feedbackPanel(me.lastFeedback)}</div>${side}</div><div style="margin-top:20px">${board(s.leaderboard)}</div>`;
}
function render(){root.innerHTML=isHostView?(hostAuthed?host(state):auth()):(state.role==='member'&&state.me?member(state):join());updateNext();}
function updateNext(){const el=document.getElementById('next-countdown');if(el)el.textContent='Next mission in '+Math.max(0,Math.ceil((number(el.dataset.next)-(Date.now()+clockOffset))/1000))+'s';const timer=document.getElementById('team-timer');if(timer)timer.textContent=liveTime(number(timer.dataset.start),number(timer.dataset.finish));}
setInterval(updateNext,300);
let debounce=null;
function refreshPreview(){if(state.role!=='member'||!state.me||state.me.status!=='playing')return;
 const me=state.me;if(me.role!=='engineer'&&me.members.length>1)return;
 try{const cfg=readConfig(me.mission.type);liveConfig=cfg;
 const el=document.getElementById('telemetry');if(el)el.innerHTML=telemetry(me.mission.type,cfg);
 const freq=document.getElementById('freq-val');if(freq)freq.textContent=cfg.freq.toFixed(1)+' GHz';
 const voltage=document.getElementById('voltage-val');if(voltage)voltage.textContent=cfg.voltage.toFixed(2)+' V';
 clearTimeout(debounce);debounce=setTimeout(()=>socket.emit('team:config',cfg),100);
 }catch(err){alertUser(err.message,true);}
}
socket.on('connect',async()=>{net(true);
 if(isHostView&&hostPassword){const r=await send('host:auth',hostPassword);hostAuthed=!!r?.ok;render();}
 else if(!isHostView&&saved?.pin&&saved?.token){const r=await send('person:join',saved);if(!r?.ok){saved=null;localStorage.removeItem(key);render();}}
});
socket.on('disconnect',()=>net(false));
socket.on('replaced',()=>{saved=null;localStorage.removeItem(key);state={exists:false,role:'visitor'};render();alertUser('Your registration was resumed on another device.',true);});
socket.on('team:configuration',p=>{if(state.me&&state.me.status==='playing'){
  state.me.config=p.config;liveConfig=p.config;render();
 }});
socket.on('state',s=>{const previous=state.me;clockOffset=number(s.serverNow)?s.serverNow-Date.now():clockOffset;
 state=s;
 if(!s.me||!previous||previous.level!==s.me.level||previous.status!==s.me.status)liveConfig=null;
 if(s.me?.config&&!liveConfig)liveConfig=s.me.config;
 render();
});
socket.on('race:tick',info=>{clockOffset=number(info.serverNow)?info.serverNow-Date.now():clockOffset;state.leaderboard=info.leaderboard;const old=document.getElementById('leaderboard');if(old){const tmp=document.createElement('div');tmp.innerHTML=board(info.leaderboard);old.replaceWith(tmp.firstElementChild);}});
root.addEventListener('input',ev=>{if(ev.target.matches('[data-cfg]'))refreshPreview();});
root.addEventListener('change',ev=>{if(ev.target.matches('[data-cfg]'))refreshPreview();});
root.addEventListener('submit',async ev=>{ev.preventDefault();
 if(ev.target.id==='host-form'){hostPassword=document.getElementById('host-pass').value;const r=await send('host:auth',hostPassword);hostAuthed=!!r?.ok;render();}
 if(ev.target.id==='join-form'){
  const p={pin:document.getElementById('pin').value.trim(),name:document.getElementById('full-name').value.trim(),studentId:document.getElementById('student-id').value.trim(),preferredTeam:document.getElementById('preferred-team').value};
  const r=await send('person:join',p);if(r?.ok){saved={pin:r.pin,token:r.token};localStorage.setItem(key,JSON.stringify(saved));alertUser(`Joined ${r.team} as ${r.role==='reader'?'Mission Reader':'CPU Engineer'}.`);}
 }
});
root.addEventListener('click',async ev=>{const b=ev.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
 if(a==='lookup'){const p=document.getElementById('pin').value.trim(),name=document.getElementById('full-name').value,studentId=document.getElementById('student-id').value;const r=await send('room:lookup',{pin:p});if(r?.ok){roomPreview={...r,pin:p};render();document.getElementById('full-name').value=name;document.getElementById('student-id').value=studentId;alertUser(`${r.teams.length} team(s) have available seats. Or choose automatic assignment.`);}}
 if(a==='create'){await send('host:create');}
 if(a==='copy-link'){try{await navigator.clipboard.writeText(location.origin+'/?pin='+state.pin);alertUser('Join link copied.');}catch(_){alertUser('Please copy the link shown on screen.',true);}}
 if(a==='start'){if(confirm('Start the 10-mission time trial? Individual late joining stays OPEN.'))await send('host:start');}
 if(a==='export'){const r=await send('host:export');if(r?.ok){downloadFile(r.csv,r.filename,'text/csv;charset=utf-8;');alertUser('Individual/group grades exported.');}}
 if(a==='backup'){const r=await send('host:backup');if(r?.ok){downloadFile(r.json,r.filename,'application/json');alertUser('PRIVATE recovery backup saved. Keep it secure.');}}
 if(a==='restore'){const file=document.getElementById('recovery-file')?.files?.[0];if(!file)return alertUser('Choose your private .json recovery backup first.',true);
  if(!confirm('Restore this backup? This REPLACES the current room and scores; export them first.'))return;
  const raw=await file.text();const r=await send('host:restore',raw);if(r?.ok)alertUser('Backup restored! Ask students to refresh their game tabs.');}
 if(a==='reset'){if(!state.exists)return;const typed=prompt('This DELETES all current group scores. Download CSV first. Type the six-digit room PIN to confirm:');if(typed===state.pin){const r=await send('host:reset',{confirmPin:typed});if(r?.ok)alertUser('New classroom lobby created.');}else if(typed!==null)alertUser('PIN did not match. No scores deleted.',true);}
 if(a==='replay'){if(!confirm('Start another 10-mission attempt for your ENTIRE team? Your previous finished result will stay on the leaderboard.'))return;const r=await send('team:replay');if(r?.ok){liveConfig=null;alertUser(`Started ${r.runLabel}. Previous attempt safely archived.`);}}
 if(a==='retry'){const r=await send('team:retry');if(r?.ok)alertUser('CPU repaired. Continue the current mission!');}
 if(a==='attempt'&&!sending){if(!state.me||!state.me.mission)return;try{
  const cfg=readConfig(state.me.mission.type);clearTimeout(debounce);sending=true;b.disabled=true;
  const r=await send('team:attempt',cfg);sending=false;
  if(r?.ok)alertUser(r.feedback.message,!r.feedback.result.passed);
  else b.disabled=false;
 }catch(err){sending=false;b.disabled=false;alertUser(err.message,true);}}
});
render();

// Deterrence only. Browser/OS screenshots, external cameras, and DevTools cannot be reliably blocked.
document.addEventListener('contextmenu',ev=>{if(ev.target.closest('.protected-content')){ev.preventDefault();alertUser('Mission text must be read aloud; copying is restricted.',true);}});
for(const type of ['copy','cut','dragstart'])document.addEventListener(type,ev=>{if(ev.target.closest('.protected-content')||(window.getSelection()?.anchorNode?.parentElement?.closest('.protected-content'))){ev.preventDefault();}});
document.addEventListener('visibilitychange',()=>document.body.classList.toggle('privacy-hidden',document.hidden));
window.addEventListener('beforeprint',()=>document.body.classList.add('printing-private'));
window.addEventListener('afterprint',()=>document.body.classList.remove('printing-private'));

window.addEventListener('blur',()=>document.body.classList.add('privacy-hidden'));
window.addEventListener('focus',()=>{if(!document.hidden)document.body.classList.remove('privacy-hidden');});
