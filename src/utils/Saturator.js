/**
 * @file A simple tanh saturator node.
 */

import { Operator } from '../core/Operator.js';
import { SOFT_CLIP, HARD_CLIP } from '../common.js';

export class Saturator extends Operator {
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
    console.log({ HARD_CLIP })
  }
  get inlet() { return this._shaper; }
  get outlet() { return this._shaper; }
}