import { Oscillator } from './Oscillator.js';

export class FeedbackOscillator extends Oscillator {
  constructor(ctx, options) {
    super(ctx, options);
    this.loadWorklet('feedback-oscillator');
  }

  init() {
    this._oscillator.disconnect();
    const freq = this._frequencyValue;
    this._oscillator.stop();
    this._oscillator = this.createWorklet('feedback-oscillator');
    this._frequency = this._oscillator.parameters.get('frequency');
    this._feedback = this._oscillator.parameters.get('feedback');
    this._frequency.value = freq;
    this._oscillator.connect(this._gain);
  }

  get frequency() { return this._frequency; }
  get feedback() { return this._feedback; }
  get gain() { return this._gain.gain; }
  get inlet() { return this._frequency; }
  get outlet() { return this._gain; }
}