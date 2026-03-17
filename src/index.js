import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ASSET_BASE = 'https://cdn.prod.website-files.com/699633088760d3ad60ae151a/';
const GLB_FILE   = '69a5de05093f9a76b01ada0a_Flower18.optimized.glb.txt';

const SCROLL_RANGE  = () => window.innerHeight * 2;
const IS_MOBILE     = () => window.innerWidth <= 640;

const PHASE = {
  mobile:  { p1: 0.6, p2: 0.4 },
  desktop: { p1: 1.0, p2: 0.5 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Saturation post-process shader
// ─────────────────────────────────────────────────────────────────────────────

const SaturationShader = {
  uniforms: {
    tDiffuse:   { value: null },
    saturation: { value: 1.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float saturation;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float grey = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      color.rgb  = mix(vec3(grey), color.rgb, saturation);
      gl_FragColor = color;
    }
  `,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const lerp = (a, b, t) => a + (b - a) * t;

const easeOut2  = t => 1 - (1 - t) * (1 - t);
const easeCubic = t =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// ─────────────────────────────────────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// Wind
// ─────────────────────────────────────────────────────────────────────────────

// Shared time uniform — updated every frame, injected into every material
const windUniforms = {
  uTime:         { value: 0 },
  uWindStrength: { value: 0.04 },
  uWindSpeed:    { value: 0.7 },
};

function applyWind(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime          = windUniforms.uTime;
    shader.uniforms.uWindStrength  = windUniforms.uWindStrength;
    shader.uniforms.uWindSpeed     = windUniforms.uWindSpeed;

    shader.vertexShader =
      `uniform float uTime;
      uniform float uWindStrength;
      uniform float uWindSpeed;

      float hash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 19.19);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
          mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x),
          u.y
        );
      }
      ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      `#include <project_vertex>`,
      `#include <project_vertex>

      float dist = length(transformed.xz);
      float t = uTime * uWindSpeed;
      float n  = noise(vec2(transformed.x * 1.8 + t, transformed.z * 1.8 + t * 0.7));
           n += noise(vec2(transformed.x * 3.5 - t * 0.5, transformed.z * 3.5 + t * 1.1)) * 0.4;
      n /= 1.4;
      float displacement = (n - 0.5) * 2.0 * dist * uWindStrength;
      gl_Position = projectionMatrix * (mvPosition + vec4(0.0, displacement, 0.0, 0.0));
      `
    );
  };
  mat.needsUpdate = true;
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

async function loadGLB() {
  const url = ASSET_BASE + GLB_FILE;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GLB fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Promise((resolve, reject) => loader.parse(buf, '', resolve, reject));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function init() {
  const container = document.querySelector('[data-3d="c"]') || document.body;

  // ── Canvas ──────────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.id = 'flower-canvas';
  Object.assign(canvas.style, {
    position:      'fixed',
    top:           '0',
    left:          '0',
    width:         '100%',
    height:        '100%',
    zIndex:        '10',
    pointerEvents: 'none',
    opacity:       '0',
    transition:    'opacity 0.6s ease',
  });
  container.appendChild(canvas);

  // ── Renderer ─────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias:       true,
    alpha:           false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace    = THREE.LinearSRGBColorSpace;
  renderer.toneMapping         = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.shadowMap.enabled   = true;
  renderer.shadowMap.type      = THREE.VSMShadowMap;

  // ── Scene ─────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#aca69e');

  // ── Camera ────────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(
    IS_MOBILE() ? 25 : 20,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.rotateX(-0.3);

  // ── Lights ────────────────────────────────────────────────────────────────

  // Ambient
  scene.add(new THREE.AmbientLight(0x2c7ce6, 0.3));

  // Two directional lights sharing the same position
  const LIGHT_POS = new THREE.Vector3(25, 15, 20);
  const SHADOW_D  = 5;

  function makeDirLight(color, intensity, mapSize, shadowRadius, normalBias) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.copy(LIGHT_POS);
    light.castShadow = true;

    light.shadow.mapSize.set(mapSize, mapSize);
    light.shadow.camera.left   = -SHADOW_D;
    light.shadow.camera.right  =  SHADOW_D;
    light.shadow.camera.top    =  SHADOW_D;
    light.shadow.camera.bottom = -SHADOW_D;
    light.shadow.camera.near   = 0.1;
    light.shadow.camera.far    = 40;
    light.shadow.bias           = -0.001;
    light.shadow.radius         = shadowRadius;
    light.shadow.normalBias     = normalBias;
    return light;
  }

  const softnessBias = 0.9;
  scene.add(makeDirLight(0xF7E1B7, 1.5 - softnessBias, 1024,                        18,  0.04));
  scene.add(makeDirLight(0xF7E1B7, softnessBias,        IS_MOBILE() ? 1024 : 2048,   2,  0.01));

  // Fill
  const fill = new THREE.DirectionalLight(0xddeeff, 0.1);
  fill.position.set(0, 5, -4);
  scene.add(fill);

  // ── Post-processing ───────────────────────────────────────────────────────
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Bokeh — created here, added last
  const bokehPass = new BokehPass(scene, camera, {
    focus:   0.1,
    aperture: 0.0,
    maxblur: IS_MOBILE() ? 0.012 : 0.01,
    width:   window.innerWidth,
    height:  window.innerHeight,
  });

  composer.addPass(new ShaderPass(GammaCorrectionShader));

  const satPass = new ShaderPass(SaturationShader);
  composer.addPass(satPass);

  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.uniforms.resolution.value.set(
    1 / (window.innerWidth  * renderer.getPixelRatio()),
    1 / (window.innerHeight * renderer.getPixelRatio()),
  );
  composer.addPass(fxaaPass);

  composer.addPass(bokehPass); // last

  // ── State ─────────────────────────────────────────────────────────────────
  let flower = null;
  let mixer  = null;
  let action = null;

  // ── Resize ────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.fov    = IS_MOBILE() ? 28 : 24;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.position.setZ(IS_MOBILE() ? 12 : 11);
    renderer.setSize(w, h);
    fxaaPass.uniforms.resolution.value.set(
      1 / (w * renderer.getPixelRatio()),
      1 / (h * renderer.getPixelRatio()),
    );
  });

  // ── Clock (for wind) ─────────────────────────────────────────────────────
  const clock = new THREE.Clock();

  // ── Render loop ───────────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);

    if (!flower || !action || !mixer) return;

    const scroll   = window.lenis ? window.lenis.scroll : window.scrollY;
    const progress = Math.min(1, Math.max(0, scroll / SCROLL_RANGE()));
    const mobile   = IS_MOBILE();
    const ph       = mobile ? PHASE.mobile : PHASE.desktop;

    // phase values
    const phase1 = Math.min(1, progress / ph.p1);
    const phase2 = Math.min(1, Math.max(0, (progress - 0.5) / ph.p2));

    // eased versions
    const eased   = easeOut2(Math.min(1, Math.max(0, progress)));
    const eased1  = easeOut2(phase1);
    const eased2  = easeCubic(phase2);

    // camera
    camera.position.set(
      lerp(mobile ? 0.2 : 0.1, 0.2, eased2),
      lerp(3.8, mobile ? 1.5 : 1.6, eased2),
      lerp(11,  mobile ? 3.8 : 4.0, eased2),
    );

    // flower transform
    flower.rotation.set(
      lerp(0, 0.1, Math.min(1, eased1 * 2)),
      lerp(0, -0.2, eased2),
      -0.3,
    );
    flower.scale.setScalar(2.1);

    // post-process
    satPass.uniforms.saturation.value   = Math.min(1, lerp(0.6, 1.0, eased * 2));
    bokehPass.uniforms.aperture.value   = lerp(0, mobile ? 0.02 : 0.005, eased2);
    bokehPass.uniforms.focus.value      = lerp(11.2, 3.8, eased2);

    // animation scrub
    action.time = action.getClip().duration * Math.min(0.9999, phase1);
    mixer.update(0);

    // tick wind time
    windUniforms.uTime.value = clock.getElapsedTime();

    composer.render();
  }

  animate();

  // ── Load model ────────────────────────────────────────────────────────────
  loadGLB().then(gltf => {
    const root = gltf.scene;

    root.traverse(child => {
      if (!child.isMesh) return;
      child.castShadow    = true;
      child.receiveShadow = true;

      const mat = child.material;
      if (!mat) return;

      mat.dithering = true;
      if (mat.map) mat.map.anisotropy = 16;

      // inject wind displacement
      applyWind(mat);

      // Alpha cutout fix for petals
      const name = mat.name?.toLowerCase() ?? '';
      if (name.includes('petal') || name.includes('flower')) {
        mat.alphaTest  = 0.5;
        mat.transparent = false;
        mat.depthWrite  = true;
        mat.side        = THREE.DoubleSide;
        mat.needsUpdate = true;
      }
    });

    flower = root;
    scene.add(flower);
    canvas.style.opacity = '1';

    if (gltf.animations?.length) {
      mixer  = new THREE.AnimationMixer(flower);
      action = mixer.clipAction(gltf.animations[0]);
      action.clampWhenFinished = false;
      action.play();
      action.paused = true;
      mixer.setTime(0);
    }
  }).catch(err => console.error('[flower] load failed:', err));
}

init();