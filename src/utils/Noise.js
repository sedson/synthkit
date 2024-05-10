/**
 * @class A white noise source.
 */

import { Operator } from '../core/Operator.js';

export class Noise extends Operator {

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