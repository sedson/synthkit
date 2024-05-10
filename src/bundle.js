// Set a global bundle flag so the Synhkit constructor knows where 
// to find its worklet dependencies.

import { SynthKit, sk } from './synthkit.js';

SynthKit.prototype.release = true;

export { SynthKit, sk };