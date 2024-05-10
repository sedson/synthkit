/**
 * @file Base class for SynthKit custom audio worlet processors.
 */
class BaseWorklet extends AudioWorkletProcessor {
  /**
   * 
   */
  constructor(options) {
    super(options);

    this.pi = Math.PI;
    this.twopi = 2 * Math.PI;
    this.halfpi = 0.5 * Math.PI;
    this.blockSize = 128;
    this.paramData = {};
  }


  /**
   * Clamp val between min and max.
   */
  clamp(val, min = 0, max = 1) {
    return Math.max(min, Math.min(val, max));
  }


  /**
   * Lerp a and b by factor t.
   */
  lerp(a, b, t = 0) {
    return a + ((b - a) * t);
  }


  /**
   * Slew a param.
   * @param {string} paramName - The name of the param. Slew requires one sample 
   *     of history so store that by param.
   * @param {number} val - The new sample to be slewed from its history.
   * @param {number} slopeMs – The maximum rate of change per ms allowed for the 
   *     value.
   * @return {number} The slewed version of the sample.
   */
  slew(paramName, val, slopeMs) {
    if (!this.paramData[paramName]) {
      this.paramData[paramName] = val;
    }
    const history = this.paramData[paramName];
    const slope = Math.max(0, (1000 / sampleRate) * slopeMs);
    const slewed = history + this.clamp(val - history, -slope, slope);
    this.paramData[paramName] = slewed;
    return slewed;
  }


  /**
   * Get sample from a buffer. Return 0 if no buffer or buffer 
   * is not sample-able.
   * @param {FloatArray} input - The channel buffer or param buffer. 
   * @param {number} sampleIndex - The index.
   * @return {number|undefined} The sample or undefined if could not sample.
   */
  sample(buffer, sampleIndex) {
    if (!buffer || !buffer.length) return 0;
    if (sampleIndex < buffer.length) return buffer[sampleIndex];
    return buffer[buffer.length - 1];
  }


  /**
   * Slew and sample.
   * @param {FloatArray} input - The channel buffer or param buffer. 
   * @param {number} sampleIndex - The index.
   * @param {string} paramName - The name of the param.
   * @param {number} slopeMs – The maximum rate of change per ms allowed.
   * @param {number} A new value. 
   */
  slewSample(buffer, sampleIndex, paramName, slopeMs) {
    const sample = this.sample(buffer, sampleIndex);
    return this.slew(paramName, sample, slopeMs);
  }
}

/**
 * Crossfade processor. 2 M-channel inputs. 1 M-channel output.
 */

class Crossfade extends BaseWorklet {
  constructor(options = {}) {
    super(options);
    this.frame = 0;
    this.type = options.processorOptions?.type ?? 'LINEAR';
  }

  static get parameterDescriptors() {
    return [{
      name: 'mix',
      minValue: 0,
      maxValue: 1,
      defaultValue: 0,
      automationRate: 'a-rate',
    }, ];
  }

  /**
   * Perform the crossfade based on type.
   */
  mix(a, b, t) {
    switch (this.type) {
    case 'sincos':
      return a * Math.cos(t * this.halfpi) + b * Math.sin(t * this.halfpi);

    case 'sigmoid':
      const t2 = t * t * (3 - 2 * t);
      return this.lerp(a, b, t2);

    case 'linear':
    default:
      return this.lerp(a, b, t);
    }
  }

  process(inputs, outputs, parameters) {
    let outChannels = outputs[0].length;
    for (let c = 0; c < outChannels; c++) {
      for (let i = 0; i < outputs[0][c].length; i++) {
        const a = this.sample(inputs[0][c], i);
        const b = this.sample(inputs[1][c], i);
        let m = this.sample(parameters.mix, i);
        m = this.clamp(m);
        outputs[0][c][i] = this.mix(a, b, m);
      }
    }
  }
}

registerProcessor('crossfade', Crossfade);

/**
 * @file Provide signal (audio-rate) binary operators.
 */


const TYPES = {
  add: (a = 0, b = 0) => a + b,
  sub: (a = 0, b = 0) => a - b,
  mult: (a = 0, b = 1) => a * b,
  div: (a = 0, b = 1) => {
    if (Math.abs(b < 1e-5)) return 0;
    return a / b;
  },
  negate: (a = 0) => a * -1,
  min: (a = 0, b = +Infinity) => Math.min(a, b),
  max: (a = 0, b = -Infinity) => Math.max(a, b),
  sin: (a = 0) => Math.sin(a),
  sind: (a = 0) => Math.sin(a * 360 / Math.PI),
  cos: (a = 0) => Math.cos(a),
  cosd: (a = 0) => Math.cos(a * 180 / Math.PI),
};

class SignalMath extends BaseWorklet {

  constructor(options) {
    super(options);
    this.type = options.processorOptions.type || 'add';
    this.operation = TYPES[this.type];
  }

  process(inputs, outputs) {
    for (let c = 0; c < outputs[0].length; c++) {
      for (let s = 0; s < outputs[0][c].length; s++) {
        let a = this.sample(inputs[0][0], s);
        let b = this.sample(inputs[1][0], s);
        outputs[0][c][s] = this.operation(a, b);
      }
    }
    return true;
  }
}

registerProcessor('signal-math', SignalMath);

/**
 * @file 2 in 2 out rotation / signal mixing operator.
 */


class Mix2 extends BaseWorklet {
  constructor(options = {}) {
    super(options);
    this.frame = 0;
  }

  static get parameterDescriptors() {
    return [{
      name: 'theta',
      minValue: 0,
      maxValue: 2 * Math.PI,
      defaultValue: Math.PI / 4,
      automationRate: 'k-rate',
    }, ]
  }

  /**
   * Get the audio sample from a channel buffer. Perform safety checks before 
   * sampling.
   * @param {FloatArray} input - The channel buffer.
   * @return {number|undefined} The sample or undefined if could not sample.
   */
  getInputAtSample(input, sampleIndex) {
    if (!input || !input.length) return undefined;
    if (input.length === 1) return input[0];
    if (sampleIndex < input.length) return input[sampleIndex];
  }

  process(inputs, outputs, parameters) {
    const theta = parameters.theta[0];
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);

    // loop output channels.
    const len = outputs[0][0].length;
    for (let s = 0; s < len; s++) {
      const a = this.getInputAtSample(inputs[0][0], s) ?? 0;
      const b = this.getInputAtSample(inputs[1][0], s) ?? 0;
      const a1 = (a * cos) - (b * sin);
      const b1 = (a * sin) + (b * cos);
      outputs[0][0][s] = a1;
      outputs[1][0][s] = b1;
    }

    return true;
  }
}

registerProcessor('mix-2', Mix2);

/**
 * @file 4 in 4 out rotation / signal mixing operator.
 */

class Mix4 extends BaseWorklet {
  constructor(options = {}) {
    super(options);
  }

  static get parameterDescriptors() {
    return [{
      name: 'theta',
      minValue: 0,
      maxValue: 2 * Math.PI,
      defaultValue: Math.PI / 4,
      automationRate: 'k-rate',
    }, {
      name: 'iota',
      minValue: 0,
      maxValue: 2 * Math.PI,
      defaultValue: Math.PI / 4,
      automationRate: 'k-rate',
    }, ];
  }

  process(inputs, outputs, parameters) {
    const theta = this.slewSample(parameters.theta, 0, 'theta', 0.5);
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    const iota = this.slewSample(parameters.iota, 0, 'iota', 0.5);
    const sinIota = Math.sin(iota);
    const cosIota = Math.cos(iota);

    const len = outputs[0][0].length;
    for (let s = 0; s < len; s++) {
      const a = this.sample(inputs[0][0], s) ?? 0;
      const b = this.sample(inputs[1][0], s) ?? 0;
      const c = this.sample(inputs[2][0], s) ?? 0;
      const d = this.sample(inputs[3][0], s) ?? 0;

      const a1 = (a * cosTheta) - (b * sinTheta);
      const b1 = (a * sinTheta) + (b * cosTheta);

      const c1 = (c * cosTheta) - (d * sinTheta);
      const d1 = (c * sinTheta) + (d * cosTheta);

      const a2 = (a1 * cosIota) - (c1 * sinIota);
      const b2 = (a1 * sinIota) + (c1 * cosIota);

      const c2 = (b1 * cosIota) - (d1 * sinIota);
      const d2 = (b1 * sinIota) + (d1 * cosIota);

      outputs[0][0][s] = a2;
      outputs[1][0][s] = b2;
      outputs[2][0][s] = c2;
      outputs[3][0][s] = d2;
    }
    return true;
  }
}

registerProcessor('mix-4', Mix4);

/**
 * @file Implements a 1in 3out state variable filter.
 * Implementation based on pages 184 - 190 of Graham Wakefield and Gregory 
 * Taylor's "Generating Sounf & Organizing Time".
 */

class StateVariableFilter extends BaseWorklet {
  constructor(options = {}) {
    super(options);

    this.frame = 0;

    /** 
     * A buffer of two history values. One 2-elem array per channel.
     */
    this.history = [];
  }


  static get parameterDescriptors() {
    return [{
      name: 'frequency',
      minValue: 0,
      maxValue: sampleRate / 4,
      defaultValue: 1000,
      automationRate: 'a-rate',
    }, {
      name: 'Q',
      minValue: 1e-5,
      maxValue: 2 * Math.PI,
      defaultValue: Math.PI / 4,
      automationRate: 'a-rate',
    }, ];
  }

  coefficients(frequency, Q) {
    let g = frequency;
    g = this.clamp(Math.abs(g), 0, sampleRate / 4);
    g = Math.tan(g * Math.PI / sampleRate);
    g = g / (1 + g);

    let r = (1 / Math.max(Q, 1e-5)) / 2;

    let a = 1 / ((g * g) + (2 * r * g) + 1);
    let b = g;
    let c = g + (2 * r);

    return [a, b, c];
  }


  process(inputs, outputs, parameters) {
    for (let c = 0; c < outputs[0].length; c++) {

      // Create a history buffer for the channel if needed.
      if (!this.history[c]) {
        this.history[c] = [0, 0];
      }

      for (let i = 0; i < outputs[0][c].length; i++) {

        // Get filter coefficients from params.
        const frequency = this.slewSample(parameters.frequency, i, 'frequency', 30);
        const Q = this.slewSample(parameters.Q, i, 'Q', 0.5);

        // console.log(frequency, Q);

        // Params to coefficients. Maybe do this per block?
        const [g1, g2, g3] = this.coefficients(frequency, Q);

        // The incoming sample.
        const xn = this.sample(inputs[0][c], i);

        // The single sample delay values.
        const s1 = this.history[c][0];
        const s2 = this.history[c][1];

        const hp = g1 * (xn - (g3 * s1) - s2);
        const bp = hp * g2 + s1;
        const lp = bp * g2 + s2;

        this.history[c][0] = hp * g2 + bp;
        this.history[c][1] = bp * g2 + lp;

        outputs[0][c][i] = lp;
        outputs[1][c][i] = hp;
        outputs[2][c][i] = bp;
      }
    }

    return true;
  }
}

registerProcessor('state-variable-filter', StateVariableFilter);

/**
 * A single sine wave self modulating feedback oscillator. With positive 
 * amounts of feedbackm takes on saw like sidebands. With negative feedback, 
 * takes on square-like sidebands. Gets chaotic and noisy as high levels 
 * of feedback in wither direction.
 */


class FeedbackOscillator extends BaseWorklet {
  constructor() {
    super();

    // Freq param smoothing.
    this.freq = {
      val: 440,
      prev: 440,
      delta: 0
    };

    // Singe sample feedback buffer.
    this.lastSample = 0;
  }


  static get parameterDescriptors() {
    return [{
      name: 'frequency',
      minValue: 0,
      maxValue: sampleRate * 0.5,
      defaultValue: 440,
      automationRate: 'a-rate',
    }, {
      name: 'feedback',
      minValue: -4,
      maxValue: 4,
      defaultValue: 0,
      automationRate: 'a-rate',
    }, ];
  }


  lerp(a, b, t) {
    return (a * (1 - t) + b * t);
  }


  process(inputs, outputs, parameters) {
    for (const output of outputs) {
      for (let channelIndex = 0; channelIndex < output.length; channelIndex++) {
        const channel = output[channelIndex];
        for (let i = 0; i < channel.length; i++) {

          // Compute global time in seconds. 
          const globalTime = currentTime + (i / sampleRate);

          // Read the frequency.
          const freq = this.sample(parameters.frequency, i);
          this.freq.delta += globalTime * (this.freq.prev - freq);
          this.freq.prev = freq;

          const feedback = this.slewSample(parameters.feedback, i, 'feedback', 0.1);

          // Get a 0->1 phase ramp at frequency.
          let phase = (globalTime * freq + this.freq.delta) % 1;

          let fb = feedback * this.lastSample;
          if (feedback < 0) fb *= fb;

          let sample = Math.sin(phase * this.twopi + fb);
          sample = (sample + this.lastSample) / 2;
          this.lastSample = sample;

          channel[i] = sample;
        }
      }
    }
    return true;
  }
}

registerProcessor('feedback-oscillator', FeedbackOscillator);