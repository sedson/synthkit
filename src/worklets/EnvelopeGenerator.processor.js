/**
 * @file Processor for the a-rate envelope generator. Can handle a bunch of 
 * envelope types but will always contain params for full ADSR + hold.
 * 
 * AR - attack + imediate release.
 * ASR - attack + hold at full gate + release.
 * ADS - attack + imediate decay and hold at sustain.
 * ADSR - full attack + decay + sustain until release.
 */

import { BaseWorklet } from './BaseWorklet.processor.js';

const IDLE = 0;
const ATTACK = 1;
const DECAY = 2;
const SUSTAIN = 3;
const RELEASE = 4;
const SHAPE = 5;

const ENV_TYPES = {
  AR: true,
  ASR: true,
  ADS: true,
  ADSR: true,
};

class EnvelopeGenerator extends BaseWorklet {
  constructor(options = {}) {
    super(options);

    // Current value of the gate signal. A-rate.
    this.gate = 0;

    // Slope of the gate change.
    this.slope = 0;

    // Current state enum.
    this.state = IDLE;

    // Current value 
    this.value = 0;

    // The value of the current params.
    this.paramValues = new Float32Array(6);

    // The value of param smoothing.
    this.paramSmoothing = 0.01;

    // The type of envelope to generate.
    this.type = (options?.processorOptions?.type || 'x').toUpperCase();
    if (!ENV_TYPES[this.type]) {
      this.type = 'ADSR';
    }
    // Whether to listen for a release.
    this.ignoreRelease = this.type.indexOf('R') === -1;

    // Whether to ignore the decay statge. Only used in the ASR mode.
    this.ignoreDecay = this.type.indexOf('D') === -1;

    // Bind the function.
    this.generateEnvelope = this[this.type].bind(this);
  }

  static get parameterDescriptors() {
    return [{
      name: 'gate',
      minValue: 0,
      maxValue: 1,
      defaultValue: 0,
      automationRate: 'a-rate',
    }, {
      name: 'attack',
      minValue: 1e-5,
      maxValue: 3,
      defaultValue: 0.01,
      automationRate: 'k-rate',
    }, {
      name: 'release',
      minValue: 1e-5,
      maxValue: 3,
      defaultValue: 0.01,
      automationRate: 'k-rate',
    }, {
      name: 'decay',
      minValue: 1e-5,
      maxValue: 3,
      defaultValue: 0.1,
      automationRate: 'k-rate',
    }, {
      name: 'sustain',
      minValue: 0,
      maxValue: 1,
      defaultValue: 0.5,
      automationRate: 'k-rate',
    }, {
      name: 'shape',
      minValue: 0.0001,
      maxValue: 10,
      defaultValue: 0.001,
      automationRate: 'k-rate'
    }];
  }

  /**
   * Calculate the onepole-type coeffiecents that will make.
   * @param {number} rate The time (in samples) for the stage.
   * @param {number [1e-7, 10]} shape The  
   */
  calcCoefficient(rate, shape) {
    return 1 - Math.exp(-Math.log((1 + shape) / shape) / rate);
  }

  /**
   * Process the incoming gate signal. Set the state of the internal gate and 
   * slope values.
   * @param {number} gate The incoming gate signal.
   */
  processGate(gate) {
    this.slope = gate - this.gate;
    this.gate = gate;
    if (this.slope === +1) {
      this.state = ATTACK;
    }

    if (this.slope === -1 && !this.ignoreRelease) {
      this.state = RELEASE;
    }
  }

  /**
   * Process the attack stage. Sets this.value to the next sample for the env. 
   * Returns true if the attack state is over.
   */
  processAttack() {
    this.value = this.lerp(this.value, 1 + this.paramValues[SHAPE], this.paramValues[ATTACK]);
    return this.value >= 1;
  }

  /**
   * Process the decay stage. Sets this.value to the next sample for the env. 
   * Returns true if the decay state is over.
   */
  processDecay() {
    this.value = this.lerp(this.value, this.paramValues[SUSTAIN] - this.paramValues[SHAPE], this.paramValues[DECAY]);
    if (this.value <= this.paramValues[SUSTAIN] + 0.0001) {
      return true;
    }
  }

  /**
   * Process the release stage. Sets this.value to the next sample for the env. 
   * Returns true if the release state is over.
   */
  processRelelase() {
    this.value = this.lerp(this.value, -this.paramValues[SHAPE], this.paramValues[RELEASE]);
    if (this.value < 0.0001) {
      return true;
    }
  }

  /**
   * Process the sustain stage.
   */
  processSustain() {
    if (this.ignoreDecay) this.value = 1;
    this.value = this.paramValues[SUSTAIN];
  }

  /**
   * Unpack the parameters, convert the needed ones to filter coefficients, and 
   * store them 
   */
  unpackParams(parameters) {
    const a = this.slewSample(parameters.attack, 0, 'a', this.paramSmoothing);
    const d = this.slewSample(parameters.decay, 0, 'd', this.paramSmoothing);
    const s = this.slewSample(parameters.sustain, 0, 's', this.paramSmoothing);
    const r = this.slewSample(parameters.release, 0, 'r', this.paramSmoothing);
    const sh = this.slewSample(parameters.shape, 0, 'sh', this.paramSmoothing);

    this.paramValues[SUSTAIN] = s;
    this.paramValues[SHAPE] = sh;
    this.paramValues[ATTACK] = this.calcCoefficient(a * sampleRate, sh);
    this.paramValues[DECAY] = this.calcCoefficient(d * sampleRate, sh);
    this.paramValues[RELEASE] = this.calcCoefficient(r * sampleRate, sh);
  }

  /**
   * ADSR state machine. If gate off triggers a release, that overrides 
   * everything else.
   */
  ADSR() {
    if (this.state === ATTACK) {
      if (this.processAttack()) this.state = DECAY;
    } else if (this.state === DECAY) {
      if (this.processDecay()) this.state = SUSTAIN;
    } else if (this.state === SUSTAIN) {
      this.processSustain();
    } else if (this.state === RELEASE) {
      if (this.processRelelase()) this.state = IDLE;
    }
    return this.value;
  }

  /**
   * AR state machine. If gate off triggers a release, that overrides 
   * everything else.
   */
  AR() {
    if (this.state === ATTACK) {
      if (this.processAttack()) this.state = RELEASE;
    } else if (this.state === RELEASE) {
      if (this.processRelelase()) this.state = IDLE;
    }
  }

  /**
   * ASR state machine.
   */
  ASR() {
    if (this.state === ATTACK) {
      if (this.processAttack()) this.state = SUSTAIN;
    } else if (this.state === RELEASE) {
      if (this.processRelelase()) this.state = IDLE;
    }
  }

  /**
   * ADS state machine.
   */
  ADS() {
    if (this.state === ATTACK) {
      if (this.processAttack()) this.state = DECAY;
    } else if (this.state === DECAY) {
      if (this.processDecay()) this.state = SUSTAIN;
    }
  }

  process(inputs, outputs, parameters) {
    let out = outputs[0][0];

    this.unpackParams(parameters);

    for (let s = 0; s < out.length; s++) {
      const gate = this.sample(parameters.gate, s);
      this.processGate(gate);

      if (this.state === IDLE) {
        out[s] = 0;
        continue;
      }

      this.generateEnvelope();
      out[s] = this.value;
    }

    // this.frame += 1;

    if (this.frame > 5 * sampleRate / 128) {
      this.frame = 0;
      console.log(this.slope, this.gate, this.state);
      console.log(this.paramData);
      console.log(this.paramValues);
    }
    return true;
  }
}

registerProcessor('envelope-generator', EnvelopeGenerator);