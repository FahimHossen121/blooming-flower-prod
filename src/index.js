import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';

// ── Saturation Shader ─────────────────────────────────────────────────────
const SaturationShader = {
  uniforms: {
    tDiffuse:   { value: null },
    saturation: { value: 1 }, // 0 = grayscale, 1 = normal, 1.2 = slightly boosted
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float grey = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      color.rgb = mix(vec3(grey), color.rgb, saturation);
      gl_FragColor = color;
    }
  `,
};

// ── Asset Base URL ────────────────────────────────────────────────────────
const ASSET_BASE_URL = 'https://cdn.prod.website-files.com/699633088760d3ad60ae151a/';
const GLB_FILE = '699f31a05813f4691398f3b7_Flower15.optimized.glb.txt';

// // Import minimal CSS for responsiveness
// const style = document.createElement('link');
// style.rel = 'stylesheet';
// style.href = './src/flower.css';
// document.head.appendChild(style);

// ── Loaders ───────────────────────────────────────────────────────────────
const modelLoader = new GLTFLoader();
modelLoader.setMeshoptDecoder(MeshoptDecoder);
console.log('[3D] GLTFLoader created with MeshoptDecoder');

window.Webflow ||= [];
window.Webflow.push(() => {
  console.log('[3D] Webflow push fired');
  init3D();
});

function lerp(start, end, t) {
  return start + (end - start) * t;
}

const isMobile = () => window.innerWidth <= 640;

// ── Init Function ─────────────────────────────────────────────────────────
function init3D() {
  console.log('[3D] init3D start');
  const container = document.querySelector('[data-3d="c"]') || document.body;
  console.log('[3D] container:', container.tagName, container.id || '(no id)');

  const canvas = document.createElement('canvas');
  canvas.id = 'flower-canvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: '10',
    pointerEvents: 'none',
    transition: 'opacity 0.4s ease',
  });
  container.appendChild(canvas);
  console.log('[3D] canvas appended');

  // Add this inside init3D(), after the canvas is appended:
  const scrollSpacer = document.createElement('div');
  Object.assign(scrollSpacer.style, {
    position: 'relative',
    width: '100%',
    height: '400vh', // make the page this much taller — adjust to taste
    pointerEvents: 'none',
    zIndex: '-1',
  });
  document.body.appendChild(scrollSpacer);

  // ── Renderer (REPLACED) ───────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: true, 
    alpha: false,
    powerPreference: "high-performance" 
  }); 
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // This is the "Blender AgX" equivalent
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping; 
  renderer.toneMappingExposure = 0.9; 

  // Soft shadow settings
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  // ── Scene ─────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#aca69e');

  // ── Camera ────────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(
    isMobile() ? 28 : 21,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 3, 0);
  camera.rotateX(-0.3);
  // camera.lookAt(0.001,0.00,0.00);
  // Store the initial camera position
  const initialCamPos = camera.position.clone();
  console.log('[3D] camera position:', camera.position);

  // ── Lights─────────────────────────────────────────────────────
  const ambientLight = new THREE.AmbientLight(0x2c7ce6, 0.3); 
  scene.add(ambientLight);

  const softnessBias = 1.8;
  x = softnessBias;

  const mainLightPos = new THREE.Vector3(-15, 20, 15);

  const mainLight = new THREE.DirectionalLight(0xf1f7b7, 3-x);
  mainLight.position.set(mainLightPos.x, mainLightPos.y, mainLightPos.z);
  mainLight.castShadow = true;

  const mainLight2 = new THREE.DirectionalLight(0xf1f7b7, x);
  mainLight2.position.set(mainLightPos.x, mainLightPos.y, mainLightPos.z);
  mainLight2.castShadow = true;

  // High-quality shadow resolution
  mainLight.shadow.mapSize.width = 1024; 
  mainLight.shadow.mapSize.height = 1024;

  mainLight2.shadow.mapSize.width = 2048; 
  mainLight2.shadow.mapSize.height = 2048;
  
  const d = 5;
  mainLight.shadow.camera.left = -d;
  mainLight.shadow.camera.right = d;
  mainLight.shadow.camera.top = d;
  mainLight.shadow.camera.bottom = -d;
  mainLight.shadow.camera.near = 0.1;
  mainLight.shadow.camera.far = 40;

  mainLight.shadow.bias = -0.001; 

  mainLight2.shadow.camera.left = -d;
  mainLight2.shadow.camera.right = d;
  mainLight2.shadow.camera.top = d;
  mainLight2.shadow.camera.bottom = -d;
  mainLight2.shadow.camera.near = 0.1;
  mainLight2.shadow.camera.far = 40;

  mainLight2.shadow.bias = -0.001; 

  mainLight.shadow.radius = 18;
  mainLight2.shadow.radius = 2;

  mainLight.shadow.normalBias = 0.04; 
  mainLight2.shadow.normalBias = 0.01;

  scene.add(mainLight);
  scene.add(mainLight2);

  // The "Fill" light (Softens the dark side of the flower)
  const fillLight = new THREE.DirectionalLight(0xddeeff, 0.1);
  fillLight.position.set(0, 5, -4);
  scene.add(fillLight);

  // ── Post-Processing Setup ────────────────────────────────────────────────
  const composer = new EffectComposer(renderer);

  // 1. Basic Render Pass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 2. Depth of Field Pass (The "Focus")
  const bokehPass = new BokehPass(scene, camera, {
    focus: 0.1,      // Distance to focus on
    aperture: 0.0, // Blur strength (keep this very low for "performant" look)
    maxblur: 0.01,   // Maximum blur amount
    width: window.innerWidth,
    height: window.innerHeight
  });

  // 3. Gamma Correction (Essential for AgX to look right)
  composer.addPass(new ShaderPass(GammaCorrectionShader));


  const saturationPass = new ShaderPass(SaturationShader);
  composer.addPass(saturationPass);


  // 4. FXAA (This fixes the jagged stamen)
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.uniforms['resolution'].value.set(1 / (window.innerWidth * renderer.getPixelRatio()), 1 / (window.innerHeight * renderer.getPixelRatio()));
  composer.addPass(fxaaPass);

  // Optimization: Disable DoF on mobile if it lags
  if (!isMobile()) {
    composer.addPass(bokehPass);
  }

  // ── Model state ───────────────────────────────────────────────────────────
  let mixer = null;
  let action = null;
  let flower = null;
  

  // ── Scroll ────────────────────────────────────────────────────────────────
  // const SCROLL_RANGE_VH = 4;
  let progress = 0;
  let targetProgress = 0; // add this

  // const onScroll = () => {
  //   const maxScroll = window.innerHeight * SCROLL_RANGE_VH;
  //   targetProgress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
  //   canvas.style.opacity = window.scrollY > maxScroll ? '0' : '1';
  // };

  const onScroll = () => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  targetProgress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
  canvas.style.opacity = '1';
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── Resize ────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.fov = isMobile() ? 28 : 24;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    camera.position.setZ(isMobile() ? 12 : 11);
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Render loop ───────────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);

    progress = lerp(progress, targetProgress, 0.08); // Smoothly interpolate towards targetProgress
    

    if (flower && action && mixer) {
      const clamped = Math.min(1, Math.max(0, progress));
      const eased = 1 - (1 - clamped) * (1 - clamped);

      // Split progress into two phases
      const phase1 = Math.min(1.0, progress * 1.5);        // 0→1 during first half
      const phase2 = Math.min(1.0, Math.max(0.0, (progress - 0.5) * 2.5)); // 0→1 during second half
      const eased1 = 1 - (1 - phase1) * (1 - phase1);
      // const eased2 = phase2 * phase2 * (1 - phase2); // Strong ease for second phase
      const eased2 = phase2 < 0.5
      ? 4 * phase2 * phase2 * phase2
      : 1 - Math.pow(-2 * phase2 + 2, 3) / 2;

      const mobile = isMobile();
      // const scale = mobile ? lerp(1.7, 2.25, eased2) : lerp(2.1, 5, eased2);
      const posY  = mobile ? lerp(0.5, 0.2, eased1)  : lerp(0.7, 0.35, eased1);
      const posX  = mobile ? lerp(0.08, -0.08, eased1) : lerp(0, -0.2, eased1);
      const rotX  = lerp(0, 0.1, Math.min(1.0, eased1*2));
      const rotY  = lerp(0, -0.2 , eased2);

      const camZ = mobile ? lerp(12, 6, eased2) : lerp(11, 4, eased2);
      camera.position.setZ(camZ);
      const camY = mobile ? lerp(4, 4, eased2) : lerp(3.8, 1.6, eased2);
      camera.position.setY(camY);
      const camX = mobile ? lerp(0, 0, eased2) : lerp(0.1, 0.2, eased2);
      camera.position.setX(camX);
      
      
   

      // flower.position.set(posX, posY, 0);
      flower.rotation.set(rotX, rotY, -0.3);
      flower.scale.setScalar(2.1);

      // Inside animate(), alongside the other lerped values:
      const saturation = lerp(0.6, 1.0, eased * 2); // reaches 1.0 at progress = 0.5
      saturationPass.uniforms['saturation'].value = Math.min(1.0, saturation);
      const aperture = lerp(0.00, 0.005, eased2);
      bokehPass.uniforms['aperture'].value = aperture;
      bokehPass.uniforms['focus'].value = (lerp(11.2, 3.8, eased2)); // Pull focus closer as we bloom

      const duration = action.getClip().duration;
      action.time = duration * Math.min(0.9999, phase1);
      mixer.update(0);
    }

  // renderer.render(scene, camera);
      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera); // Fallback in case composer isn't ready
      }
    }

  animate();

  // ── Load ──────────────────────────────────────────────────────────────────
  console.log('[3D] calling load()...');
  load()
    .then((data) => {
      console.log('[3D] load() resolved');
      console.log('[3D] animations:', data.animations.length);
      data.animations.forEach((clip, i) =>
        console.log(`[3D]   clip[${i}]: "${clip.name}" duration=${clip.duration}s`)
      );

      // Log meshes and their material state
      data.flower.traverse((child) => {
        if (!child.isMesh) return;

        child.castShadow = true;
        child.receiveShadow = true; 

        if (child.material) {
        child.material.dithering = true; // Helps with color banding
        }
        // Improves texture sharpness at angles
        if (child.material.map) child.material.map.anisotropy = 16;

        const mat = child.material;
        console.log(
          '[3D]   mesh:', child.name,
          '| mat:', mat.type,
          '| map:', mat.map ? '✓' : 'undefined',
          '| normalMap:', mat.normalMap ? '✓' : 'undefined',
          '| transparent:', mat.transparent,
          '| transmission:', mat.transmission
        );

        // Fix alpha cutout for petal/flower materials
        // The GLB materials are kept as-is; we only patch transparency rendering
        const matName = mat.name?.toLowerCase() ?? '';
        if (matName.includes('petal') || matName.includes('flower')) {
          mat.alphaTest   = 0.5;
          mat.transparent = false;
          mat.depthWrite  = true;
          mat.side        = THREE.DoubleSide;

          mat.needsUpdate = true;
          console.log('[3D] alpha clip applied to:', child.name);
        }
      });

      flower = data.flower;
      scene.add(flower);
      console.log('[3D] flower added to scene');

      if (data.animations?.length > 0) {
        mixer = new THREE.AnimationMixer(flower);
        action = mixer.clipAction(data.animations[0]);
        action.clampWhenFinished = false;
        action.play();
        action.paused = true;
        mixer.setTime(0);
        console.log('[3D] animation ready, duration:', action.getClip().duration, 's');
      } else {
        console.warn('[3D] No animations found');
      }
    })
    .catch((err) => console.error('[3D] load() failed:', err));
}


async function load() {
  const glbUrl = ASSET_BASE_URL + GLB_FILE;

  console.log('[3D] fetching GLB:', glbUrl);
  const response = await fetch(glbUrl);
  console.log('[3D] GLB fetch status:', response.status, response.ok);

  if (!response.ok) throw new Error(`Failed to fetch GLB: ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  console.log('[3D] GLB arrayBuffer size:', arrayBuffer.byteLength, 'bytes');

  const gltf = await new Promise((resolve, reject) => {
    modelLoader.parse(arrayBuffer, '', resolve, reject);
  });

  console.log('[3D] GLB parsed, animations:', gltf.animations.length);
  return { flower: gltf.scene, animations: gltf.animations };
}