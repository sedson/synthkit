/**
 * @file Operator is the  basic component of the SynthKit. An operator should 
 * do one thing. Many operators are light wrappers around default WebAudio nodes 
 * with some quality-of-life improvements. 
 * 
 * Each operator can have a number of inlets and outlets defined with js 
 * getters. Each operator should have at least one default inlet and one default 
 * outlet for the sake of connection chaining.
 * 
 * The internals of an operator tend to be underscore-prefixed private members 
 * that are exposed with js getters.
 * 
 * Mixes in EventEmitter and WorkletNode.
 */
class Operator {
  /**
   * Construct an Operator.
   * @param {AudioContext} ctx - The parent audio context.
   * @param {object} options – Some extra options.
   * @param {boolean} options.mono - True if the operator and its internal nodes
   *     should have explicitly only one input and outlet channel.
   * @param {number} options.channels - The number of explicit channels that
   *     the operator and its internal nodes should have. Setting channels = 1
   *     is the same as setting mono = true.
   */
  constructor(ctx, options = {}) {
    /**
     * The parent audio context.
     * @type {AudioContext}
     */
    this.ctx = ctx;

    /**
     * Event listener functions keyed by name.
     * @type {object}
     */
    this.events = {};

    /**
     * Whether the init function has beed called.
     * @type {boolean}
     * @private
     */
    this._initCalled = false;

    /**
     * Desired channel settings for this operator. To be passed to internal
     * AudioNode constructors. For the most part, I keep the WebAudio default
     * channel modes, but use the most rigid channel modes if an operator
     * was constructed with a specific number of channels.
     * @type {object}
     */
    this.channelSettings = {};
    if (options.channels) {
      this.channelSettings.channelCount = options.channels;
      this.channelSettings.channelInterpretation = "discrete";
      this.channelSettings.channelCountMode = "explicit";
    } else if (options.mono) {
      this.channelSettings.channelCount = 1;
      this.channelSettings.channelInterpretation = "discrete";
      this.channelSettings.channelCountMode = "explicit";
    }
  }

  /**
   * Initialize the Operator once worklets are loaded. Any worklet-dependent 
   * audio-routing has to go in the override for init.
   */
  init() {}

  //----------------------------------------------------------------------------
  // Connections
  //----------------------------------------------------------------------------

  /**
   * The first node in this Operator's sub-graph. Calls to
   * otherOperator.connect(thisOperator) will connect here.
   * @type {AudioNode|AuidoParam}
   */
  get inlet() { return null; }

  /**
   * The final node in this Operator's sub-graph.
   * @type {AudioNode|AuidoParam}
   */
  get outlet() { return null; }

  /**
   * Connect to a target.
   * @param {Operator|AudioNode|AudioParam} target - The target.
   * @param {number} o - Optional outlet index (on this operator's outlet).
   *     Not applicable if connecting to an audio param.
   * @param {number} i - Optional inlet index (on the target). Not applicable
   *     if connecting to an audio param.
   * @return {Operator|AudioNode|AudioParam} The target. For
   *     connection chaining.
   */
  connect(target, o, i) {
    if (this.outlet === null) {
      console.warn("Connect failed! Operator has no outlet", this);
      return null;
    }

    if (target instanceof Operator && target.inlet) {
      this.outlet.connect(target.inlet, o, i);
      return target;
    }

    if (target instanceof AudioNode) {
      this.outlet.connect(target, o, i);
      return target;
    }

    if (target instanceof AudioParam) {
      this.outlet.connect(target);
      return this;
    }

    return this;
  }

  /**
   * Disconnect from a target or remove all outgoing connections if no target
   * is provided.
   * @param {Operator|AudioNode|AudioParam} target - The target.
   */
  disconnect(target) {
    if (this.outlet === null) {
      console.warn("Disconnect failed: Operator has no outlet");
      return null;
    }
    this.outlet.disconnect(target);
    return this;
  }

  //----------------------------------------------------------------------------
  // Utility
  //----------------------------------------------------------------------------

  /**
   * If the specific operator implementation has a scale node configured, set
   * its gain so some value.
   * @param {number} value - The value.
   */
  scale(value) {
    if (this._scaler?.gain) {
      this._scaler.gain.value = value;
    }
    return this;
  }

  //----------------------------------------------------------------------------
  // Events
  //----------------------------------------------------------------------------

  /** 
   * Subscribe to a event.
   * @param {string} event - Event name.
   * @param {funciton} fn - Subscribing function.
   * @param {boolean} once - Whether to remove after one shot.
   */
  listen(event, fn, once = false) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(fn);
    if (once) fn._once = true;
  }

  /** 
   * Remove subsriber (by reference) from event.
   * @param {string} event - Event name.
   * @param {funciton} fn - Subscribing function.
   * 
   */
  removeListener(event, fn) {
    if (!this.events || !this.events[event]) return;
    this.events[event] = this.events[event].filter(item => item !== fn);
  }

  /** 
   * Clear all subscribers.
   * @param {string} event - Event name.
   */
  clearEvent(event) {
    delete this.events[event];
  }

  /** 
   * Trigger event.
   * @param {string} event - Event name.
   */
  triggerEvent(event) {
    if (!this.events[event]) return;
    const updatedEvents = [];
    for (let fn of this.events[event]) {
      fn();
      if (!fn._once) {
        updatedEvents.push(fn);
      }
    }
    this.events[event] = updatedEvents;
  }

  //----------------------------------------------------------------------------
  // Worklets
  //----------------------------------------------------------------------------

  /**
   * Handle worklet load.
   * @private
   */
  _onWorkletLoaded() {
    if (this._initCalled) return;
    this.init();
    this.triggerEvent('init');
    this._initCalled = true;
  }

  /**
   * Load a worklet.
   * @param {string} name - The name of the worklet processor.
   * @param {function} fn - The callback to evaluate on load. Usually this
   *     operator's initialization function.
   */
  loadWorklet(name) {
    if (!this.ctx.sk_getWorklet) return;
    this.ctx.sk_getWorklet(name, this._onWorkletLoaded.bind(this));
  }

  /**
   * Create a worklet.
   * @param {string} name - The name of the worklet processor.
   * @param {object} options - Options for the worklet node.
   */
  createWorklet(name, options) {
    const worklet = new AudioWorkletNode(this.ctx, name, options);
    worklet.addEventListener('processorerror', (e) => {
      console.error('There was an error!', e);
    });
    worklet.port.onmessage = e => console.log(e.data);
    return worklet;
  }
}

/**
 * @file Provide the paramify function.
 */

const paramObject = {
  /**
   * The list of exposed parameters.
   * @type {object}
   */
  params: {},

  /**
   * Set a named parameter.
   * @param {string} name - The name of the param
   * @param {number} value - The value to set.
   * @param {number} time - The amount of time to tween the change over. 
   */
  param: function (name, value, time) {
    this._setParam(name, value, false, time);
    return this;
  },

  /**
   * Set a named parameter from a normalized value.
   * @param {string} name - The name of the param
   * @param {number} value - The value to set.
   * @param {number} time - The amount of time to tween the change over. 
   */
  nParam: function (name, value, time) {
    this._setParam(name, value, true, time);
    return this;
  },

  /**
   * Set a param or macro.
   * @param {string} name The name of the param or macro.
   * @param {number} value The value to set.
   * @param {number} time The amount of time to tween the change over. 
   * @private
   */
  _setParam: function (name, value, normalized, time) {
    if (!this.params[name]) return;
    const param = this.params[name];

    param.value = normalized ?
      (param.max - param.min) * value + param.min :
      value;

    if (typeof param.target === 'function') {
      param.target.call(this, value, time);
      return;
    }

    if (!time) {
      param.target.setValueAtTime(param.value, this.ctx.currentTime);
    } else {
      param.target.setTargetAtTime(param.value, this.ctx.currentTime, time);
    }
  },

  /**
   * Create a parameter externally. 
   * @param {string} name The name of the param.
   * @param {AudioParameter} target The native WebAudio AudioParameter that this 
   *     parameter targets.
   * @param {number} value The initial value.
   * @param {number} min The min value.
   * @param {number} max The max value.
   * @param {number} smoothing The default smoothing amount for this param.
   */
  createParam: function (name, target, value, min, max, smoothing = 0) {
    this.params[name] = {
      value: value,
      min: min,
      max: max,
      target: target
    };
    this._setParam(name, value, false, 0);
  }
};


/**
 * Apply the param management functions to the input class defniftion or object.
 * @param {Class|object} type – The type to apply param utils to.
 */
function paramify(type) {
  Object.assign(type.prototype, paramObject);
  return type;
}

/**
 * @file A signal is an audio-rate value. The operator 
 */

class Signal extends Operator {
  /**
   * Construct a new Signal. 
   * @param {AudioContext} ctx - The context.
   * @param {number} value - The value of the signal.
   */
  constructor(ctx, value = 1) {
    super(ctx);
    this._source = new ConstantSourceNode(ctx, {
      offset: value
    });
    this._source.start();
  }
  get inlet() {
    return this._source.offset
  }
  get outlet() {
    return this._source;
  }
  get current() {
    return this._source.offset;
  }
}

/**
 * @file Crossfade modes.
 */

class Crossfade extends Operator {
  constructor(ctx, mix = 0.5, options) {
    super(ctx);
    this._a = new GainNode(this.ctx);
    this._b = new GainNode(this.ctx);
    this._mix = new Signal(this.ctx, mix);
    this._out = new GainNode(this.ctx);
    this.loadWorklet('crossfade');
  }

  init() {
    this._fader = this.createWorklet('crossfade', {
      numberOfInputs: 2,
      numberOfOutputs: 1,
    });
    this._mixParam = this._fader.parameters.get('mix');
    this._mix.connect(this._mixParam);
    this._a.connect(this._fader, 0, 0);
    this._b.connect(this._fader, 0, 1);
    this._fader.connect(this._out);
  }

  get mix() { return this._mix.current; }
  get inlet() { return this._a; }
  get inlet2() { return this._b; }
  get outlet() { return this._out; }
  get a() { return this._a; }
  get b() { return this._b; }
}

/**
 * Effect base. Has a dry wet mix.
 */

class Effect extends Operator {
  constructor(ctx) {
    super(ctx);
    this._dry = new GainNode(ctx);

    this._chainIn = new GainNode(ctx);
    this._chainOut = new GainNode(ctx);

    this._mix = new Crossfade(ctx);

    this._dry.connect(this._mix.inlet);
    this._dry.connect(this._chainIn);
    this._chainOut.connect(this._mix.inlet2);
  }
  get inlet() { return this._dry; }
  get outlet() { return this._mix; }
  get mix() { return this._mix.mix; }
}

class Convolver extends Effect {
  constructor(ctx, impulseResponse) {
    super(ctx);
    this._verb = new ConvolverNode(ctx, { buffer: impulseResponse });
    this._chainIn
      .connect(this._verb)
      .connect(this._chainOut);
  }
}

class Distortion extends Effect {
  constructor(ctx) {
    super(ctx);

    const samples = 512;
    const curve = new Float32Array(samples).map((_, n) => {
      const x = 2 * (n / samples) - 1;
      const y = Math.tanh(Math.E * x) + Math.random() * 0.001;
      return y;
    });

    this._shaper = new WaveShaperNode(ctx, { curve: curve, oversample: '2x' });

    this._chainIn
      .connect(this._shaper)
      .connect(this._chainOut);
  }
}

/**
 * @file A simple gain node.
 */

class Gain extends Operator {
  /**
   * Construct a new Gain. 
   * @param {AudioContext} ctx - The context.
   * @param {number} value - The value of the gain.
   */
  constructor(ctx, gain = 1, options = {}) {
    super(ctx, options);
    this._gain = new GainNode(ctx, { ...this.channelSettings, gain });
    this._scaler = this._gain;
  }
  get inlet() { return this._gain }
  get outlet() { return this._gain; }
  get gain() { return this._gain.gain; }
}

/**
 * @file A simple delay line node.
 */

class Delay extends Operator {
  /**
   * Construct a new Gain. 
   * @param {AudioContext} ctx - The context.
   * @param {number} time - The delay time in seconds.
   */
  constructor(ctx, time, options = {}) {
    super(ctx, options);
    this._delay = new DelayNode(ctx, { ...this.channelSettings, delayTime: time });
  }
  get inlet() { return this._delay; }
  get outlet() { return this._delay; }
  get delay() { return this._delay.delayTime; }
}

/**
 * @file Non-audio JS helper functions.
 */

const WAVE_SHAPES = {
  sine: 'sine',
  sawtooth: 'sawtooth',
  saw: 'sawtooth',
  triangle: 'triangle',
  tri: 'triangle',
  square: 'square',
};

const FILTER_TYPES = {
  lp: 'lowpass',
  lowpass: 'lowpass',
  hp: 'highpass',
  highpass: 'highpass',
};


/**
 * Hyperbolic tan sofclip curve.
 */
const SOFT_CLIP = new Float32Array(64).map((_, n) => {
  const x = 2 * (n / 63) - 1;
  const y = Math.tanh(x);
  return y;
});

const HARD_CLIP = new Float32Array(64).map((_, n) => {
  return 2 * (n / 63) - 1;
});

const MONO = {
  channelCount: 1,
  channelInterpretation: 'discrete',
  channelCountMode: 'explicit',
};


/**
 * Generate a decaying white noise impluse response.
 */
function IR_EXPO(ctx, channels, duration, decay) {
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
function parseOptions(options) {
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


function IR(ctx, duration, decay) {
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
function series(chain) {
  for (let i = 0; i < chain.length - 1; i++) {
    chain[i].connect(chain[i + 1]);
  }
}

/**
 *
 */
function split(root, branches) {
  for (let i = 0; i < branches.length; i++) {
    root.connect(branches[i]);
  }
}

/**
 *
 */
function join(streams, funnel) {
  for (let i = 0; i < streams.length; i++) {
    streams[i].connect(funnel);
  }
}

/**
 * a440 center tuning frequency.
 */
const A440 = 440;

/**
 * Midi to frequency. Accepts decimal detune.
 */
function mtof(m) {
  return A440 * 2 ** ((m - 69) / 12)
}

/**
 * Midi to frequency. Returns decimal detune.  
 */
function ftom(f) {
  return Math.log2(f / A440) * 12 + 69;
}


/**
 * dB to gain.
 * dB @ 0 no gain change. 
 * db @ +6 is double the power
 * bB @ -6 is half the power.
 */
function dBtogain(dB) {
  return Math.pow(10, dB / 20);
}

/**
 * @file A simple tanh saturator node.
 */

class Saturator extends Operator {
  /**
   * Construct a new Gain. 
   * @param {AudioContext} ctx - The context.
   * @param {number} time - The delay time in seconds.
   */
  constructor(ctx, options = {}) {
    super(ctx, options);
    this._shaper = new WaveShaperNode(ctx, {
      ...this.channelSettings,
      oversample: '2x',
      curve: HARD_CLIP
    });
  }
  get inlet() { return this._shaper; }
  get outlet() { return this._shaper; }
}

/**
 * @file Wrap the basic built-in OscillatorNode.
 */

/**
 * @class Simple oscillator.
 */
class Oscillator extends Operator {
  /**
   * Construct an oscillator.
   * @param {AudioContext} ctx - The parent context.
   * @param {object} options - Options for the node.
   * @param {string} options.shape - A valid shape for the wave. 
   *     See common.js::WAVE_SHAPES. Default 'sine'.
   * @param {number} options.frequency - The frequency. Default 440. 
   */
  constructor(ctx, options = {}) {
    super(ctx);
    const opts = parseOptions(options);

    /**
     * The shape of the oscillator.
     * @type {string}
     * @readonly
     */
    this.shape = opts.shape || 'sine';

    /**
     * The last know frequency of the Oscillator. Used when restarting.
     * Do not expect to be accurate when the oscillator is running. Instead use 
     * the k-rate audio param Oscillator.frequency.value.
     * @type {number}
     * @readonly
     */
    this._frequencyValue = opts.frequency ?? 440;

    /**
     * The oscillator.
     */
    this._oscillator = new OscillatorNode(ctx, {
      type: this.shape,
      frequency: this._frequencyValue,
    });

    /** 
     * The internal gain node.
     */
    this._gain = new GainNode(ctx);

    /** 
     * Assigning a gain node to the private member _scaler exposes the 
     * Operator.scale() function.
     */
    this._scaler = this._gain;

    // Connect and start.
    this._oscillator.connect(this._gain);
    this._oscillator.start(this.ctx.currentTime);
  }

  /**
   * Restart the oscillator.
   * Warning: connections to the frequency or detune inlets will be lost..
   */
  sync() {
    this.stop();
    this.start();
    return this;
  }

  /**
   * Stop the oscillator.
   * Warning: connections to the frequency or detune inlets will be lost..
   */
  stop() {
    if (!this._oscillator) return;
    this._frequencyValue = this._oscillator.frequency.value;
    this._oscillator.stop();
    this._oscillator.disconnect();
    this._oscillator = null;
    return this;
  }

  setFrequency(freq) {
    if (this._oscillator) {
      this._oscillator.frequency.value = freq;
    }
    return this;
  }

  /**
   * Start the oscillator. If the operator is running, has no effect.
   * Warning: connections to the frequency or detune inlets will be lost..
   * @param {number} time - The schedule time to start.
   */
  start(time) {
    if (this._oscillator) return;
    this._oscillator = new OscillatorNode(this.ctx, {
      type: this.shape,
      frequency: this._frequencyValue
    });
    this._oscillator.connect(this._gain);
    this._oscillator.start(time || this.ctx.currentTime);
    return this;
  }

  get inlet() { return this._oscillator.frequency; }
  get outlet() { return this._gain; }
  get frequency() { return this._oscillator.frequency; }
  get detune() { return this._oscillator.detune; }
  get gain() { return this._gain.gain; }
}

/**
 * @file Stereo splitter. Split a stero inlet into a left and right 
 * mono output. Return the unsplit audio to outlet.
 */


class StereoSplitter extends Operator {
  constructor(ctx) {
    super(ctx);
    this._input = new GainNode(ctx);
    this._split = new ChannelSplitterNode(ctx, { numberOfOutputs: 2 });
    console.log('SPLITTER:', this._split);

    this._outL = new GainNode(ctx);
    this._outR = new GainNode(ctx);

    this._input.connect(this._split);
    this._split.connect(this._outL, 0);
    this._split.connect(this._outR, 1);
  }

  get inlet() { return this._input; }
  get L() { return this._outL; }
  get R() { return this._outR; }
  get outlet() { return this._input; }
}

/**
 * @file StereoMeger. Connect signals to L, R, or C for the desired node.
 */

class StereoMerger extends Operator {
  constructor(ctx) {
    super(ctx);
    this._merge = new ChannelMergerNode(ctx, { numberOfInputs: 2 });

    this._left = new GainNode(ctx, { channelCount: 1 });
    this._right = new GainNode(ctx, { channelCount: 1 });

    this._center = new GainNode(ctx, { channelCount: 1, gain: 0.5 });

    this._left.connect(this._merge, 0, 0);
    this._right.connect(this._merge, 0, 1);

    this._center.connect(this._left);
    this._center.connect(this._right);
  }
  get inlet() { return this._center; }
  get L() { return this._left; }
  get R() { return this._right; }
  get C() { return this._center; }
  get outlet() { return this._merge; }
}

/**
 * @file Stereo splitter. Split a stero inlet into a left and right 
 * mono output. Return the unsplit audio to outlet.
 */


class MonoToStereo extends Operator {
  constructor(ctx) {
    super(ctx);
    this._input = new GainNode(ctx);
    this._outL = new GainNode(ctx);
    this._outR = new GainNode(ctx);
    this._input.connect(this._outL);
    this._input.connect(this._outR);
  }

  get inlet() { return this._input; }
  get L() { return this._outL; }
  get R() { return this._outR; }
  get outlet() { return this._input; }
}

/**
 * @file Two matched biquad filter nodes in series to get steeped frequency 
 * responses.
 */

class Filter2 extends Operator {
  constructor(ctx, options = {}) {
    super(ctx, options);
    const freq = options.freq || 1200;
    const type = options.type || 'lowpass';
    const resonance = options.resonance || 1;

    this._freq = new Signal(ctx, freq);
    this._q = new Signal(ctx, resonance);

    this._filterStageA = new BiquadFilterNode(ctx, { frequency: 0, type: type, Q: 0 });
    this._filterStageB = new BiquadFilterNode(ctx, { frequency: 0, type: type, Q: 0 });

    this._q.connect(this._filterStageA.Q);
    this._q.connect(this._filterStageB.Q);

    this._freq.connect(this._filterStageA.frequency);
    this._freq.connect(this._filterStageB.frequency);

    this._filterStageA.connect(this._filterStageB);
  }

  get inlet() { return this._filterStageA; }
  get outlet() { return this._filterStageB; }
  get resonance() { return this._q.current; }
  get frequency() { return this._freq.current; }
  get Q() { return this._q.current; }
}

/**
 * @file Artificial reverb attempt number 4! Simpler circuit with a better 
 * understanding.
 * ┐┌┘└
 *        ┌--<-[gain]---<------------------┐
 *        |                ┌-----------┐   |
 * L ----[+]---[delay1]----| Othogonal |---•------ L
 *                         | Matrix    |
 * R ----[+]---[delay2]----|           |---•------ R
 *        |                └-----------┘   |
 *        └--<-[gain]---<------------------┘
 * 
 * 
 * Where orthogonal matrix is defined as 
 * 
 * L1 = Lcosθ - Rsinθ
 * R2 = Lsinθ + Rcosθ
 * 
 * for some θ.
 * 
 */



class Verb2 extends Effect {
  constructor(ctx, options) {
    super(ctx, options);
    this.loadWorklet('mix-2', () => this.init());
  }

  init() {
    // Connect up the effect chain inlet.
    const splitter = new MonoToStereo(this.ctx);
    new Filter2(this.ctx, { frequency: 16_000, Q: 0 });
    const inputAllPass = new Filter2(this.ctx, { frequency: 2000, Q: 0, type: 'allpass' });

    this._chainIn
      .connect(inputAllPass.inlet)
      // .connect(inputHighCut.inlet)
      .connect(splitter.inlet);


    this._mixer = new AudioWorkletNode(this.ctx, 'mix-2', {
      numberOfInputs: 2,
      numberOfOutputs: 2,
      outputChannelCount: [1, 1],
    });

    this._theta = this._mixer.parameters.get('theta');



    const delayL = new Delay(this.ctx, 68 / 1000, { mono: true });
    const delayR = new Delay(this.ctx, 37 / 1000, { mono: true });

    this.debugL = delayL;
    this.debugR = delayR;

    console.log(delayL, delayR);


    splitter.L.connect(delayL.inlet);
    splitter.R.connect(delayR.inlet);

    delayL.outlet.connect(this._mixer, 0, 0);
    delayR.outlet.connect(this._mixer, 0, 1);


    const decayL = new Gain(this.ctx, 0);
    const decayR = new Gain(this.ctx, 0);

    // console.log(decayL, decayR);


    this._decayParam = new Signal(this.ctx, 0);


    this._decayParam.connect(decayL.gain);
    this._decayParam.connect(decayR.gain);

    const gL = new GainNode(this.ctx);
    const gR = new GainNode(this.ctx);


    this._mixer.connect(gL, 0);
    this._mixer.connect(gR, 1);


    gL.connect(decayL.inlet).connect(delayL.inlet);
    gR.connect(decayR.inlet).connect(delayR.inlet);

    const lfoL = new Oscillator(this.ctx, { frequency: 3.1415 });
    lfoL.scale(2 / 10000)
      .connect(delayL.delay);


    const lfoR = new Oscillator(this.ctx, { frequency: 1.97 });
    lfoR.scale(2 / 10000)
      .connect(delayR.delay);



    const out = new StereoMerger(this.ctx);

    gL.connect(out.L);
    gR.connect(out.R);

    out.connect(this._chainOut);



    this.trigger('init');


  }

  get feedback() { return this._decayParam.current; }
  // get size () { return this._sizeParam.current; }
  get theta() { return this._theta }
}

/**
 * @file Onepole LP and HP filters using the IIRFilterNode. For Feedback 
 * loops, these first order filters have the advantage of not being resonant - 
 * i.e. they cannot go above unity gain.
 * 
 * The onepoles require a new IIRFilterNode on any change of cutoff and therefore
 * should be used in places where infrequent and non-modulated changes to the 
 * cutoff frequncy are OK.
 * 
 * I grabbed the math from https://www.earlevel.com/main/2021/09/02/biquad-calculator-v3/
 * but swapped the coefficient names to match the IIRFilterNode documentation 
 * which uses As for the feedback coefficients and Bs for the feedforward.
 * 
 * LOWPASS
 * a1 = exp(-2 * PI * (Fc / Fs));
 * b0 = 1.0 - a1;
 * a1 = -a1;
 * 
 * HIGHPASS
 * a1 = -exp(-2 * PI * (0.5 - Fc / Fs));
 * b0 = 1.0 + b1;
 * a1 = -a1;
 */

class OnePoleFilter extends Operator {
  constructor(ctx, options = {}) {
    super(ctx, options);
    this._frequency = options.frequency || 2400;

    this._inlet = new GainNode(this.ctx, this.channelSettings);
    this._outlet = new GainNode(this.ctx, this.channelSettings);

    this.type = options.type || 'lowpass';

    this._setFrequency(this._frequency);
  }

  get inlet() { return this._inlet; }
  get outlet() { return this._outlet; }


  _setFrequency(freq) {
    this._inlet.disconnect();
    if (this._filter) this._filter.disconnect();

    let a1, b0;

    if (this.type === 'highpass') {
      a1 = -Math.exp(-2 * Math.PI * (0.5 - (freq / this.ctx.sampleRate)));
      b0 = 1 + a1;
    } else {
      a1 = Math.exp(-2 * Math.PI * (freq / this.ctx.sampleRate));
      b0 = 1 - a1;
    }

    const feedback = [1, -a1];
    const feedforward = [b0, 0];

    this._filter = new IIRFilterNode(this.ctx, { feedforward, feedback, ...this.channelSettings });
    this._inlet.connect(this._filter).connect(this._outlet);
  }

  set frequency(freq) {
    this._frequency = freq;
    this._setFrequency(this._frequency);
  }
}

/**
 * @file Artificial reverb attempt number 5!
 * 
 * Each delay line:
 * ┐ ┌ ┘ └ ┴ ┬
 * -->{gain}-->{1polelowpass@h}-->{allpass}-->{delay@t}-->{softclip}-->
 * 
 * 
 *       ┌-┬-┬-┬-<-[feedback * decay]-----------<---┬-┬-┬-┐
 *       | | | |                   ┌------------┐   | | | |
 * IN.L--┴-|-|-|-->[delayline0]--->|            |->-┴-|-|-|-----┬----->OUT.L
 * IN.R----┴-|-|-->[delayline1]--->|  4in 4out  |->---|-|-┴-----|--┬-->OUT.R
 *           └-|-->[delayLine2]--->|  rotation  |->---|-┴-------┘  |
 *             └-->[delayLine3]--->|            |->---┴------------┘
 *                                 └------------┘ 
 * 
 * Possible combination of delay line lengths.
 * [ 47, 67, 101, 137 ]
 * [ 29, 37, 69, 53 ]
 * [ 38.4325, 79.6385, 84.5423, 97.1244 ]
 * [ 37, 89, 71, 103 ]
 * [ 102.4325, 145.6385, 167.5423, 183.1244 ]
 * [ 131, 147, 201, 213 ]
 */


const HIGHCUT = 16_000;



class Verb3 extends Effect {
  constructor(ctx, options) {
    super(ctx, options);
    this.loadWorklet('mix-4');
  }

  init() {
    // Connect up the effect chain inlet.
    const splitter = new MonoToStereo(this.ctx);
    this._chainIn.connect(splitter.inlet);


    this._mixer = this.createWorklet('mix-4', {
      numberOfInputs: 4,
      numberOfOutputs: 4,
      outputChannelCount: [1, 1, 1, 1],
    });
    this._theta = this._mixer.parameters.get('theta');
    this._iota = this._mixer.parameters.get('iota');

    this._delayLines = [
      this.createChannelDelayLine(HIGHCUT, 29 / 1000),
      this.createChannelDelayLine(HIGHCUT, 37 / 1000),
      this.createChannelDelayLine(HIGHCUT, 68 / 1000),
      this.createChannelDelayLine(HIGHCUT, 97 / 1000),
    ];

    splitter.L.connect(this._delayLines[0].in.inlet);
    splitter.R.connect(this._delayLines[0].in.inlet);

    this._decayParam = new Signal(this.ctx, 0);

    this._decayNodes = [];


    for (let i = 0; i < 4; i++) {
      const decayNode = new GainNode(this.ctx, { gain: 0, channelCount: 1 });

      // delay line -> unitary mix matrix.
      this._delayLines[i].saturator.outlet.connect(this._mixer, 0, i);

      // unitary mix matrix -> decay multiplier
      this._mixer.connect(decayNode, i, 0);

      // decay control to decay gain.
      this._decayParam.connect(decayNode.gain);

      this._decayNodes.push(decayNode);
    }

    const sumL = new GainNode(this.ctx, { gain: 0.5, channelCount: 1 });
    const sumR = new GainNode(this.ctx, { gain: 0.5, channelCount: 1 });

    this._decayNodes[0].connect(sumL);
    this._decayNodes[1].connect(sumL);

    this._decayNodes[2].connect(sumR);
    this._decayNodes[3].connect(sumR);

    this._decayNodes[0].connect(this._delayLines[0].in.inlet);
    this._decayNodes[1].connect(this._delayLines[2].in.inlet);
    this._decayNodes[2].connect(this._delayLines[1].in.inlet);
    this._decayNodes[3].connect(this._delayLines[3].in.inlet);

    const out = new StereoMerger(this.ctx);

    sumL.connect(out.L);
    sumR.connect(out.R);

    out.connect(this._chainOut);
  }

  get feedback() { return this._decayParam.current; }
  // get size () { return this._sizeParam.current; }
  get theta() { return this._theta }
  get iota() { return this._iota }



  createChannelDelayLine(highcut, delay) {
    const chain = [
      new Gain(this.ctx, 1, { mono: true }),
      new OnePoleFilter(this.ctx, { frequency: highcut, mono: true }),
      new Delay(this.ctx, delay, { mono: true }),
      new Saturator(this.ctx, { mono: true }),
    ];
    series(chain);

    const lfo = new Oscillator(this.ctx, { frequency: Math.random() * 0.1 });
    lfo.scale(10 / 10000);
    lfo.connect(chain[2].delay);


    return {
      in: chain[0],
      delay: chain[2],
      saturator: chain[3],
    };
  }
}

/**
 * @file Light wrapper for the default Biquad filter node.
 */

class Filter extends Operator {
  constructor(ctx, options = {}) {
    super(ctx, options);
    const freq = options.freq || 1200;
    const type = options.type || 'lowpass';
    const q = options.q || 1;
    this._filter = new BiquadFilterNode(ctx, { frequency: freq, type: type, Q: q });
  }

  get inlet() { return this._filter; }
  get outlet() { return this._filter; }
  get frequency() { return this._filter.frequency }
  get resonance() { return this._filter.Q; }
  get Q() { return this._filter.Q; }
}

/**
 * @file Two matched biquad filter nodes in series to get steeped frequency 
 * responses.
 */


class StateVariableFilter extends Operator {
  constructor(ctx, options = {}) {
    super(ctx, options);
    const freq = options.freq || 1200;
    const Q = options.Q || 1;

    this._inlet = new GainNode(this.ctx);

    this._lp = new Gain(this.ctx);
    this._bp = new Gain(this.ctx);
    this._hp = new Gain(this.ctx);

    this._frequency = new Signal(this.ctx, freq);
    this._q = new Signal(this.ctx, Q);

    this.loadWorklet('state-variable-filter');
  }

  init() {
    this._filter = this.createWorklet('state-variable-filter', {
      numberOfInputs: 1,
      numberOfOutputs: 3,
    });
    this._frequencyParam = this._filter.parameters.get('frequency');
    this._Qparam = this._filter.parameters.get('Q');
    this._frequencyParam.value = 0;
    this._Qparam.value = 0;

    this._inlet.connect(this._filter);
    this._filter.connect(this._lp.inlet, 0);
    this._filter.connect(this._hp.inlet, 1);
    this._filter.connect(this._bp.inlet, 2);

    this._frequency.connect(this._frequencyParam);
    this._q.connect(this._Qparam);
  }

  disconnect(target) {
    this.lowpass.disconnect(target);
    this.highpass.disconnect(target);
    this.bandpass.disconnect(target);
    return this;
  }

  get inlet() { return this._inlet; }
  get outlet() { return this._lp; }
  get frequency() { return this._frequency.current; }
  get resonance() { return this._q.current; }
  get Q() { return this._q.current; }
  get lowpass() { return this._lp; }
  get bandpass() { return this._bp; }
  get highpass() { return this._hp; }
}

/**
 * @file A pulse-wave operator with variable duty cycle/width.
 */

/**
 * @class Pulse oscillator with a variable pulse width.
 */
class PulseOscillator extends Oscillator {
  constructor(ctx, options = {}) {
    super(ctx, options);
    this._oscillator.disconnect();

    this.shape = 'pulse';

    // Wave shaper curve squishes a sine wave into a square.
    this._curve = new Float32Array(8).map((a, n) => n < 4 ? -1 : 1);
    this._shaper = new WaveShaperNode(ctx, {
      curve: this._curve,
      overSample: 'none',
    });

    // Audio param for the pulse width.
    this._width = new Signal(ctx, 0);

    // Sum the wave with the width, then squish and scale.
    this._sum = new GainNode(ctx);

    this._oscillator.connect(this._sum);
    this._width.connect(this._sum);

    this._sum
      .connect(this._shaper)
      .connect(this._gain);
  }

  get width() { return this._width.current; }
}

class FeedbackOscillator extends Oscillator {
  constructor(ctx, options) {
    super(ctx, options);
    this.loadWorklet('feedback-oscillator');
  }

  init() {
    this._oscillator.disconnect();
    const freq = this._frequencyValue;
    this._oscillator.stop();
    this._oscillator = this.createWorklet('feedback-oscillator');
    this._frequency = this._oscillator.parameters.get('frequency');
    this._feedback = this._oscillator.parameters.get('feedback');
    this._frequency.value = freq;
    this._oscillator.connect(this._gain);
  }

  get frequency() { return this._frequency; }
  get feedback() { return this._feedback; }
  get gain() { return this._gain.gain; }
  get inlet() { return this._frequency; }
  get outlet() { return this._gain; }
}

/**
 * A buffer full of slowed-down white noise.
 */

class ArraySource extends Operator {
  constructor(ctx, array, options) {
    super(ctx, options);
    this.sampleRate = ctx.sampleRate;

    this._array = array;

    this._buffer = new AudioBuffer({
      numberOfChannels: 1,
      length: ctx.sampleRate,
      sampleRate: ctx.sampleRate
    });

    const samplesPerStep = Math.floor(this._buffer.length / this._array.length);

    for (let c = 0; c < this._buffer.numberOfChannels; c++) {
      const channelBuffer = this._buffer.getChannelData(c);
      for (let v = 0; v < thsi._array.length; v++) {
        let val = this._array[v];
        for (let i = 0; i < samplesPerStep; i++) {
          channelBuffer[v * samplesPerStep + i] = val;
        }
      }
    }

    /**
     * The audio buffer.
     */
    this._source = new AudioBufferSourceNode(ctx, {
      loop: true,
      buffer: this._buffer,
    });

    /** 
     * The gain.
     */
    this._gain = new GainNode(ctx);
    this._scaler = this._gain;

    // Connect and start.
    this._source.connect(this._gain);
    this._source.start(ctx.currentTime);
  }

  get outlet() { return this._gain; }

  clock(interval) {
    this.baseSpeed = this._buffer.length;
  }

  restart(time = 0) {
    this._source.stop();
    this._source.disconnect();
    this._source = new AudioBufferSourceNode(this.ctx, {
      loop: true,
      buffer: this._buffer,
    });
    this._source.start(time);
    this._source.connect(this._gain);
  }

  get gain() { return this._gain.gain; }
  get speed() { return this._source.playbackRate; }
}

/**
 * @file Multiply two audio rate values. Internally uses one gain node to 
 * multiply. A is the input to the gain, B is the gain AudioParam.
 */

class Mult extends Operator {
  /**
   * Construct a new Gain. 
   * @param {AudioContext} ctx - The context.
   * @param {number} value - The value of the gain.
   */
  constructor(ctx, value = 1) {
    super(ctx);
    this._gain = new GainNode(ctx, {
      gain: value
    });
  }

  get inlet() { return this._gain; }
  get outlet() { return this._gain; }
  get gain() { return this._gain.gain; }
  get A() { return this._gain; }
  get B() { return this._gain.gain; }
}

/**
 * @class A white noise source.
 */

class Noise extends Operator {

  constructor(ctx, bufferLength = 0.5) {
    super(ctx);
    this.sampleRate = ctx.sampleRate;

    // Fill a buffer with white noise
    this._buffer = new AudioBuffer({
      numberOfChannels: 1,
      length: ctx.sampleRate * bufferLength,
      sampleRate: ctx.sampleRate
    });

    for (let c = 0; c < this._buffer.numberOfChannels; c++) {
      const channelBuffer = this._buffer.getChannelData(c);
      for (let i = 0; i < this._buffer.length; i++) {
        channelBuffer[i] = Math.random() * 2 - 1;
      }
    }

    /**
     * The audio buffer.
     */
    this._source = new AudioBufferSourceNode(ctx, {
      loop: true,
      buffer: this._buffer,
    });

    /** 
     * The gain.
     */
    this._gain = new GainNode(ctx);
    this._scaler = this._gain;

    // Connect and start.
    this._source.connect(this._gain);
    this._source.start(ctx.currentTime);
  }

  get outlet() { return this._gain; }
  get gain() { return this._gain.gain; }
}

/**
 * A buffer full of slowed-down white noise.
 */

class RandomSource extends Operator {
  constructor(ctx, steps = 8, bufferLength = 1) {
    super(ctx);
    this.sampleRate = ctx.sampleRate;

    this._buffer = new AudioBuffer({
      numberOfChannels: 1,
      length: ctx.sampleRate * bufferLength,
      sampleRate: ctx.sampleRate
    });


    const samplesPerStep = Math.floor(this._buffer.length / steps);

    for (let c = 0; c < this._buffer.numberOfChannels; c++) {
      const channelBuffer = this._buffer.getChannelData(c);

      for (let step = 0; step < steps; step++) {
        let randomValue = Math.random() * 2 - 1;
        for (let i = 0; i < samplesPerStep; i++) {
          channelBuffer[step * samplesPerStep + i] = randomValue;
        }
      }
    }

    /**
     * The audio buffer.
     */
    this._source = new AudioBufferSourceNode(ctx, {
      loop: true,
      buffer: this._buffer,
    });

    /** 
     * The gain.
     */
    this._gain = new GainNode(ctx);
    this._scaler = this._gain;

    // Connect and start.
    this._source.connect(this._gain);
    this._source.start(ctx.currentTime);
  }

  get outlet() { return this._gain; }

  clock(interval) {
    this.baseSpeed = this._buffer.length;
  }

  restart(time = 0) {
    this._source.stop();
    this._source.disconnect();
    this._source = new AudioBufferSourceNode(this.ctx, {
      loop: true,
      buffer: this._buffer,
    });
    this._source.start(time);
    this._source.connect(this._gain);
  }

  get gain() { return this._gain.gain; }
  get speed() { return this._source.playbackRate; }
}

/**
 * @file Binary signal rate math node.
 */

const TYPES = {
  ADD: 'add',
  SUB: 'sub',
  MULT: 'mult',
  DIV: 'div',
  MIN: 'min',
  MAX: 'max',
  SIN: 'sin',
  SIND: 'sind',
  COS: 'cos',
  COSD: 'cosd',
};

class SignalMath extends Operator {
  /**
   * Construct a Math node. 
   * @param {AudioContext} ctx - The context.
   * @param {string} type - The type of math
   *     'add', 'sub', 'mult', 'div', 'min', 'max'
   */
  constructor(ctx, type, options) {
    super(ctx, options);
    this.type = TYPES.ADD;
    if (TYPES[type.toUpperCase()]) {
      this.type = TYPES[type.toUpperCase()];
    }

    // Two inlet gain nodes. One outlet. 
    this._a = new GainNode(ctx, {
      ...MONO
    });
    this._b = new GainNode(ctx, {
      ...MONO
    });
    this._c = new GainNode(ctx, {
      ...MONO
    });

    this.loadWorklet('signal-math', () => this.init());
  }

  init() {
    this._node = this.createWorklet('signal-math', {
      numberOfInputs: 2,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: {
        type: this.type,
      }
    });

    this._a.connect(this._node, 0, 0);
    this._b.connect(this._node, 0, 1);
    this._node.connect(this._c);
  }

  get inlet() {
    return this._a;
  }
  get inlet2() {
    return this._b;
  }
  get outlet() {
    return this._c;
  }
  get a() {
    return this._a;
  }
  get b() {
    return this._b;
  }
}

class Spect extends Operator {
  constructor(ctx, container, options = {}) {
    super(ctx, options);

    this.samples = options.samples || 2048;

    this._analyser = new AnalyserNode(ctx, {
      fftSize: this.samples,
      smoothingTimeConstant: 0.6,
    });


    this._panel = document.createElement('div');
    this._panel.classList.add('scope');
    this._canvas = document.createElement('canvas');
    this._canvas.classList.add('scope-canvas');
    this._canvas.width = options.width || 400;
    this._canvas.height = options.height || 140;
    this._canvasCtx = this._canvas.getContext('2d');

    this._binCount = this._analyser.frequencyBinCount;
    this._dataBuffer = new Uint8Array(this._binCount);
    this._panel.append(this._canvas);

    this._nyquist = ctx.sampleRate / 2;

    this._frequencyLabels = [
      ['100', 100],
      ['1k', 1000],
      ['10k', 10000],
      ['•', 440]
    ];

    this.mode = options.mode || 'line';

    this.colorStr = options.color || '#fff';
    this.backgroundStr = options.background || '#000';

    this._render = this.render.bind(this);
    this._render();
    this._canvas.addEventListener('mousemove', (e) => this._handleMouse(e));

    container.append(this._panel);

  }

  _handleMouse(e) {
    const {
      clientX,
      clientY
    } = e;
    const rect = this._canvas.getBoundingClientRect();
    const normX = (clientX - rect.left) / rect.width;
    if (normX >= 0 && normX <= 1) {
      this._frequencyLabels[this._frequencyLabels.length - 1][0] = this._xPosToFreq(normX);
      this._frequencyLabels[this._frequencyLabels.length - 1][1] = this._xPosToFreq(normX);
    }
  }

  get inlet() {
    return this._analyser;
  }

  _freqToXpos(frequency) {
    let a = Math.log10(frequency) / Math.log10(this._nyquist);
    let val = (1 / .7) * (a - .3);
    return val * this._canvas.width;
  }

  _xPosToFreq(xPos) {
    let val = (xPos / (1 / .7) + 0.3) * Math.log10(this._nyquist);
    return Math.floor(Math.pow(10, val));
  }

  render() {
    this._analyser.getByteFrequencyData(this._dataBuffer);

    this._canvasCtx.fillStyle = this.backgroundStr;
    this._canvasCtx.globalAlpha = 1;
    this._canvasCtx.fillRect(0, 0, this._canvas.width, this._canvas.height);

    for (let [label, freq] of this._frequencyLabels) {
      this._canvasCtx.font = "10px Arial";
      this._canvasCtx.fillStyle = this.colorStr;      const x = this._freqToXpos(freq);
      this._canvasCtx.strokeStyle = this.colorStr;
      this._canvasCtx.textAlign = 'center';
      this._canvasCtx.fillText(label, x, 10);
      this._canvasCtx.beginPath();
      this._canvasCtx.setLineDash([1, 5]);
      this._canvasCtx.moveTo(x, this._canvas.height);
      this._canvasCtx.lineTo(x, 20);
      this._canvasCtx.stroke();
    }

    if (this.mode === 'line') {
      this._renderLine();
    } else if (this.mode === 'bars') {
      this._renderBars();
    } else if (this.mode === 'both') {
      this._renderLine();
      this._renderBars();
    }


    requestAnimationFrame(this._render);
  }


  _renderBars() {
    this._canvasCtx.lineWidth = 1;
    this._canvasCtx.setLineDash([]);

    this._canvasCtx.strokeStyle = this.colorStr;

    this._canvas.width / this._binCount;

    for (let i = 0; i < this._binCount; i++) {
      const val = 1.0 - this._dataBuffer[i] / 256.0;
      const y = (val * this._canvas.height);

      const freq = this._nyquist * i / this._binCount;
      const x = this._freqToXpos(freq);

      this._canvasCtx.beginPath();
      this._canvasCtx.moveTo(x, this._canvas.height);
      this._canvasCtx.lineTo(x, y);
      this._canvasCtx.stroke();
    }
  }


  _renderLine() {
    this._canvas.width / this._binCount;


    this._canvasCtx.lineWidth = 2;
    this._canvasCtx.setLineDash([]);
    this._canvasCtx.strokeStyle = this.colorStr;


    this._canvasCtx.beginPath();
    const valAtZero = 1.0 - this._dataBuffer[0] / 256.0;
    this._canvasCtx.moveTo(0, valAtZero * this._canvas.height);


    for (let i = 0; i < this._binCount; i++) {
      const val = 1.0 - this._dataBuffer[i] / 256.0;
      const y = (val * this._canvas.height + 2);
      const freq = this._nyquist * i / this._binCount;
      const x = this._freqToXpos(freq);
      this._canvasCtx.lineTo(x, y);
    }
    this._canvasCtx.stroke();

  }
}

/**
 * @file Provide the minimal GL abstraction to build oscilloscope and spectrogram 
 * visualizers on top of.
 */

/**
 * Default vertex shader.
 */
const defaultVs = `
#version 300 es

layout(location = 0) in float aX;
layout(location = 1) in float aY;
layout(location = 2) in float opacity;

out float vOpacity;
out vec2 vPos;

uniform vec2 uScale;
uniform float uPointSize;

void main () 
{
  gl_Position = vec4(aX * uScale.x, aY * uScale.y, 0.0, 1.0);
  gl_PointSize = uPointSize;
  vPos = vec2(aX * uScale.x, aY * uScale.y);
}
`.trim();

/**
 * Default fragment shader.
 */
const defaultFs = `
#version 300 es

precision mediump float;

in vec2 vPos;
in float vOpacity;

out vec4 fragColor;

uniform vec3 uColor;
uniform int uMode;

void main () 
{ 
  if (uMode < 1) {
   float fade = distance(vec2(0.5, 0.5), gl_PointCoord);
   if (fade > 0.5) {
    // discard;
   }
  }
  
  fragColor.rgb = uColor.rgb;
  fragColor.a = 1.0;
}
`.trim();



class RendererGL {
  constructor(canvas) {
    this.gl = canvas.getContext('webgl2', {
      antialias: false,
    });
    if (!this.gl) return;
  }

  shaders(vs, fs) {
    if (!vs) vs = defaultVs;
    if (!fs) fs = defaultFs;

    const program = this.gl.createProgram();

    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(vertexShader, vs);
    this.gl.compileShader(vertexShader);
    this.gl.attachShader(program, vertexShader);

    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(fragmentShader, fs);
    this.gl.compileShader(fragmentShader);
    this.gl.attachShader(program, fragmentShader);

    this.gl.linkProgram(program);

    if (this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      this.gl.useProgram(program);
      this.program = program;
    } else {
      console.error('SHADER ERROR');
      console.log(this.gl.getShaderInfoLog(vertexShader));
      console.log(this.gl.getShaderInfoLog(fragmentShader));
      return;
    }

    this.uniforms = {};

    const uniformCount = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      const uniformInfo = this.gl.getActiveUniform(program, i);
      const {
        name
      } = uniformInfo;
      this.uniforms[name] = this.gl.getUniformLocation(program, name);
    }
  }

  clear(r, g, b, a) {
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  u(name) {
    return this.uniforms[name];
  }

  hexToNormalizedRGB(hex = '#aaa', a = 1) {
    // Remove '#' if present
    hex = hex.replace(/^#/, '');

    // Parse hexadecimal color to RGB components
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    // Normalize RGB values
    const normalizedR = r / 255;
    const normalizedG = g / 255;
    const normalizedB = b / 255;

    // Return an object containing normalized RGB values
    return [normalizedR, normalizedG, normalizedB];
  }
}

/**
 * @class Waveform oscilloscope.
 */

class Scope extends Operator {
  constructor(ctx, container, options = {}) {
    super(ctx, options);

    /**
     * The number of samples to draw.
     */
    this.samples = options.samples || 512;


    // Create an analyser node.
    this._analyser = new AnalyserNode(ctx, {
      fftSize: this.samples,
      smoothingTimeConstant: 1,
      ...this.channelSettings
    });

    // Create the panel and the canvas.
    this._panel = document.createElement('div');
    this._panel.classList.add('scope');
    this._canvas = document.createElement('canvas');
    this._canvas.classList.add('scope-canvas');
    this._canvas.width = options.size || 400;
    this._canvas.height = options.size / 4 || 100;
    this._panel.append(this._canvas);

    // Hook into the dom.
    container.append(this._panel);

    // Make the renderer.
    this._renderer = new RendererGL(this._canvas);
    this._renderer.shaders();

    // Store a reference for the gl context to make code shorter.    
    this.gl = this._renderer.gl;

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    // Store a gl buffer for each axis.
    this._graphicsBufferX = this.gl.createBuffer();
    this._graphicsBufferY = this.gl.createBuffer();

    // Store the sound buffer.
    this._buffer = new Float32Array(this.samples);

    // X coordinates increment by 1 / samples.
    this._xAxisData = new Float32Array(this.samples).map((_, n) => {
      return 2 * n / (this.samples - 1) - 1;
    });

    /**
     * Whether the graphics drawing is held in place.
     */
    this.hold = false;

    /**
     * Scale the vertical axis signal.
     */
    this.scale = 0.6;

    this.mode = options.mode || 'points';

    this.pointSize = options.pointSize || 4;

    this.color = this._renderer.hexToNormalizedRGB(options.color || '#fff');
    this.background = this._renderer.hexToNormalizedRGB(options.background || '#000');

    // Store any uniform locations.

    this.now = performance.now();

    // Bind the render for looping.
    this._render = this.render.bind(this);

    // Toggle hold on click.
    this._canvas.addEventListener('click', () => this.hold = !this.hold);

    this._render();
  }


  get inlet() {
    return this._analyser;
  }

  /**
   * Render the scope.
   */
  render() {
    requestAnimationFrame(this._render);
    const n = performance.now();

    if (this.hold) {
      return;
    }
    n - this.now;
    this.now = n;

    // if (elapsed > 17) { return; }

    // Get the data from the two channels of audio.
    this._analyser.getFloatTimeDomainData(this._buffer);

    // Clear the canvas.
    this._renderer.clear(...this.background, 1);

    // Send the X buffer to the shaders.
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._graphicsBufferX);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this._xAxisData, this.gl.DYNAMIC_DRAW);
    this.gl.vertexAttribPointer(0, 1, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(0);

    // Send the Y buffer to the shaders.
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._graphicsBufferY);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this._buffer, this.gl.DYNAMIC_DRAW);
    this.gl.vertexAttribPointer(1, 1, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(1);

    this.gl.uniform2f(this._renderer.u('uScale'), 1.0, this.scale);
    this.gl.uniform1f(this._renderer.u('uPointSize'), this.pointSize);
    this.gl.uniform3fv(this._renderer.u('uColor'), this.color);

    if (this.mode === 'line') {
      this.gl.uniform1i(this._renderer.u('uMode'), 1);
      this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.samples);
    } else {
      this.gl.uniform1i(this._renderer.u('uMode'), 0);
      this.gl.drawArrays(this.gl.POINTS, 0, this.samples);
    }
  }
}

/**
 * @class A 2D 2-input oscilloscope.
 */

class Scope2D extends Operator {
  constructor(ctx, container, options = {}) {
    super(ctx, options);

    /**
     * The number of samples to draw.
     */
    this.samples = options.samples || 512;

    // Create an analyser node for each axis.
    this._analyserX = new AnalyserNode(ctx, { fftSize: this.samples });
    this._analyserY = new AnalyserNode(ctx, { fftSize: this.samples });

    // Create the panel and the canvas.
    this._panel = document.createElement('div');
    this._panel.classList.add('scope');
    this._canvas = document.createElement('canvas');
    this._canvas.classList.add('scope-canvas');
    this._canvas.width = options.size || 400;
    this._canvas.height = options.size || 400;
    this._panel.append(this._canvas);

    // Hook into the dom.
    container.append(this._panel);

    // Make the renderer.
    this._renderer = new RendererGL(this._canvas);
    this._renderer.shaders();

    // Store a reference for the gl context to make code shorter.    
    this.gl = this._renderer.gl;

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE);

    // Store a gl buffer for each axis.
    this._graphicsBufferX = this.gl.createBuffer();
    this._graphicsBufferY = this.gl.createBuffer();

    // Store the sound buffer for each axis. Audio writes to these buffers and
    // then they get sent to graphics.
    this._bufferX = new Float32Array(this.samples);
    this._bufferY = new Float32Array(this.samples);

    /**
     * Whether the graphics drawing is held in place.
     */
    this.hold = false;

    /**
     * Scale the X axis signal.
     */
    this.scaleX = 0.6;

    /**
     * Scale the X axis signal.
     */
    this.scaleY = 0.6;

    this.mode = options.mode || 'line';

    this.pointSize = options.pointSize || 4;

    this.color = this._renderer.hexToNormalizedRGB(options.color || '#fff');
    this.background = this._renderer.hexToNormalizedRGB(options.background || '#000');

    this.now = performance.now();

    // Bind the render for looping.
    this._render = this.render.bind(this);

    // Toggle hold on click.
    this._canvas.addEventListener('click', () => this.hold = !this.hold);

    this._render();
  }


  get inlet() { return this._analyserX; }
  get inlet2() { return this._analyserY; }



  /**
   * Render the scope.
   */
  render() {
    requestAnimationFrame(this._render);
    const n = performance.now();

    if (this.hold) { return; }
    n - this.now;
    this.now = n;



    // if (elapsed > 17) { return; }

    // Get the data from the two channels of audio.
    this._analyserX.getFloatTimeDomainData(this._bufferX);
    this._analyserY.getFloatTimeDomainData(this._bufferY);

    // Clear the canvas.
    this._renderer.clear(0.1, 0.1, 0.1, 1);

    // Send the X buffer to the shaders.
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._graphicsBufferX);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this._bufferX, this.gl.DYNAMIC_DRAW);
    this.gl.vertexAttribPointer(0, 1, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(0);

    // Send the Y buffer to the shaders.
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._graphicsBufferY);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this._bufferY, this.gl.DYNAMIC_DRAW);
    this.gl.vertexAttribPointer(1, 1, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(1);


    this.gl.uniform2f(this._renderer.u('uScale'), this.scaleX, this.scaleY);
    this.gl.uniform1f(this._renderer.u('uPointSize'), this.pointSize);
    this.gl.uniform3fv(this._renderer.u('uColor'), this.color);


    if (this.mode === 'line') {
      this.gl.uniform1i(this._renderer.u('uMode'), 1);
      this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.samples);
    } else {
      this.gl.uniform1i(this._renderer.u('uMode'), 0);
      this.gl.drawArrays(this.gl.POINTS, 0, this.samples);
    }
  }
}

const lerp = (a, b, t) => a + (t * (b - a));



function Float32Concat(a, b) {
  const arr = new Float32Array(a.length + b.length);
  arr.set(a);
  arr.set(b, a.length);
  return arr;
}


class ADSREnvelope {
  constructor(ctx, target, ADSR = [0.1, 0.1, 0.5, 0.5]) {
    this.ctx = ctx;
    this.param = target;

    this._attack = ADSR[0];
    this._decay = ADSR[1];
    this._sustain = ADSR[2];
    this._release = ADSR[3];

    this._resolution = 0.1;

    this._attackDecayRamp = null;
    this._releaseRamp = null;

    this._resolution = 0.001;

    this._rampDone = -1;

    this._start = 0;
    this._peak = 1;

    this._calculateRamps();

  }

  _calculateRamps() {
    const attackRamp = this.generateRamp(this._start, this._peak, this._attack, true);
    const decayRamp = this.generateRamp(this._peak, this._sustain, this._decay, true);
    this._attackDecayRamp = Float32Concat(attackRamp, decayRamp);
    this._releaseRamp = this.generateRamp(this._sustain, this._start, this._release, true);
    this._attackDecayReleaseRamp = Float32Concat(this._attackDecayRamp, this._releaseRamp);
  }

  set attack(val) {
    this._attack = val;
    this._calculateRamps();
  }
  get attack() {
    return this._attack;
  }

  set decay(val) {
    this._decay = val;
    this._calculateRamps();
  }
  get decay() {
    return this._attack;
  }

  set sustain(val) {
    this._sustain = val;
    this._calculateRamps();
  }
  get sustain() {
    return this._attack;
  }

  set release(val) {
    this._release = val;
    this._calculateRamps();
  }
  get release() {
    return this._attack;
  }


  triggerAttack(time = 0) {
    const now = this.ctx.currentTime;
    if (now < this._rampDone) return;
    const rampTime = this._attack + this._decay;
    this._rampDone = now + rampTime;
    this.param.setValueAtTime(this._start, now);

    try {
      this.param.setValueCurveAtTime(this._attackDecayRamp, now + 1 / this.ctx.sampleRate, rampTime);
    } catch {

    }
  }

  triggerRelease() {
    const now = this.ctx.currentTime;
    if (now < this._rampDone) return;
    const rampTime = this._release;
    this._rampDone = now + rampTime;

    try {
      this.param.setValueCurveAtTime(this._releaseRamp, now, rampTime);
    } catch {

    }
  }

  triggerAttackRelease() {
    const now = this.ctx.currentTime;
    if (now < this._rampDone) return;
    const rampTime = this._attack + this._decay + this._release;
    this._rampDone = now + rampTime;
    this.param.setValueAtTime(this._start, now);
    // console.log(128 / this.ctx.sampleRate)

    try {
      this.param.setValueCurveAtTime(this._attackDecayReleaseRamp, now + 128 / this.ctx.sampleRate, rampTime);
    } catch {

    }
  }



  generateRamp(from, to, time, expo = false) {
    let samples = Math.floor(time * this.ctx.sampleRate * this._resolution);
    samples = Math.max(samples, 3);
    const ramp = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      let t = i / (samples - 1);
      if (expo) {
        ramp[i] = lerp(from, to, 1 - ((1 - t) ** 2));
      } else {
        ramp[i] = lerp(from, to, t);
      }
    }
    return ramp;
  }


}

class Envelope2 extends Operator {
  constructor(ctx, options) {
    super(ctx);

    this._attack = options.attack || 0.01;
    this._decay = options.decay || 0.1;
    this._sustain = options.sustain || 0.5;
    this._release = options.release || 0.1;
    this._shape = options.shape || 0.01;

    this.type = (options.type || 'adsr').toUpperCase();


    // this._source = new ConstantSourceNode(ctx, {
    //   offset: 0,
    // });
    // this._source.start();

    this.loadWorklet('envelope-generator');

    this._out = new GainNode(this.ctx, { ...MONO, gain: 1 });
  }

  init() {
    this._env = this.createWorklet('envelope-generator', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { type: this.type },
    });

    this._gateParam = this._env.parameters.get('gate');
    this._attackParam = this._env.parameters.get('attack');
    this._releaseParam = this._env.parameters.get('release');
    this._decayParam = this._env.parameters.get('decay');
    this._sustainParam = this._env.parameters.get('sustain');
    this._shapeParam = this._env.parameters.get('shape');



    this._env.connect(this._out);

  }

  get inlet() { return null; }
  get outlet() { return this._out; }

  gate(startTime = 0, length = 0) {
    const now = this.ctx.currentTime;
    let l = Math.max(1 / this.ctx.sampleRate, length);
    this._gateParam.setValueAtTime(1, now + startTime);
    this._gateParam.setValueAtTime(0, now + startTime + l);
  }

  gateOn(time = 0) {

  }

  gateOff(time = 0) {

  }

  // gate(time = 0.1) {
  //   const now = this.ctx.currentTime;
  //   this._source.offset.setValueAtTime(0, now);
  //   this._source.offset.linearRampToValueAtTime(1, now + 0.03);
  //   this._source.offset.linearRampToValueAtTime(0, now + 0.0301 + 0.03);
  //   // this._source.offset.setValueAtTime(0, now + 0.0301 + 0.5)
  // }
}

var map = /*#__PURE__*/Object.freeze({
  __proto__: null,
  A440: A440,
  ADSREnvelope: ADSREnvelope,
  ArraySource: ArraySource,
  Convolver: Convolver,
  Crossfade: Crossfade,
  Delay: Delay,
  Distortion: Distortion,
  Envelope2: Envelope2,
  FILTER_TYPES: FILTER_TYPES,
  FeedbackOscillator: FeedbackOscillator,
  Filter: Filter,
  Filter2: Filter2,
  Gain: Gain,
  HARD_CLIP: HARD_CLIP,
  IR: IR,
  IR_EXPO: IR_EXPO,
  MONO: MONO,
  MonoToStereo: MonoToStereo,
  Mult: Mult,
  Noise: Noise,
  OnePoleFilter: OnePoleFilter,
  Operator: Operator,
  Oscillator: Oscillator,
  PulseOscillator: PulseOscillator,
  RandomSource: RandomSource,
  SOFT_CLIP: SOFT_CLIP,
  Saturator: Saturator,
  Scope: Scope,
  Scope2D: Scope2D,
  Signal: Signal,
  SignalMath: SignalMath,
  Spect: Spect,
  StateVariableFilter: StateVariableFilter,
  StereoMerger: StereoMerger,
  StereoSplitter: StereoSplitter,
  Verb2: Verb2,
  Verb3: Verb3,
  WAVE_SHAPES: WAVE_SHAPES,
  dBtogain: dBtogain,
  ftom: ftom,
  join: join,
  mtof: mtof,
  paramify: paramify,
  parseOptions: parseOptions,
  series: series,
  split: split
});

const worklets = [{
  name: 'feedback-oscillator',
  path: '/src/worklets/FeedBackOscillator.processor.js'
}, {
  name: 'signal-math',
  path: '/src/worklets/SignalMath.processor.js'
}, {
  name: 'mix-2',
  path: '/src/worklets/Mix2.processor.js'
}, {
  name: 'mix-4',
  path: '/src/worklets/Mix4.processor.js'
}, {
  name: 'crossfade',
  path: '/src/worklets/Crossfade.processor.js'
}, {
  name: 'state-variable-filter',
  path: '/src/worklets/StateVariableFilter.processor.js',
}, {
  name: 'envelope-generator',
  path: '/src/worklets/EnvelopeGenerator.processor.js'
}];

/**
 * @file Helper functions to make Worklet management a little bit easier.
 */

/**
 * Module-scoped list of worklets and their state.
 */
const WORKLETS = {};


/**
 * Add the synth kit custom worklets to an audio context.
 * IMPORTANT: attaches the function `sk_getWorklet` to the host audio context 
 * so that auidio nodes made within that context can ask about the status of 
 * worklets.
 */
function setupWorkletContext(ctx, bundlePath) {

  if (ctx.sk_getWorklet) {
    console.warn('Synthkit worklets already set up in context.');
    return;
  }

  // Allow nodes to look for worklets withou just calling new WorkletPorcessor.
  ctx.sk_getWorklet = getWorklet;

  for (let worklet of worklets) {
    registerWorklet(worklet);
  }

  if (bundlePath) {
    ctx.audioWorklet.addModule(bundlePath).then(() => {
      for (let name in WORKLETS) {
        onLoadWorklet(name);
      }
    });
    return;
  }

  for (let name in WORKLETS) {
    ctx.audioWorklet.addModule(WORKLETS[name].path).then(() => {
      onLoadWorklet(name);
    });
  }
}

/**
 * Register a worklet.
 */
function registerWorklet(worklet) {
  WORKLETS[worklet.name] = {
    path: worklet.path,
    loaded: false,
    onLoadCallbacks: [],
  };
}

/**
 * When a named worklet loads.
 */
function onLoadWorklet(name) {
  if (!WORKLETS[name]) return;
  WORKLETS[name].loaded = true;
  for (const fn of WORKLETS[name].onLoadCallbacks) {
    fn();
  }
  WORKLETS[name].onLoadCallbacks = [];
}

/**
 * Get a worklet by name and add a listenet to the callback queue if the 
 * listener is not yet loaded.
 */
function getWorklet(name, fn) {
  // Case (1) unknown worklet.
  if (!WORKLETS[name]) {
    console.error('Unknown worklet processor name: ', name);
    return;
  }

  // Case (2) already loaded worklet! Imediately invoke the callback.
  if (WORKLETS[name].loaded) {
    fn();
  }

  // Case (3) push the callback into the list for when complete.
  WORKLETS[name].onLoadCallbacks.push(fn);
}

/*
 * 
 */
class SynthKit {
  constructor(options = {}) {
    this.ctx = new AudioContext();
    this.dac = new Gain(this.ctx, 0.5);
    this.dac.connect(this.ctx.destination);

    if (this.release) {
      const path = options.pathToWorklets || '/dist/worklets.js';
      setupWorkletContext(this.ctx, path);
    } else {
      setupWorkletContext(this.ctx);
    }
  }

  get now() {
    return this.ctx.currentTime;
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  operator(options) {
    return new Operator(this.ctx, options);
  }

  oscillator(options) {
    return new Oscillator(this.ctx, options);
  }

  pulseOscillator(options) {
    return new PulseOscillator(this.ctx, options);
  }

  signal(val) {
    return new Signal(this.ctx, val);
  }

  gain(val) {
    return new Gain(this.ctx, val);
  }

  randomSource(steps, length) {
    return new RandomSource(this.ctx, steps, length);
  }

  adsr(param, adsr) {
    return new ADSREnvelope(this.ctx, param, adsr);
  }
}

// Set a global bundle flag so the Synhkit constructor knows where 

SynthKit.prototype.release = true;

export { SynthKit, map as sk };
