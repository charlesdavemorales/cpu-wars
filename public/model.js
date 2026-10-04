/* Shared, intentionally simplified educational model. No real CPU telemetry. */
(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  root.CPUModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const missions = [
    {
      title: 'Find the Power Thief', subtitle: 'Dynamic power versus leakage',
      brief: 'The CPU must process an important job. Graphics and radio will not be needed for a while, but a short timer event is coming soon. Decide which blocks should run, be clock-gated, or be power-gated.',
      goal: 'Keep the processing core running, keep the short timer ready, and minimize power.',
      lesson: 'Dynamic power comes from switching activity. Clock gating stops unnecessary switching but powered blocks can still leak. Power gating removes supply from unused blocks, reducing leakage, but restarting takes time and energy.'
    },
    {
      title: 'The Perfect Balance', subtitle: 'Dynamic Voltage and Frequency Scaling',
      brief: 'The Mission Reader provides the current workload target. Pick a suitable voltage and clock frequency for DVFS; low and high workloads have different requirements.',
      goal: 'Complete the deadline with the lowest reasonable energy draw.',
      lesson: 'In the simplified CMOS model, dynamic power changes in proportion to voltage squared and clock frequency: Pdynamic ≈ αCV²f. Reducing voltage matters strongly, but the CPU still requires a minimum voltage at each clock speed.'
    },
    {
      title: 'Power Architect', subtitle: 'Clock gating, power gating and wake-up',
      brief: 'A control CPU is busy. A sensor event is due very soon. The network and AI accelerator will remain idle longer. Choose a power state for each block.',
      goal: 'Keep urgent functions ready and minimize wasted energy in unused components.',
      lesson: 'Clock gating is useful for a block that must respond quickly because the circuit remains powered. Power gating can save leakage during long idle periods, but wake-up has a delay and energy cost.'
    },
    {
      title: 'Thermal Meltdown', subtitle: 'Load, active cores and throttling',
      brief: 'Your Mission Reader supplies the current processing target. Configure active cores, CPU frequency and optional cooling; this virtual CPU throttles above 75°C.',
      goal: 'Finish the job while staying under the thermal limit.',
      lesson: 'Higher clock rate and more active cores can raise processing throughput and power use. Too much heat triggers thermal throttling: the CPU deliberately slows down for protection.'
    },
    {
      title: 'Smart Farm Finale', subtitle: 'Low-power embedded systems',
      brief: 'An agricultural sensor node wakes every 15 minutes to read soil sensors, process data and transmit wirelessly. Your Mission Reader states how many simulated active seconds are needed. Configure the duty cycle and sleep mode.',
      goal: 'Successfully measure and transmit while meeting the current mission’s modeled energy budget.',
      lesson: 'A battery-powered embedded system can spend most of its time in deep sleep, waking briefly to measure and transmit. Energy equals power multiplied by time; wake-up overhead and peripheral availability also matter.'
    }
  ];
  const freqs2 = [0.6, 1, 1.4, 1.8, 2];
  const voltages2 = [0.7, 0.78, 0.9, 1.03, 1.15, 1.2];
  const minVoltage = { '0.6': 0.7, '1': 0.78, '1.4': 0.9, '1.8': 1.03, '2': 1.15 };
  const gate = ['run', 'clock', 'off'];
  const has = (x, list) => list.some(v => v === x);
  const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const defaultConfigs = [
    { core: 'run', graphics: 'run', radio: 'run', timer: 'run' },
    { freq: 2, voltage: 1.2 },
    { control: 'run', sensor: 'run', network: 'run', accelerator: 'run' },
    { freq: 2, cores: 4, cooling: false },
    { awake: 60, mode: 'always', sensor: true, radio: true }
  ];
  function normalize(level, data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid configuration.');
    switch (level) {
      case 0: {
        const out = {};
        for (const k of ['core', 'graphics', 'radio', 'timer']) {
          if (!has(data[k], gate)) throw Error('Invalid block state: ' + k);
          out[k] = data[k];
        }
        return out;
      }
      case 1: {
        const f = Number(data.freq), v = Number(data.voltage);
        if (!has(f, freqs2) || !has(v, voltages2)) throw Error('Select a valid frequency and voltage.');
        return { freq: f, voltage: v };
      }
      case 2: {
        const out = {};
        for (const k of ['control', 'sensor', 'network', 'accelerator']) {
          if (!has(data[k], gate)) throw Error('Invalid block state: ' + k);
          out[k] = data[k];
        }
        return out;
      }
      case 3: {
        const f = Number(data.freq), c = Number(data.cores);
        if (!has(f, [1, 1.4, 1.8, 2]) || !has(c, [1, 2, 4]) || typeof data.cooling !== 'boolean') throw Error('Invalid thermal configuration.');
        return { freq: f, cores: c, cooling: data.cooling };
      }
      case 4: {
        const awake = Number(data.awake);
        if (!has(awake, [4, 8, 15, 30, 60]) || !has(data.mode, ['deep', 'idle', 'always']) ||
            typeof data.sensor !== 'boolean' || typeof data.radio !== 'boolean') throw Error('Invalid sensor schedule.');
        return { awake, mode: data.mode, sensor: data.sensor, radio: data.radio };
      }
      default: throw Error('Unknown mission.');
    }
  }
  function simulate(level, input) {
    const x = normalize(level, input);
    if (level === 0) {
      const blocks = {
        core: { switching: 4, leakage: .8 },
        graphics: { switching: .9, leakage: .8 },
        radio: { switching: .7, leakage: .45 },
        timer: { switching: .25, leakage: .15 }
      };
      let dynamic = 0, staticW = 0;
      for (const [k, b] of Object.entries(blocks)) {
        if (x[k] === 'run') { dynamic += b.switching; staticW += b.leakage; }
        else if (x[k] === 'clock') staticW += b.leakage;
      }
      const ready = x.core === 'run' && x.timer !== 'off';
      return { metrics: { 'Dynamic power': round(dynamic) + ' W', 'Static power': round(staticW) + ' W', 'Total draw': round(dynamic + staticW) + ' W', 'Core / timer readiness': ready ? 'READY' : 'FAILED' },
        values: { dynamic, staticW, total: dynamic + staticW, ready },
        observations: [x.graphics === 'clock' || x.radio === 'clock' || x.timer === 'clock' ? 'Clock gating eliminates switching power in the selected idle blocks, but their leakage continues.' : 'Blocks left running keep consuming switching power.',
          Object.values(x).includes('off') ? 'Power-gated blocks no longer consume modelled leakage. Consider wake-up time before using power gating.' : 'No blocks are power-gated, so all remain electrically powered.',
          !ready ? 'Warning: you shut off a component required for the current job or near-future timer.' : 'Both urgent components remain available.'] };
    }
    if (level === 1) {
      const minV = minVoltage[String(x.freq)];
      const valid = x.voltage + .00001 >= minV;
      // Dynamic CMOS model normalized to a 12-W maximum example; illustrative constants.
      const dynamic = 12 * Math.pow(x.voltage / 1.2, 2) * (x.freq / 2);
      const staticW = 1.4 + .8 * (x.voltage / 1.2);
      const total = dynamic + staticW;
      const temp = 35 + 4 * total;
      const performance = valid ? x.freq / 2 * 100 : 0;
      return { metrics: { 'Minimum voltage here': minV.toFixed(2) + ' V', 'Dynamic power': round(dynamic) + ' W', 'Static power': round(staticW) + ' W', 'Total draw': round(total) + ' W', 'Effective processing': round(performance) + '%', 'Temperature estimate': round(temp) + '°C', 'Operating state': valid ? 'STABLE' : 'UNDERVOLTAGE — INVALID' },
        values: { valid, minV, dynamic, staticW, total, temp, performance },
        observations: [valid ? 'This voltage is sufficient for the selected clock speed in the game model.' : 'The CPU cannot reliably operate at this clock rate with such a low supply voltage.',
          'Compare different settings: dynamic power depends on V² multiplied by frequency, not frequency squared.',
          'Ask your Mission Reader for the current processing target; the required throughput differs for light and heavy workloads.'] };
    }
    if (level === 2) {
      const blocks = { control: { run: 2.5, clock: .3 }, sensor: { run: .35, clock: .12 }, network: { run: .6, clock: .2 }, accelerator: { run: .9, clock: .3 } };
      let total = 0;
      Object.keys(blocks).forEach(k => { total += x[k] === 'off' ? 0 : blocks[k][x[k]]; });
      const ready = x.control === 'run' && x.sensor !== 'off';
      const wake = x.sensor === 'off' ? 'SENSOR LATE' : 'ON TIME';
      return { metrics: { 'Average active draw': round(total) + ' W', 'Urgent sensor event': wake, 'Current job': x.control === 'run' ? 'RUNNING' : 'STOPPED', 'Control / sensor readiness': ready ? 'READY' : 'FAILED' },
        values: { total, ready },
        observations: [x.sensor === 'off' ? 'The short-notice sensor event may be missed due to power-gating wake-up latency.' : 'The soon-needed sensor remains powered and can respond promptly.',
          x.network === 'off' || x.accelerator === 'off' ? 'An unused long-idle block is power-gated: leakage is saved until it is needed.' : 'The long-idle blocks could still waste leakage while powered.',
          x.sensor === 'clock' ? 'Clock gating the sensor keeps it ready while reducing unnecessary switching.' : 'Try comparing sensor run, clock-gated and power-gated states.'] };
    }
    if (level === 3) {
      const temp = 36 + 12 * (x.freq / 1.4) * x.cores - (x.cooling ? 11 : 0);
      const throttled = temp > 75;
      const rawWork = x.freq * x.cores * 20;
      const work = rawWork * (throttled ? .55 : 1);
      const watts = 1.5 + 2 * (x.freq / 1.4) * x.cores + (x.cooling ? 2 : 0);
      return { metrics: { 'CPU temperature': round(temp) + '°C', 'Compute throughput': round(work) + ' units', 'Power draw': round(watts) + ' W', 'Thermal throttling': throttled ? 'ACTIVE (45% lost)' : 'OFF', 'Processing state': throttled ? 'THROTTLED' : 'OPERATING' },
        values: { temp, throttled, work, watts },
        observations: [throttled ? 'The CPU exceeded 75°C, so the simulated safety controller cuts effective throughput.' : 'The CPU stays under the game thermal limit.',
          'Compare the compute units with the mission-specific target given by your Mission Reader; unnecessary cores and speed can waste energy.',
          x.cooling ? 'Active cooling lowers estimated temperature but has its own power cost.' : 'Cooling is off, saving auxiliary power but allowing a higher temperature.'] };
    }
    if (level === 4) {
      const activePower = .6;
      const standby = { deep: .003, idle: .08, always: .6 }[x.mode];
      const energy = activePower * x.awake + standby * (900 - x.awake) + (x.mode === 'deep' ? .12 : 0);
      const complete = x.awake >= 4 && x.sensor && x.radio;
      return { metrics: { 'Cycle duration': '900 seconds', 'Awake time': x.awake + ' seconds', 'Standby power': standby + ' W', 'Energy each cycle': round(energy) + ' J', 'Baseline sensor / radio cycle': complete ? 'AVAILABLE' : 'FAILED' },
        values: { energy, complete },
        observations: [x.mode === 'deep' ? 'Deep sleep minimizes idle power; the model also includes a small wake-up energy cost.' : x.mode === 'idle' ? 'Idle mode consumes substantially more energy across a 15-minute cycle than deep sleep.' : 'Staying fully powered while idle wastes energy during most of the 15-minute cycle.',
          'Longer awake time raises active energy; consult the current mission for the minimum required processing time.',
          !complete ? 'Both sensor and radio must be enabled to complete a usable measurement and transmission.' : 'Measurement and wireless transmission are available.'] };
    }
    throw Error('Unknown mission.');
  }
  return { missions, defaultConfigs, freqs2, voltages2, minVoltage, normalize, simulate };
});
