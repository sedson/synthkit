# SynthKit
A set of tools for making patches, sounds, and music with the WebAudio API.

##


### Code structure
```
── core
│   └── Operator, params
├── effects
│   └── Audio effects
├── envelopes
│   └── Envolope
├── filters
│   └── Filters
├── oscillators
│   ├── FeedbackOscillator
│   ├── Oscillator
│   └── PulseOscillator
├── scopes
│   └── Visualizers
├── synthkit.js :
├── utils
│   └── Various 
└── worklets
    ├── BaseWorklet.processor.js
    ├── Crossfade.processor.js
    ├── FeedbackOscillator.processor.js
    ├── Mix2.processor.js
    ├── Mix4.processor.js
    ├── SignalMath.processor.js
    ├── StateVariableFilter.processor.js
    └── worklets.js
```