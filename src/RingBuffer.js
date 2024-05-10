export class RingBuffer {
  constructor(length) {
    this.length = length;
    this.buffer = new Float32Array(length);
    this.index = 0;
  }

  /**
   * 
   */
  push(arr) {
    if (this.index + arr.length > this.length) {

    }

    this.buffer.set(arr, this.index);
    this.index += arr.length;


  }
}