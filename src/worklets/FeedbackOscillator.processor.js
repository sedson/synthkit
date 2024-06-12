/**
 * A single sine wave self modulating feedback oscillator. With positive 
 * amounts of feedbackm takes on saw like sidebands. With negative feedback, 
 * takes on square-like sidebands. Gets chaotic and noisy as high levels 
 * of feedback in wither direction.
 */
import { BaseWorklet } from './BaseWorklet.processor.js';


class FeedbackOscillator extends BaseWorklet {
  constructor() {
    super();

    // Freq param smoothing.
    this.freq = {
      val: 440,
      prev: 440,
      delta: 0
    };

    // Single sample feedback buffer.
    this.lastSample = 0;
  }


  static get parameterDescriptors() {
    return [
      {
        name: 'frequency',
        minValue: 0,
        maxValue: sampleRate * 0.5,
        defaultValue: 440,
        automationRate: 'a-rate',
      },
      {
        name: 'feedback',
        minValue: -4,
        maxValue: 4,
        defaultValue: 0,
        automationRate: 'a-rate',
      },
    ];
  }


  lerp(a, b, t) {
    return (a * (1 - t) + b * t);
  }


  process(inputs, outputs, parameters) {
    for (const output of outputs) {
      for (let channelIndex = 0; channelIndex < output.length; channelIndex++) {
        const channel = output[channelIndex];
        for (let i = 0; i < channel.length; i++) {

          // Compute global time in seconds. 
          const globalTime = currentTime + (i / sampleRate);

          // Read the frequency.
          const freq = this.sample(parameters.frequency, i);
          this.freq.delta += globalTime * (this.freq.prev - freq);
          this.freq.prev = freq;

          const feedback = this.slewSample(parameters.feedback, i, 'feedback', 0.1);

          // Get a 0->1 phase ramp at frequency.
          let phase = (globalTime * freq + this.freq.delta) % 1;

          let fb = feedback * this.lastSample;
          if (feedback < 0) fb *= fb;

          let sample = Math.sin(phase * this.twopi + fb);
          sample = (sample + this.lastSample) / 2;
          this.lastSample = sample;

          channel[i] = sample;
        }
      }
    }
    return true;
  }
}

registerProcessor('feedback-oscillator', FeedbackOscillator);