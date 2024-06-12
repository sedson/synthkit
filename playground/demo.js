// SynthKit is the constructor for a kit instance. 
// sk is the namespace for the components, constants etc.
import { SynthKit, sk } from '/dist/synthkit.js';

// Make a Kit.
const kit = new SynthKit();

// Grab a ref to the created WebAudioContext
const ctx = kit.ctx;

// Make an oscillator. 220hz saw.
const osc = new sk.Oscillator(ctx, { freq: 220, shape: 'saw' });

// Make a filter. Lowpass @ 800hz.
const filter = new sk.Filter(ctx, { freq: 800, q: 5, type: 'lowpass' });

// Make an LFO to modulate the filter cutoff. 1hz sine.
const lfo = new sk.Oscillator(ctx, { freq: 1, shape: 'sine' });

// Set up the signal chain. 
// kitInstance.dac is the browser's audio out.
osc.connect(filter).connect(kit.dac);

// Instead of going from (-1:1), we want our LFO going from (-600:600) to
// have an audible effect. When connected to a param (like the a-rate filter 
// cuttoff) it will be summed with the inherent value. So filter cuttoff is 
// modulating from 200 to 1400hz.
lfo.scale(600).connect(filter.frequency);

// Because WebAudio! Audio won't actually play until the user interacts with 
// the page.
window.addEventListener('click', () => {
  kit.resume();
});