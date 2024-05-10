/**
 * @file Wrap the basic built-in OscillatorNode.
 */

import { Operator } from '../core/Operator.js';
import { parseOptions } from '../common.js';

/**
 * @class Simple oscillator.
 */
export class Oscillator extends Operator {
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