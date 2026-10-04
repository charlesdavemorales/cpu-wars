'use strict';
const M = require('./public/model.js');
const TOTAL = 10;
const ORIGINAL_COUNT = 10;
const BANK_COUNT = 25;
const round2 = n => Math.round(n * 100) / 100;
// Each mission follows a section or concrete example in CPU_Power_Consumption.docx.
// Targets, modeled watts, CPU heat, and deadlines are game assumptions—not manual measurements.
const SOURCE_MISSIONS = [
  {
    title:'Find the Power Thief', subtitle:'Dynamic power and static leakage',
    source:'Manual p. 1: Components of CPU Power; Dynamic Power vs. Static Power',
    contexts:['A smartphone is displaying a web page','A portable processor has a light workload','A processor is waiting between short tasks'],
    lesson:'Your manual defines total CPU power as dynamic power plus static power. Dynamic power comes from transistor switching; static power comes mainly from leakage while a circuit remains powered. Clock gating stops idle switching but not leakage. Power gating can reduce leakage for blocks idle long enough to justify wake-up cost.'
  },
  {
    title:'DVFS: Reading Mode', subtitle:'Lower voltage and frequency for light work',
    source:'Manual pp. 1–3: Dynamic Power formula and DVFS; Smartphone example',
    contexts:['A smartphone user is reading a web page','A battery-powered mobile device is doing a light task','A portable processor is under light workload'],
    lesson:'The manual explains DVFS: match the supply voltage and clock frequency to the current workload. In its example, lowering voltage from 1.2 V to 0.9 V at fixed frequency reduces modeled dynamic power to 56.25% of the original. The game uses the manual’s Pdynamic = α × C × V² × f relationship. These specific available clock/voltage settings are illustrative.'
  },
  {
    title:'Gate the Idle Blocks', subtitle:'Clock gating and power gating',
    source:'Manual pp. 2–3: Clock Gating; Power Gating; Hardware Accelerators',
    contexts:['A wireless sensor node is waiting for an event','A smart-agriculture microcontroller is operating','A battery-powered monitoring system is between readings'],
    lesson:'Clock gating stops unnecessary clock signals but leaves the block powered, so leakage remains. Power gating cuts the supply to unused blocks, saving leakage but increasing wake-up time and energy. The manual also notes that a hardware accelerator may be energy-efficient for suitable tasks, but its own power must be considered.'
  },
  {
    title:'Thermal Throttling Crisis', subtitle:'Frequency, cores, heat and safe workload',
    source:'Manual pp. 2–3: Factors That Affect Power; Thermal Throttling; Smartphone example',
    contexts:['A smartphone starts a demanding game','A high-load mobile processor is working','A processor begins a compute-heavy job'],
    lesson:'Higher frequency, heavier workload and more active cores can increase CPU power and heat. The manual explains thermal throttling: the processor lowers its speed when it becomes too hot to protect hardware. The game’s 75°C threshold, throughput calculation and optional cooling costs are simplified simulation rules, not claims about real CPUs.'
  },
  {
    title:'Smart Farm: Wake, Read, Sleep', subtitle:'Deep sleep in an embedded system',
    source:'Manual p. 4: Battery-Powered Agricultural Monitoring example',
    contexts:['A soil-monitoring node checks the farm','A small solar-powered farm sensor samples soil','A battery-powered agricultural sensor is on duty'],
    lesson:'The manual’s agricultural node measures temperature and soil moisture every 15 minutes, sends readings wirelessly, then returns to deep sleep. Awake processing uses more energy than standby. In this illustrative game, each measurement cycle lasts 900 seconds; total energy is modeled in joules, so remaining asleep for most of the cycle preserves battery life.'
  },
  {
    title:'Leakage vs. Fast Wake-Up', subtitle:'Why idle does not mean zero power',
    source:'Manual pp. 1–3: Static Power; Clock/Power Gating; CPU Power Management example',
    contexts:['A smartphone is about to resume multiple tasks','A mobile processor expects an incoming event','A processor has several blocks needed again soon'],
    lesson:'The manual emphasizes that idle powered transistors still leak. However, power gating every idle block is not automatically best: the manual warns that powering back on takes time and energy. When graphics and radio are needed again soon in this simulation, clock gating keeps them powered for a faster response; the main core stays running.'
  },
  {
    title:'DVFS: Gaming Mode', subtitle:'Performance needs versus battery and heat',
    source:'Manual pp. 2–3: DVFS; How Power Management Works; Smartphone example',
    contexts:['The smartphone user starts a game','A mobile device shifts from reading to heavy processing','A phone suddenly needs near-maximum CPU performance'],
    lesson:'The smartphone example in the manual raises frequency, voltage and active cores when a game starts. This increases performance but often power and heat too. Choose only enough voltage for the frequency required by the task. The manual describes a monitor → decide → adjust → gate → protect cycle; DVFS is one of its main adjustments.'
  },
  {
    title:'Ready Now or Sleep Longer?', subtitle:'Wake-up delay versus leakage savings',
    source:'Manual pp. 2–3: Clock Gating; Power Gating; Low-Power Modes; Hardware Accelerators',
    contexts:['A smart-agriculture controller expects a radio event','A wireless sensor node must respond soon','An embedded control system has urgent and long-idle blocks'],
    lesson:'The manual says power gating reduces leakage for blocks unused for longer periods, whereas clock gating is useful for temporarily idle blocks. Deeper power states can take longer to wake. Keep imminent sensor and network work responsive while saving energy in the long-idle accelerator. The numerical power limits here are game-specific.'
  },
  {
    title:'Beat the Heat', subtitle:'Active cores and thermal protection',
    source:'Manual pp. 2–3: Factors That Affect CPU Power; Thermal Throttling',
    contexts:['A mobile processor is handling a large workload','A multi-core processor is pushed under heavy demand','A smartphone CPU heats up during sustained processing'],
    lesson:'The manual lists frequency, workload, active-core count and temperature among important power factors. It also warns that hitting thermal limits can force the CPU to reduce speed, hurting performance. In the game, seek enough processing throughput without crossing the illustrative 75°C throttle threshold or wasting power on unnecessary active cores.'
  },
  {
    title:'Farm Endurance Finale', subtitle:'Energy = power × time across a full duty cycle',
    source:'Manual pp. 3–4: Power versus Energy; Embedded-System Agricultural Monitoring',
    contexts:['A battery-powered farm sensor needs a slightly longer reading','A smart-agriculture sensor must process and transmit data','A small solar-powered farm node is scheduling measurements'],
    lesson:'Power (watts) is the rate of energy use; energy (joules) accumulates over time. The manual’s agricultural monitor wakes periodically, measures soil temperature/moisture, transmits wirelessly and goes back to deep sleep for most of its 15-minute interval. This game requires eight active seconds as an illustrative workload, not as a specification stated in the manual.'
  }
  ,
  // Fifteen additional manual-grounded challenges, three for each existing CPU control mechanic.
  // Every replay selects five of these and five from missions 1–10.
  {
    title:'Radio Standby Strategy', subtitle:'Static leakage while waiting for transmission',
    source:'Manual pp. 1–2: Static Power; Clock Gating; Power Gating',
    contexts:['A portable device will transmit wirelessly again shortly','A field-monitoring processor will not need its graphics block today','A portable node has a scheduled radio wake-up'],
    graphicsSoon:false,radioSoon:true,
    lesson:'Power-gate graphics when they will remain unused, but clock-gate a soon-needed radio so it remains powered and ready. Static leakage persists in clock-gated circuitry, whereas power gating trades wake-up cost for leakage savings.'
  },
  {
    title:'DVFS: Balanced Workload', subtitle:'Voltage squared and midrange processing',
    source:'Manual pp. 1–2: Dynamic Power; DVFS; Factors Affecting CPU Power',
    contexts:['A tablet is processing a medium-sized document','A portable processor alternates between light and medium work','A CPU is handling a moderate workload'],
    performanceTarget:50,
    lesson:'DVFS chooses a clock speed sufficient for the workload and its minimum stable voltage. Dynamic power varies with voltage squared and frequency. Reducing both below a high-performance setting can save energy if the work still completes.'
  },
  {
    title:'Network Alert at Dawn', subtitle:'Prepare an imminent transmission',
    source:'Manual pp. 2–3: Clock Gating; Power Gating; Memory and I/O Activity',
    contexts:['A wireless node must transmit as soon as its sensor wakes','An embedded controller is waiting for urgent telemetry','A farm monitor will send a reading very soon'],
    networkSoon:true,acceleratorSoon:false,
    lesson:'A network needed immediately should remain powered: clock gating reduces idle switching without the longer wake-up of power gating. The accelerator can be power-gated while unused for a long interval. I/O activity itself consumes energy.'
  },
  {
    title:'Thermal Safety Check', subtitle:'Avoid excessive active cores',
    source:'Manual pp. 2–3: Number of Active Cores; Thermal Throttling',
    contexts:['A handheld CPU handles a short computation','A processor must finish a small burst without overheating','An embedded device processes a periodic workload'],
    workTarget:28,
    lesson:'More active cores and higher clock frequency can increase power and temperature. Thermal throttling protects the CPU by reducing its speed after exceeding thermal limits; choose only enough resources for the required work.'
  },
  {
    title:'Wearable Wake Cycle', subtitle:'Deep sleep for a battery-powered device',
    source:'Manual pp. 2–3: Sleep and Low-Power Modes; Wearable Devices',
    contexts:['A wearable briefly samples environmental conditions','A battery-powered sensor needs a longer acquisition interval','A small portable monitor wakes periodically'],
    minAwake:15,
    lesson:'The manual highlights battery life in wearable and portable embedded devices. The simulation uses the manual’s wake–work–sleep principle in a 15-minute illustrative measurement cycle; 15 active seconds is a game target, not a hardware requirement stated by the manual.'
  },
  {
    title:'Graphics Wakes First', subtitle:'Choosing clock gating for urgent graphics',
    source:'Manual pp. 1–3: Dynamic vs. Static Power; Clock Gating; Power Gating',
    contexts:['A mobile device is about to redraw its screen','A portable CPU is waiting to display a notification','A processor expects a graphics update soon'],
    graphicsSoon:true,radioSoon:false,
    lesson:'Clock gating an imminently needed graphics unit saves switching power while keeping it electrically powered for fast reuse. A radio idle for a long time can instead be power-gated to reduce leakage.'
  },
  {
    title:'DVFS: Video Processing', subtitle:'Keeping up with a substantial workload',
    source:'Manual pp. 2–3: DVFS; Hardware Accelerators; How Power Management Works',
    contexts:['A mobile device is processing a video clip','A CPU receives a demanding application workload','A portable processor must complete substantial processing'],
    performanceTarget:70,
    lesson:'Under DVFS, a substantial workload needs higher frequency and sufficient voltage than a reading-only workload. The system should monitor load and adjust CPU settings instead of using maximum power for all tasks.'
  },
  {
    title:'Accelerator Wake-Up', subtitle:'Prepare specialized hardware when needed soon',
    source:'Manual pp. 2–3: Hardware Accelerators; Clock Gating; Power Gating',
    contexts:['A hardware accelerator will be needed shortly for suitable work','A sensor must respond quickly before specialized processing','An embedded node has an imminent accelerated task'],
    networkSoon:false,acceleratorSoon:true,
    lesson:'The manual explains that hardware accelerators can use less energy for suitable work, but their own power must be counted. Keep a soon-needed accelerator clock-gated rather than powered off when wake-up delay matters; a long-idle network can be power-gated.'
  },
  {
    title:'Workload Spike', subtitle:'Performance without thermal throttling',
    source:'Manual pp. 2–3: Workload; CPU Cores; Thermal Throttling',
    contexts:['A multi-core processor sees a new compute request','A handheld CPU must process a medium load quickly','A device starts a short CPU-heavy task'],
    workTarget:56,
    lesson:'CPU activity, frequency and number of active cores interact to determine heat and throughput. Thermal throttling reduces the effective throughput if temperature becomes excessive, so an efficient solution meets the workload without excess heat.'
  },
  {
    title:'Wireless Sensor Endurance', subtitle:'Energy savings across long standby',
    source:'Manual pp. 3–4: Wireless Sensor Nodes; Battery-Powered Agriculture',
    contexts:['A remote wireless node measures soil every 15 minutes','A smart agriculture station has a longer sampling job','A field sensor must transmit before going to sleep'],
    minAwake:30,
    lesson:'The manual describes wireless sensor nodes and agricultural monitoring devices that wake briefly, measure, transmit, and sleep. In the simulation, thirty active seconds represents a longer job; the principle is to minimize standby draw over the remaining cycle.'
  },
  {
    title:'Power-State Mix', subtitle:'Mixing long-idle and soon-needed CPU blocks',
    source:'Manual pp. 1–3: Dynamic Power; Static Power; Clock Gating; Power Gating',
    contexts:['A mobile CPU has no scheduled radio or graphics task','An embedded controller waits between long-spaced jobs','A low-power device is handling a lightweight main-core task'],
    graphicsSoon:false,radioSoon:false,
    lesson:'For long-idle, unused blocks, power gating reduces static leakage that clock gating leaves behind. Keep the core operating for current work, and clock-gate a timer needed soon to avoid idle dynamic switching.'
  },
  {
    title:'DVFS: Peak Demand', subtitle:'Meet a full performance requirement efficiently',
    source:'Manual pp. 2–3: DVFS; Smartphone Game Example; Processor Performance',
    contexts:['A phone must reach peak CPU processing for a demanding job','A processor receives a maximum-performance request','A device switches from reading to intense computation'],
    performanceTarget:100,
    lesson:'High workloads may justify a high CPU frequency and associated safe voltage. DVFS means matching performance to actual demand rather than always running at a low clock or always selecting maximum power.'
  },
  {
    title:'Dual Wake-Up Alert', subtitle:'Network and accelerator required soon',
    source:'Manual pp. 2–3: Co-Processors and Hardware Accelerators; Power Gating',
    contexts:['Both network and accelerator tasks are due soon','A sensor must trigger specialized processing followed by fast wireless I/O','A smart device is preparing two imminently needed hardware blocks'],
    networkSoon:true,acceleratorSoon:true,
    lesson:'A specialist accelerator may be efficient at its particular task, but its power usage must be included. Clock-gate the soon-needed network and accelerator instead of cutting their supply, because reactivation may delay urgent work.'
  },
  {
    title:'Protect the Processor', subtitle:'Find the right frequency–core balance',
    source:'Manual pp. 2–3: Active Cores; Temperature; Thermal Throttling',
    contexts:['A sustained workload threatens a portable CPU thermal limit','A processor must finish a heavier compute job','A multi-core embedded system handles a burst of processing'],
    workTarget:80,
    lesson:'The manual describes thermal throttling as a protective reduction in CPU speed. Balance active cores and frequency to complete the work without reaching the game thermal limit or wasting power.'
  },
  {
    title:'Solar Farm Duty Cycle', subtitle:'Longer work before deep sleep',
    source:'Manual pp. 3–4: Battery and Solar Supply; Agricultural Monitoring',
    contexts:['A small solar-powered farm node performs extended diagnostics','An agricultural sensor needs longer processing before wireless reporting','A battery-backed farm monitor runs a longer measurement'],
    minAwake:60,
    lesson:'Power is energy-use rate while energy accumulates across time. Even when processing takes longer, the manual’s farm-monitoring idea favors spending as much remaining time as feasible in a low-power sleep mode. Sixty active seconds is illustrative.'
  }
];
function missionFor(index, variant=0) {
  if (!Number.isInteger(index) || index < 0 || index >= BANK_COUNT) throw Error('Invalid mission index.');
  const tier = Math.floor(index / 5), type = index % 5;
  const spec = SOURCE_MISSIONS[index];
  const contexts=spec.contexts;
  const out = { number:index+1, type, tier:tier+1, title:spec.title, subtitle:spec.subtitle, lesson:spec.lesson,
    source:spec.source, scenario:contexts[Math.abs(Math.trunc(variant)) % contexts.length], parameters:{}, brief:'', goal:'' };
  let p=out.parameters;
  if (type===0) {
    p.graphicsSoon=spec.graphicsSoon??(tier===1); p.radioSoon=spec.radioSoon??(tier===1);
    p.opt={core:'run',graphics:p.graphicsSoon?'clock':'off',radio:p.radioSoon?'clock':'off',timer:'clock'};
    const v=M.simulate(0,p.opt).values;
    p.wattLimit=round2(v.total+(tier===0?.15:.25));
    out.brief=`${out.scenario}. The main CPU core has work now and a timer event is coming soon. ${p.graphicsSoon?'Graphics will be required again VERY SOON.':'Graphics will be idle for a LONG time.'} ${p.radioSoon?'The radio will be required again VERY SOON.':'The radio will be idle for a LONG time.'} Observe the switching and leakage readouts while choosing run, clock gate, or power gate for each block.`;
    out.goal=`Keep the core running and the timer powered. ${p.graphicsSoon?'Keep graphics powered for prompt wake-up.':'Graphics may be power-gated for the long idle.'} ${p.radioSoon?'Keep radio powered for prompt wake-up.':'Radio may be power-gated for the long idle.'} Meet a total-power budget of ${p.wattLimit.toFixed(2)} W while minimizing idle switching.`;
  } else if(type===1) {
    p.performanceTarget=spec.performanceTarget??(tier===0?30:90);
    p.optFreq=[.6,1,1.4,1.8,2].find(f => f/2*100>=p.performanceTarget);
    p.optVoltage=M.minVoltage[String(p.optFreq)];
    const v=M.simulate(1,{freq:p.optFreq,voltage:p.optVoltage}).values;
    p.wattLimit=round2(v.total+(tier===0?.12:.22));
    p.tempLimit=round2(v.temp+(tier===0?1:2));
    out.brief=`${out.scenario}. Apply Dynamic Voltage and Frequency Scaling (DVFS). The required processing target is ${p.performanceTarget}% of the reference performance. Do not choose settings that waste power or make the processor unstable. Experiment with frequency and voltage; too little voltage for a selected clock rate is unstable in this game.`;
    out.goal=`Stable CPU performance of at least ${p.performanceTarget}%, total power at most ${p.wattLimit.toFixed(2)} W, and temperature at most ${p.tempLimit.toFixed(1)}°C. Find the lowest suitable frequency and voltage.`;
  } else if(type===2) {
    p.networkSoon=spec.networkSoon??(tier===1); p.acceleratorSoon=spec.acceleratorSoon??false;
    p.opt={control:'run',sensor:'clock',network:p.networkSoon?'clock':'off',accelerator:p.acceleratorSoon?'clock':'off'};
    const v=M.simulate(2,p.opt).values;
    p.wattLimit=round2(v.total+(tier===0?.1:.2));
    out.brief=`${out.scenario}. A controller must keep processing and a sensor needs to respond to an URGENT event. ${p.networkSoon?'Wireless network transmission is also needed again SOON.':'The network can remain unused for a LONG interval.'} ${p.acceleratorSoon?'The specialized accelerator is needed again SOON.':'The specialized accelerator is unused for a LONG time.'} Choose block states while considering leakage and wake-up delay.`;
    out.goal=`Keep control running and sensor powered. ${p.networkSoon?'Keep the network powered for quick wireless transmission.':'Network can be power-gated while idle.'} ${p.acceleratorSoon?'Keep the accelerator powered for prompt wake-up.':'The long-idle accelerator can be power-gated.'} Total modeled draw must not exceed ${p.wattLimit.toFixed(2)} W.`;
  } else if(type===3) {
    p.workTarget=spec.workTarget??(tier===0?50:72);
    const choices=[];
    for(const freq of [1,1.4,1.8,2]) for(const cores of [1,2,4]) for(const cooling of [false,true]) {
      const config={freq,cores,cooling}, v=M.simulate(3,config).values;
      if(!v.throttled && v.work>=p.workTarget && v.temp<=75) choices.push({config,v});
    }
    choices.sort((a,b)=>a.v.watts-b.v.watts || a.v.temp-b.v.temp || a.config.cores-b.config.cores);
    if (!choices.length) throw Error('Unsolvable thermal mission: '+index);
    p.opt=choices[0].config;
    p.wattLimit=round2(choices[0].v.watts+(tier===0?.15:.35));
    p.tempLimit=round2(Math.min(75,choices[0].v.temp+(tier===0?.5:1)));
    out.brief=`${out.scenario}. Choose clock frequency, number of active CPU cores, and optional cooling. You must reach ${p.workTarget} simulated compute units without overheating. In this GAME MODEL, exceeding 75°C triggers thermal throttling and loses 45% of throughput.`;
    out.goal=`Produce at least ${p.workTarget} work units, with NO thermal throttle; temperature at most ${p.tempLimit.toFixed(1)}°C; total draw at most ${p.wattLimit.toFixed(2)} W. Avoid unnecessary active cores or cooling power.`;
  } else {
    p.minAwake=spec.minAwake??(tier===0?4:8);
    const opt=M.simulate(4,{awake:p.minAwake,mode:'deep',sensor:true,radio:true}).values;
    p.energyLimit=round2(opt.energy+(tier===0?.12:.25));
    out.brief=`${out.scenario}. As in the manual's smart-agriculture example, measure soil conditions and transmit once every 15 minutes (900 seconds). This simulated workload requires at least ${p.minAwake} active seconds to complete measurement and transmission. Select awake duration, low-power mode, sensor availability and radio availability.`;
    out.goal=`Keep soil sensor and radio enabled. Be awake for at least ${p.minAwake} seconds, then minimize standby power. Complete the 15-minute cycle within ${p.energyLimit.toFixed(2)} J of modeled energy.`;
  }
  return out;
}
function assess(index, raw, variant=0) {
  const mission=missionFor(index,variant), p=mission.parameters, type=mission.type;
  const x=M.normalize(type,raw), s=M.simulate(type,x), v=s.values;
  let checks;
  if(type===0) {
    const ready=x.core==='run' && x.timer!=='off' && (!p.graphicsSoon || x.graphics!=='off') && (!p.radioSoon || x.radio!=='off');
    checks=[['Meet core and wake-up requirements',ready,10],['Stay within the power budget',ready && v.total<=p.wattLimit+1e-6,5],
      ['Clock-gate the near-future timer',ready && x.timer==='clock',3],['Correctly optimize idle circuit blocks',ready && x.graphics===p.opt.graphics && x.radio===p.opt.radio,2]];
  } else if(type===1) {
    const ready=v.valid && v.performance>=p.performanceTarget;
    checks=[['Stable CPU meets processing deadline',ready,10],['Meet the watt budget',ready && v.total<=p.wattLimit+1e-6,5],
      ['Stay within the temperature target',ready && v.temp<=p.tempLimit+1e-6,3],['Use efficient minimum-speed / voltage combination',ready && x.freq===p.optFreq && x.voltage===p.optVoltage,2]];
  } else if(type===2) {
    const ready=x.control==='run' && x.sensor!=='off' && (!p.networkSoon || x.network!=='off') && (!p.acceleratorSoon || x.accelerator!=='off');
    checks=[['Keep urgent blocks available',ready,10],['Respect this mission’s energy budget',ready && v.total<=p.wattLimit+1e-6,5],
      ['Clock-gate the urgent sensor safely',ready && x.sensor==='clock',3],['Match the long/short-idle power states',ready && x.network===p.opt.network && x.accelerator===p.opt.accelerator,2]];
  } else if(type===3) {
    const ready=!v.throttled && v.work>=p.workTarget;
    checks=[['Complete processing without thermal throttle',ready,10],['Meet temperature target',ready && v.temp<=p.tempLimit+1e-6,5],
      ['Meet power target',ready && v.watts<=p.wattLimit+1e-6,3],['Find the efficient frequency/core/cooling configuration',ready && x.freq===p.opt.freq && x.cores===p.opt.cores && x.cooling===p.opt.cooling,2]];
  } else {
    const ready=v.complete && x.awake>=p.minAwake;
    checks=[['Measure and transmit on schedule',ready,10],['Meet the joule budget',ready && v.energy<=p.energyLimit+1e-6,5],
      ['Use deep sleep between measurements',ready && x.mode==='deep',3],['Use the minimum required awake duration',ready && x.awake===p.minAwake,2]];
  }
  const breakdown=checks.map(([label,passed,max])=>({label,passed:!!passed,max,earned:passed?max:0}));
  return { score:breakdown.reduce((a,b)=>a+b.earned,0), passed:breakdown[0].passed, breakdown, metrics:s.metrics,
    observations:s.observations, config:x, mission:mission.number };
}
module.exports={TOTAL,ORIGINAL_COUNT,BANK_COUNT,missionFor,assess};
