/** Draw an equirectangular panorama as a sphere around the viewer (WebGL2, one full-screen quad). */

// Labels tint the photo rather than hide it: the rocks stay readable under their class colour.
const LABEL_OPACITY = 0.5

const VERTEX = `#version 300 es
in vec2 corner;
out vec2 ndc;
void main() { ndc = corner; gl_Position = vec4(corner, 0.0, 1.0); }`

// Same convention as core/stitch: azimuth clockwise from north, x east, y up, z north.
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 ndc;
out vec4 colour;
uniform sampler2D pano;
uniform sampler2D labels; // AI4Mars class colours, alpha 0 where nothing is labelled
uniform float labelMix;   // 0 hides the labels
uniform float yaw, pitch;
uniform vec2 tanHalf; // tangent of the half field of view, horizontal and vertical
const float PI = 3.141592653589793;
void main() {
  vec3 f = vec3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw));
  vec3 r = vec3(cos(yaw), 0.0, -sin(yaw));
  vec3 u = vec3(-sin(pitch) * sin(yaw), cos(pitch), -sin(pitch) * cos(yaw));
  vec3 d = normalize(f + r * ndc.x * tanHalf.x + u * ndc.y * tanHalf.y);
  float lon = atan(d.x, d.z) / (2.0 * PI);
  vec2 uv = vec2(fract(lon), 0.5 - asin(clamp(d.y, -1.0, 1.0)) / PI);
  // u jumps 1 -> 0 at north: take gradients from whichever parametrisation is continuous here,
  // or the mip selection spikes and draws a line along the seam.
  float ua = fract(lon), ub = fract(lon + 0.5);
  float gx = abs(dFdx(ua)) < abs(dFdx(ub)) ? dFdx(ua) : dFdx(ub);
  float gy = abs(dFdy(ua)) < abs(dFdy(ub)) ? dFdy(ua) : dFdy(ub);
  colour = textureGrad(pano, uv, vec2(gx, dFdx(uv.y)), vec2(gy, dFdy(uv.y)));
  if (labelMix > 0.0) {
    vec4 l = textureLod(labels, uv, 0.0); // nearest: class edges stay crisp
    colour.rgb = mix(colour.rgb, l.rgb, l.a * labelMix);
  }
}`

export type PanoRenderer = {
  setImage(pixels: Uint8ClampedArray, width: number, height: number): void
  /** An equirectangular RGBA overlay drawn over the photos, or null to remove it. */
  setLabels(overlay: { pixels: Uint8ClampedArray; width: number; height: number } | null): void
  /** Angles in degrees; `fovDeg` spans the longer side of the screen. */
  draw(yawDeg: number, pitchDeg: number, fovDeg: number): void
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('WebGL: cannot create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(`WebGL: ${gl.getShaderInfoLog(shader) ?? 'shader failed'}`)
  return shader
}

export function createPanoRenderer(canvas: HTMLCanvasElement): PanoRenderer {
  const gl = canvas.getContext('webgl2')
  if (!gl) throw new Error('WebGL2 is not available in this browser')
  const program = gl.createProgram()
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(`WebGL: ${gl.getProgramInfoLog(program) ?? 'link failed'}`)
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const corner = gl.getAttribLocation(program, 'corner')
  gl.enableVertexAttribArray(corner)
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0)
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  const labelTexture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, labelTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
  gl.activeTexture(gl.TEXTURE0)
  const uniform = (name: string) => gl.getUniformLocation(program, name)
  const [yaw, pitch, tanHalf, labels, labelMix] = [
    'yaw',
    'pitch',
    'tanHalf',
    'labels',
    'labelMix',
  ].map(uniform)
  gl.uniform1i(labels, 1)
  gl.uniform1f(labelMix, 0)
  const rad = Math.PI / 180
  return {
    setImage(pixels, width, height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      gl.generateMipmap(gl.TEXTURE_2D)
    },
    setLabels(overlay) {
      gl.activeTexture(gl.TEXTURE1)
      if (overlay)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          overlay.width,
          overlay.height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          overlay.pixels,
        )
      gl.activeTexture(gl.TEXTURE0)
      gl.uniform1f(labelMix, overlay ? LABEL_OPACITY : 0)
    },
    draw(yawDeg, pitchDeg, fovDeg) {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.round(canvas.clientWidth * dpr)
      const h = Math.round(canvas.clientHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h]
      gl.viewport(0, 0, w, h)
      gl.uniform1f(yaw, yawDeg * rad)
      gl.uniform1f(pitch, pitchDeg * rad)
      // The field of view spans the screen's longer side, so portrait phones aren't stretched.
      const t = Math.tan((fovDeg * rad) / 2)
      const long = Math.max(w, h)
      gl.uniform2f(tanHalf, (t * w) / long, (t * h) / long)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
  }
}
