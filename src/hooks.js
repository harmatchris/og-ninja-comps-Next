import { useState, useEffect, useRef } from 'react';
import { db } from './config.js';

export const useFbVal = path => {
  const [val, setVal] = useState(undefined);
  useEffect(() => {
    if (!path) return;
    const r = db.ref(path);
    const fn = s => setVal(s.val());
    r.on('value', fn);
    return () => r.off('value', fn);
  }, [path]);
  return val;
};

export const useTimer = (running, startPerf) => {
  const [el, setEl] = useState(0);
  const raf = useRef();
  useEffect(() => {
    if (!running) { cancelAnimationFrame(raf.current); return; }
    const tick = () => { setEl(performance.now() - startPerf); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, startPerf]);
  return el;
};

export const useWinW = () => {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
};

// ── SFX (Audio + Haptics)
let _ac = null;
const ac = () => { if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)(); return _ac; };
const tone = (freq, dur = 0.1, vol = 0.15, type = 'sine', delay = 0) => { try { const c = ac(); if(c.state==='suspended')c.resume(); const o = c.createOscillator(); const g = c.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = vol; o.connect(g); g.connect(c.destination); const t = c.currentTime + delay; o.start(t); o.stop(t + dur); } catch {} };
const vib = (ms) => { try { navigator.vibrate?.(ms); } catch {} };
export const SFX = {
  wake: () => { try { const c=ac(); if(c.state==='suspended')c.resume(); tone(1,0.01,0.01); return c.state; } catch{ return 'error'; } },
  click: () => { vib(8); tone(600, 0.04, 0.08); },
  hover: () => tone(800, 0.02, 0.05),
  fall: () => { vib(100); tone(180, 0.2, 0.2, 'sawtooth'); tone(120, 0.3, 0.15, 'sawtooth', 0.15); },
  checkpoint: () => { vib(30); tone(880, 0.06, 0.12); tone(1100, 0.08, 0.15, 'sine', 0.06); },
  complete: () => { vib(200); tone(523, 0.08, 0.18); tone(659, 0.08, 0.16, 'sine', 0.1); tone(784, 0.1, 0.18, 'sine', 0.2); tone(1047, 0.35, 0.2, 'sine', 0.32); },
  resetTick: () => { vib(15); tone(660, 0.06, 0.1); },
  resetReady: () => { vib(40); tone(880, 0.08, 0.15); tone(1100, 0.1, 0.18, 'sine', 0.08); },
  resetGo: () => { vib(100); tone(784, 0.08, 0.2); tone(1047, 0.1, 0.22, 'sine', 0.1); tone(1319, 0.15, 0.25, 'sine', 0.22); },
  countdown: (cb) => {
    vib(50); tone(440, 0.12, 0.2);
    setTimeout(() => { vib(50); tone(440, 0.12, 0.2); }, 1000);
    setTimeout(() => { vib(50); tone(440, 0.12, 0.2); }, 2000);
    setTimeout(() => { vib(200); tone(880, 0.35, 0.35, 'square'); }, 3000);
    setTimeout(() => cb(performance.now()), 3000);
  },
};

// ── BLE BUZZER
export const BLE = {
  devices: {},
  async connect(stageNum) {
    if (!navigator.bluetooth) { alert('Bluetooth nicht verfügbar'); return null; }
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access', 'battery_service', '0000ffe0-0000-1000-8000-00805f9b34fb']
      });
      const server = await device.gatt.connect();
      let char = null;
      for (const svcUuid of ['0000ffe0-0000-1000-8000-00805f9b34fb', 'battery_service']) {
        try {
          const svc = await server.getPrimaryService(svcUuid);
          const chars = await svc.getCharacteristics();
          for (const c of chars) { if (c.properties.notify) { char = c; break; } }
          if (char) break;
        } catch (e) {}
      }
      if (!char) {
        const svcs = await server.getPrimaryServices();
        for (const svc of svcs) { try { const chars = await svc.getCharacteristics(); for (const c of chars) { if (c.properties.notify) { char = c; break; } } if (char) break; } catch (e) {} }
      }
      if (char) {
        await char.startNotifications();
        char.addEventListener('characteristicvaluechanged', () => {
          const cb = BLE.devices[stageNum]?.callback;
          if (cb) cb();
        });
      }
      BLE.devices[stageNum] = { device, server, char, callback: null, name: device.name || 'Buzzer' };
      device.addEventListener('gattserverdisconnected', () => { delete BLE.devices[stageNum]; });
      return device.name || 'Buzzer';
    } catch (e) { if (e.name !== 'NotFoundError') console.error('BLE err:', e); return null; }
  },
  disconnect(stageNum) {
    const d = BLE.devices[stageNum];
    if (d?.server?.connected) d.server.disconnect();
    delete BLE.devices[stageNum];
  },
  onPress(stageNum, cb) { if (BLE.devices[stageNum]) BLE.devices[stageNum].callback = cb; },
  isConnected(stageNum) { return !!BLE.devices[stageNum]?.server?.connected; }
};
