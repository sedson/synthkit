# SynthKit
A set of tools for making patches, sounds, and music with the WebAudio API.

SynthKit provides a number of pre-made WebAudio nodes that play nicely with native and external web audio nodes. It is currently intended for making browser based synths and music toys.

To use the built version of SynthKit, grab both synthkit.js and worklets.js from the /dist folder and plop them in the same directory.


## Example
```javascript
// SynthKit is the constructor for a kit instance. 
// sk is the namespace for the components, constants etc.
import { SynthKit, sk } from '/dist/synthkit.js';

// Make a kit – for now you have to pass a path to the worklets.
const kit = new SynthKit({ pathToWorklets: '/dist/worklets.js' });

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
```

## SK Components

### Oscillators

#### Oscillator 
```javascript
new Oscillator(ctx, { freq: number, shape: 'sine|saw|tri|square' });
```
params: frequency, detune, gain

#### PulseOscillator 
```javascript
new PulseOscillator(ctx, { freq: number });
```
Same params as oscillator + .width for duty cycle (-1:1).

#### FeedbackOscillator 
```javascript
new FeedbackOscillator(ctx, { freq: number });
```
Same params as oscillator + .feedback for amount of single sample fb (-2:2). Negative feedback sounds square-ish. Positive fb sounds saw-ish.


### Filters 

#### Filter
```javascript
new Filter(ctx, { freq: number, type: 'lowpas|bandpass|highpass|allpass|notch'});
```
Biquad filter wrapper.
Params: fequency, Q

#### Filter2 
2 biquad filters at the same frequency in series. Sharper wall.

#### StateVariableFilter
```javascript
new StateVariableFilter(ctx, { freq: number });
```
SVF with 3 outlets. .lowpass, .highpass, .bandpass tuned to the same cuttoff freq.

params: frequency, Q

#### OnePole
```javascript
new OnePole(ctx, { freq: number });
```
OnePole. Probably not the best to change frequncy at a-rate or even k-rate.


### Utils
#### ArraySource
Pass an array and get a buffer. Cool for like making a small array of pitches and then playing that at a really slow rate to do CV type stuff.

#### Noise
Get a buffer of white noise.

#### Delay 
Wraps the default delay node.

#### Gain 
Wraps the default gain node.

#### MonoToStereo
Output a one channel signal on two channels.

#### RandomSource
An ArraySource filled with random numbers.

#### Saturator
Soft-clip staturator 

#### Signal 
Wraps the ConstantSourceNode.

#### SignalMath
Performs basic math (unary or binary ops) on two incoming signals.
```javascript
// Example 
const i1 = new Signal(ctx, 10);
const i2 = new Signal(ctx, 20);

const math = new SignalMath(ctx, 'add');
i1.connect(math.a) // or i1.connect(math.inlet1)
i2.connect(math.b) // or i2.connect(math.inlet2)

// Now math's outlet will have a signal at value 30
```
#### StereoMerger

#### StereoSplitter

### Scopes
#### Scope
```javascript
new Scope(ctx, { samples: number, color: hexStr, background: hexsStr, size: number});
```

`samples` is the number of samples for of time domain data
`color` is the foreground color as a hex string
`background` is the background color as a hex string
`size` is the width in px of the scope. height is width / 4


#### Scope2
Same as scope but has 2 inlets. One for x and 1 for y.

#### Spect 
````
new Spect(ctx, { samples: number, color: hexStr, background: hexsStr, size: number});
```
A log scale spectogram.






