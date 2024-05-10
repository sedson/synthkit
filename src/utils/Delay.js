/**
 * @file A simple delay line node.
 */

import { Operator } from '../core/Operator.js';

export class Delay extends Operator {
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