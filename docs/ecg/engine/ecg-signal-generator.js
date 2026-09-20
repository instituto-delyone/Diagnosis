import simulation from "../model/ecg_simulation_parameters.json" with { type: "json" };

function gaussian(t, center, width, amplitude) {
  const sigma = width / 2.355;
  return amplitude * Math.exp(-0.5 * ((t - center) / sigma) ** 2);
}

function qrsShape(t, qrs) {
  const q = gaussian(t, qrs.center - qrs.width * 0.28, qrs.width * 0.22, -0.18 * qrs.amplitude);
  const r = gaussian(t, qrs.center, qrs.width * 0.26, qrs.amplitude);
  const s = gaussian(t, qrs.center + qrs.width * 0.28, qrs.width * 0.22, -0.35 * qrs.amplitude);
  return q + r + s;
}

export function generateSinusCycle(options = {}) {
  const heartRate = Number(options.heartRate ?? 72);
  if (!Number.isFinite(heartRate) || heartRate <= 0) throw new Error("heartRate must be positive");

  const cycleMs = 60000 / heartRate;
  const sampleRate = Number(options.sampleRateHz ?? simulation.default.sample_rate_hz);
  const dt = 1000 / sampleRate;
  const params = simulation.default.cycle;
  const points = [];

  for (let t = 0; t < cycleMs; t += dt) {
    const value =
      simulation.default.baseline_mV +
      gaussian(t, params.p.center_ms, params.p.width_ms, params.p.amplitude_mV) +
      qrsShape(t, {
        center: params.qrs.center_ms,
        width: params.qrs.width_ms,
        amplitude: params.qrs.amplitude_mV
      }) +
      gaussian(t, params.t.center_ms, params.t.width_ms, params.t.amplitude_mV) +
      gaussian(t, params.u.center_ms, params.u.width_ms, params.u.amplitude_mV);

    points.push({ t_ms: Number(t.toFixed(3)), amplitude_mV: Number(value.toFixed(6)) });
  }

  return {
    type: "synthetic_ecg_cycle",
    rhythm: "sinus",
    heart_rate_bpm: heartRate,
    rr_ms: cycleMs,
    sample_rate_hz: sampleRate,
    points
  };
}

export function generateRepeatedSinus(options = {}) {
  const cycles = Number(options.cycles ?? 4);
  const cycle = generateSinusCycle(options);
  const points = [];

  for (let i = 0; i < cycles; i++) {
    const offset = i * cycle.rr_ms;
    for (const point of cycle.points) {
      points.push({
        t_ms: Number((point.t_ms + offset).toFixed(3)),
        amplitude_mV: point.amplitude_mV
      });
    }
  }

  return { ...cycle, cycles, points };
}
