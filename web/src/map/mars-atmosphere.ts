/**
 * Ground-level Mars atmosphere for walk mode, as one post-process pass over Cesium's colour and
 * depth: a dusty butterscotch sky with a blue sunset aureole and stars at night, sunlight dimmed
 * by the dust column and shading the real terrain slope, natural surface colour for greyscale
 * HiRISE, distance haze, blowing dust and dust devils.
 *
 * Colours: Pathfinder, MER and Mastcam-Z sky imaging (e.g. Lemmon et al. 2004, Science 306):
 * a pinkish-butterscotch daytime sky, blue forward-scattered light around a low Sun.
 */
import {
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Matrix4,
  PostProcessStage,
  Transforms,
  type Viewer,
} from 'cesium'
import { MARS_SPHERE } from './mars'

export type DustDevil = {
  east: number
  north: number
  baseM: number
  radiusM: number
  heightM: number
}

export type AtmosphereState = {
  tau: number // visible dust column opacity
  visibilityKm: number
  windMs: number
  windToDeg: number // direction the wind blows towards, clockwise from north
  /** Walk start: the origin of the world-locked ground detail and dust devil positions. */
  origin: { lon: number; lat: number }
  devils: DustDevil[] // positions relative to the origin; baseM above the datum
}

const MAX_DEVILS = 3
const M_PER_DEG = (MARS_SPHERE.maximumRadius * Math.PI) / 180

const SHADER = /* glsl */ `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform vec3 u_eastWC;
uniform vec3 u_northWC;
uniform vec3 u_upWC;
uniform vec3 u_camLocal;
uniform float u_tau;
uniform float u_visM;
uniform float u_time;
uniform vec2 u_wind;
uniform vec4 u_devil0;
uniform vec4 u_devil1;
uniform vec4 u_devil2;
uniform vec3 u_devilH;
uniform float u_logDepth;
in vec2 v_textureCoordinates;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

// Direction in eye coordinates -> local east, north, up.
vec3 toLocal(vec3 dirEC) {
  return vec3(dot(dirEC, czm_viewRotation * u_eastWC),
              dot(dirEC, czm_viewRotation * u_northWC),
              dot(dirEC, czm_viewRotation * u_upWC));
}

float daylight(float sinEl) { return smoothstep(-0.2, 0.1, sinEl); } // long dusty twilight

vec3 sky(vec3 d, vec3 sun) {
  float sinEl = sun.z;
  float day = daylight(sinEl);
  float up = max(d.z, 0.0);
  vec3 zenith = vec3(0.55, 0.40, 0.28);
  vec3 horizon = vec3(0.80, 0.62, 0.45);
  vec3 col = mix(horizon, zenith, sqrt(up)) * day;
  float mu = max(dot(d, sun), 0.0);
  // Dust scatters forward: a wide bright aureole; around a low Sun it is blue.
  float lowSun = 1.0 - smoothstep(0.0, 0.35, sinEl);
  vec3 glowCol = mix(vec3(1.0, 0.92, 0.78), vec3(0.30, 0.50, 0.90), lowSun);
  float glow = pow(mu, 8.0) * mix(0.5, 0.35, lowSun) + pow(mu, 120.0) * mix(1.0, 0.6, lowSun);
  col += glowCol * glow * smoothstep(-0.25, 0.0, sinEl);
  // The Sun's disc is 0.35 deg across from Mars, dimmed by the dust in front of it.
  float sunVis = exp(-u_tau / max(sinEl, 0.02));
  col += vec3(1.0, 0.97, 0.9) * smoothstep(0.999993, 0.999997, mu) * sunVis * 6.0;
  // A dust storm turns the sky into a dim, even brown.
  float storm = clamp((u_tau - 1.0) / 4.0, 0.0, 1.0);
  col = mix(col, vec3(0.50, 0.34, 0.21) * day * (1.0 - 0.55 * storm) + glowCol * pow(mu, 3.0) * 0.25 * day, storm);
  // Stars at night, fewer through dust.
  float night = 1.0 - smoothstep(-0.28, -0.1, sinEl);
  vec3 q = floor(d * 500.0);
  float s = hash(q.xy + q.z * 17.31);
  col += vec3(0.9, 0.92, 1.0) * step(0.9975, s) * (s - 0.9975) * 400.0 * night * exp(-u_tau) * step(0.0, d.z);
  return col;
}

// Dust devil: a vertical funnel at (x, y) whose base is z metres from the eye; density on a ray.
float devil(vec3 d, float sceneDist, vec4 dv, float h) {
  if (dv.w <= 0.0) return 0.0;
  float dxy = dot(d.xy, d.xy);
  if (dxy < 1e-6) return 0.0;
  float t = dot(dv.xy, d.xy) / dxy;
  if (t <= 0.0 || t > sceneDist) return 0.0;
  float z = t * d.z - dv.z;
  if (z < 0.0 || z > h) return 0.0;
  float k = z / h;
  float r = length(t * d.xy - dv.xy) / (dv.w * (1.0 + 2.5 * k));
  float swirl = 0.6 + 0.8 * noise(vec2(atan(d.y, d.x) * 60.0 + u_time * 3.0, z * 0.05 - u_time));
  return exp(-r * r * 2.0) * (1.0 - k) * swirl * 0.8;
}

void main() {
  vec4 c = texture(colorTexture, v_textureCoordinates);
  float raw = texture(depthTexture, v_textureCoordinates).r;
  vec3 sun = toLocal(normalize(czm_lightDirectionEC));
  float sinEl = sun.z;
  bool isSky = raw >= 1.0;
  // Post-process shaders are compiled without LOG_DEPTH, so czm_readDepth would hand back the
  // raw logarithmic depth; decode it here into the view-space depth (metres along the view axis).
  vec3 rayEC = czm_windowToEyeCoordinates(gl_FragCoord.xy, 0.5).xyz;
  float near = czm_currentFrustum.x;
  float viewZ = u_logDepth > 0.5
    ? pow(2.0, raw * czm_log2FarDepthFromNearPlusOne) - 1.0 + near
    : -czm_windowToEyeCoordinates(gl_FragCoord.xy, raw).z;
  vec4 posEC = vec4(rayEC * (viewZ / -rayEC.z), 1.0);
  vec3 dirEC = normalize(rayEC);
  vec3 d = toLocal(dirEC);
  float dist = isSky ? 1e9 : length(posEC.xyz);
  vec3 col;
  if (isSky) {
    col = sky(d, sun);
  } else {
    col = c.rgb;
    // Greyscale HiRISE gets the natural colour of Jezero/Gale soil (Mastcam-Z, Mastcam).
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
    col = mix(col, lum * vec3(1.32, 0.97, 0.70), 1.0 - smoothstep(0.02, 0.08, sat));
    // World-locked grain up close: the orbital image can't resolve pebbles.
    vec3 p = toLocal(posEC.xyz) + u_camLocal;
    float grain = fbm(p.xy * 5.0) * 0.6 + noise(p.xy * 22.0) * 0.4;
    col *= mix(1.0, 0.8 + 0.4 * grain, (1.0 - smoothstep(2.0, 35.0, dist)) * 0.8);
    float direct = exp(-u_tau / max(sinEl, 0.03)) * step(0.0, sinEl); // sunlight through dust
    // Scattered pebbles, 2-10 cm: irregular, mixed tones, lit on the Sun's side, casting shadows.
    vec2 cell = floor(p.xy * 8.0);
    vec2 f = fract(p.xy * 8.0) - 0.5;
    float h = hash(cell);
    if (h > 0.9) {
      vec2 q = f - (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.5;
      float r = 0.07 + 0.2 * pow(hash(cell + 1.9), 2.0); // mostly small
      float rr = r * (0.7 + 0.45 * noise(vec2(atan(q.y, q.x) * 1.6, h * 97.0)));
      float inside = 1.0 - smoothstep(rr * 0.75, rr, length(q));
      vec2 toSun = normalize(sun.xy + 1e-4);
      float facing = dot(q / max(length(q), 1e-4), toSun) * (length(q) / rr);
      float tone = mix(0.62, 1.1, hash(cell + 5.3)) * (0.9 + 0.2 * facing);
      vec2 sq = q + toSun * rr * 0.7 / max(sinEl, 0.25);
      float shade = (1.0 - smoothstep(rr * 0.75, rr, length(sq))) * (1.0 - inside) * step(0.0, sinEl);
      float near = 1.0 - smoothstep(4.0, 14.0, dist);
      col *= mix(1.0, tone, inside * near);
      col *= mix(1.0, 0.72, shade * near * direct);
    }
    // Sunlight through the dust, shading the real slope (normal from the depth buffer).
    vec3 upEC = czm_viewRotation * u_upWC;
    vec3 n = normalize(cross(dFdx(posEC.xyz), dFdy(posEC.xyz)));
    if (dot(n, dirEC) > 0.0) n = -n;
    // Across tile seams and silhouettes the derivative normal is garbage: fall back to up.
    if (!(dot(n, upEC) > 0.25)) n = upEC;
    float lambert = max(dot(n, normalize(czm_lightDirectionEC)), 0.0);
    float diffuse = (1.0 - exp(-u_tau / max(sinEl, 0.03))) * 0.55 * daylight(sinEl);
    float light = (direct * lambert + diffuse) / 0.75 + 0.03; // starlight and Phobos
    col *= light;
    // Aerial perspective: dust between the eye and the ground (Koschmieder).
    float fog = 1.0 - exp(-3.9 * dist / u_visM);
    col = mix(col, sky(normalize(vec3(d.xy, 0.03)), sun) * 0.95, fog);
  }
  // Blowing dust, stronger with wind and in storms.
  float dusty = clamp((u_tau - 0.7) / 3.0, 0.0, 1.0) * 0.5 + clamp((length(u_wind) - 8.0) / 15.0, 0.0, 0.25);
  if (dusty > 0.0) {
    vec2 q = vec2(atan(d.y, d.x) * 10.0, d.z * 25.0) - u_wind * u_time * 0.02;
    float veil = fbm(q) * fbm(q * 3.0 + 7.0);
    col = mix(col, vec3(0.62, 0.45, 0.30) * daylight(sinEl), veil * dusty * (1.0 - smoothstep(0.0, 0.6, d.z)));
  }
  float dd = devil(d, dist, u_devil0, u_devilH.x) + devil(d, dist, u_devil1, u_devilH.y) + devil(d, dist, u_devil2, u_devilH.z);
  // Lifted dust is darker than the sky behind it and lighter than shadowed ground.
  col = mix(col, vec3(0.47, 0.35, 0.25) * (0.3 + 0.7 * daylight(sinEl)), clamp(dd * 1.3, 0.0, 0.9));
  out_FragColor = vec4(1.0 - exp(-col * 1.3), 1.0); // soft shoulder instead of clipping
}
`

/** Add the atmosphere pass; call `setState` when conditions change, `destroy` on exit. */
export function createMarsAtmosphere(viewer: Viewer, initial: AtmosphereState) {
  let state = initial
  const enu = new Matrix4()
  const east = new Cartesian3()
  const north = new Cartesian3()
  const up = new Cartesian3()
  const t0 = performance.now()
  const scratch4 = new Cartesian4()
  const column = (i: number, out: Cartesian3) =>
    Cartesian3.fromCartesian4(Matrix4.getColumn(enu, i, scratch4), out)
  const frame = () => {
    Transforms.eastNorthUpToFixedFrame(viewer.camera.positionWC, MARS_SPHERE, enu)
    column(0, east)
    column(1, north)
    column(2, up)
  }
  /** Camera position in metres east/north/up of the walk origin (small numbers: GPU-safe). */
  const cameraLocal = () => {
    const c = viewer.camera.positionCartographic
    const lat = (c.latitude * 180) / Math.PI
    const lon = (c.longitude * 180) / Math.PI
    const { origin } = state
    return new Cartesian3(
      (lon - origin.lon) * M_PER_DEG * Math.cos((origin.lat * Math.PI) / 180),
      (lat - origin.lat) * M_PER_DEG,
      c.height,
    )
  }
  const devil = (i: number) => () => {
    const d = state.devils[i]
    if (!d) return new Cartesian4(0, 0, 0, 0)
    const cam = cameraLocal()
    return new Cartesian4(d.east - cam.x, d.north - cam.y, d.baseM - cam.z, d.radiusM)
  }
  const stage = new PostProcessStage({
    name: 'mars-atmosphere',
    fragmentShader: SHADER,
    uniforms: {
      u_eastWC: () => east,
      u_northWC: () => north,
      u_upWC: () => up,
      u_camLocal: () => {
        const c = cameraLocal()
        return new Cartesian3(c.x, c.y, 0) // grain is on the ground plane
      },
      u_logDepth: () => (viewer.scene.logarithmicDepthBuffer ? 1 : 0),
      u_tau: () => state.tau,
      u_visM: () => state.visibilityKm * 1000,
      u_time: () => (performance.now() - t0) / 1000,
      u_wind: () => {
        const a = (state.windToDeg * Math.PI) / 180
        return new Cartesian2(Math.sin(a) * state.windMs, Math.cos(a) * state.windMs)
      },
      u_devil0: devil(0),
      u_devil1: devil(1),
      u_devil2: devil(2),
      u_devilH: () =>
        new Cartesian3(
          ...([0, 1, 2].map((i) => state.devils[i]?.heightM ?? 1) as [number, number, number]),
        ),
    },
  })
  const remove = viewer.scene.preRender.addEventListener(frame)
  viewer.scene.postProcessStages.add(stage)
  return {
    setState(next: AtmosphereState) {
      state = { ...next, devils: next.devils.slice(0, MAX_DEVILS) }
    },
    destroy() {
      remove()
      viewer.scene.postProcessStages.remove(stage) // also destroys it
    },
  }
}
