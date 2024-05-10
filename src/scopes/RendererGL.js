/**
 * @file Provide the minimal GL abstraction to build oscilloscope and spectrogram 
 * visualizers on top of.
 */

/**
 * Default vertex shader.
 */
const defaultVs = `
#version 300 es

layout(location = 0) in float aX;
layout(location = 1) in float aY;
layout(location = 2) in float opacity;

out float vOpacity;
out vec2 vPos;

uniform vec2 uScale;
uniform float uPointSize;

void main () 
{
  gl_Position = vec4(aX * uScale.x, aY * uScale.y, 0.0, 1.0);
  gl_PointSize = uPointSize;
  vPos = vec2(aX * uScale.x, aY * uScale.y);
}
`.trim();

/**
 * Default fragment shader.
 */
const defaultFs = `
#version 300 es

precision mediump float;

in vec2 vPos;
in float vOpacity;

out vec4 fragColor;

uniform vec3 uColor;
uniform int uMode;

void main () 
{ 
  if (uMode < 1) {
   float fade = distance(vec2(0.5, 0.5), gl_PointCoord);
   if (fade > 0.5) {
    // discard;
   }
  }
  
  fragColor.rgb = uColor.rgb;
  fragColor.a = 1.0;
}
`.trim();



export class RendererGL {
  constructor(canvas) {
    this.gl = canvas.getContext('webgl2', {
      antialias: false,
    });
    if (!this.gl) return;
  }

  shaders(vs, fs) {
    if (!vs) vs = defaultVs;
    if (!fs) fs = defaultFs;

    const program = this.gl.createProgram();

    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(vertexShader, vs);
    this.gl.compileShader(vertexShader);
    this.gl.attachShader(program, vertexShader);

    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(fragmentShader, fs);
    this.gl.compileShader(fragmentShader);
    this.gl.attachShader(program, fragmentShader);

    this.gl.linkProgram(program);

    if (this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      this.gl.useProgram(program);
      this.program = program;
    } else {
      console.error('SHADER ERROR')
      console.log(this.gl.getShaderInfoLog(vertexShader));
      console.log(this.gl.getShaderInfoLog(fragmentShader));
      return;
    }

    this.uniforms = {};

    const uniformCount = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      const uniformInfo = this.gl.getActiveUniform(program, i);
      const {
        name
      } = uniformInfo;
      this.uniforms[name] = this.gl.getUniformLocation(program, name);
    }
  }

  clear(r, g, b, a) {
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  u(name) {
    return this.uniforms[name];
  }

  hexToNormalizedRGB(hex = '#aaa', a = 1) {
    // Remove '#' if present
    hex = hex.replace(/^#/, '');

    // Parse hexadecimal color to RGB components
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    // Normalize RGB values
    const normalizedR = r / 255;
    const normalizedG = g / 255;
    const normalizedB = b / 255;

    // Return an object containing normalized RGB values
    return [normalizedR, normalizedG, normalizedB];
  }
}