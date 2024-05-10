import { Effect } from './Effect.js';

export class Convolver extends Effect {
  constructor(ctx, impulseResponse) {
    super(ctx);
    this._verb = new ConvolverNode(ctx, { buffer: impulseResponse });
    this._chainIn
      .connect(this._verb)
      .connect(this._chainOut);
  }
}