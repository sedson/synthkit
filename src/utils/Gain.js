/**
 * @file A simple gain node.
 */

import { Operator } from '../core/Operator.js';

export class Gain extends Operator {
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