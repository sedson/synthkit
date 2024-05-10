/**
 * @file Non-audio JS helper functions.
 */

export const WAVE_SHAPES = {
  sine: 'sine',
  sawtooth: 'sawtooth',
  saw: 'sawtooth',
  triangle: 'triangle',
  tri: 'triangle',
  square: 'square',
};

export const FILTER_TYPES = {
  lp: 'lowpass',
  lowpass: 'lowpass',
  hp: 'highpass',
  highpass: 'highpass',
};


/**
 * Hyperbolic tan sofclip curve.
 */
export const SOFT_CLIP = new Float32Array(64).map((_, n) => {
  const x = 2 * (n / 63) - 1;
  const y = Math.tanh(x);
  return y;
});

export const HARD_CLIP = new Float32Array(64).map((_, n) => {
  return 2 * (n / 63) - 1;
})

export const MONO = {
  channelCount: 1,
  channelInterpretation: 'discrete',
  channelCountMode: 'explicit',
};


/**
 * Generate a decaying white noise impluse response.
 */
export function IR_EXPO(ctx, channels, duration, decay) {
  const length = ctx.sampleRate * duration;
  const buff = ctx.createBuffer(channels, length, ctx.sampleRate);
  for (let c = 0; c < channels; c++) {
    const chan = buff.getChannelData(c);
    for (var i = 0; i < chan.length; i++) {
      chan[i] = (2 * Math.random() - 1) * (2 * Math.random() - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buff;
}


/**
 * 
 */
export function parseOptions(options) {
  const parsed = {};

  for (let [key, val] of Object.entries(options)) {
    let opt = key.toLowerCase();

    if (opt === 'frequency' || opt === 'freq') {
      parsed.frequency = val;
    }

    if (opt === 'shape' && WAVE_SHAPES[val]) {
      parsed.shape = WAVE_SHAPES[val];
    }

  }
  return parsed;
}


export function IR(ctx, duration, decay) {
  const length = ctx.sampleRate * duration;
  const buff = ctx.createBuffer(1, length, ctx.sampleRate);
  const chan0 = buff.getChannelData(0);
  for (var i = 0; i < length; i++) {
    chan0[i] = (2 * Math.random() - 1) * (2 * Math.random() - 1) * Math.pow(1 - i / length, decay);
  }
  return buff;
}


/**
 *
 */
export function series(chain) {
  for (let i = 0; i < chain.length - 1; i++) {
    chain[i].connect(chain[i + 1]);
  }
}

/**
 *
 */
export function split(root, branches) {
  for (let i = 0; i < branches.length; i++) {
    root.connect(branches[i]);
  }
}

/**
 *
 */
export function join(streams, funnel) {
  for (let i = 0; i < streams.length; i++) {
    streams[i].connect(funnel);
  }
}

/**
 * a440 center tuning frequency.
 */
export const A440 = 440;

/**
 * Midi to frequency. Accepts decimal detune.
 */
export function mtof(m) {
  return A440 * 2 ** ((m - 69) / 12)
}

/**
 * Midi to frequency. Returns decimal detune.  
 */
export function ftom(f) {
  return Math.log2(f / A440) * 12 + 69;
}


/**
 * dB to gain.
 * dB @ 0 no gain change. 
 * db @ +6 is double the power
 * bB @ -6 is half the power.
 */
export function dBtogain(dB) {
  return Math.pow(10, dB / 20);
}