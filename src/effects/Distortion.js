import { Effect } from './Effect.js';

export class Distortion extends Effect {
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