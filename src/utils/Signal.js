/**
 * @file A signal is an audio-rate value. The operator 
 */

import { Operator } from '../core/Operator.js';

export class Signal extends Operator {
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