/**
 * @file StereoMeger. Connect signals to L, R, or C for the desired node.
 */
import { Operator } from '../core/Operator.js';

export class StereoMerger extends Operator {
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