import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TextureLoader } from 'three';

// Import minimal CSS for responsiveness
const style = document.createElement('link');
style.rel = 'stylesheet';
style.href = './src/flower.css';
document.head.appendChild(style);

window.Webflow ||= [];
window.Webflow.push(() => {
  console.log('[3D] Webflow push fired');
  init3D();
});

function lerp(start, end, t) {
  return start + (end - start) * t;
}

const isMobile = () => window.innerWidth <= 640;

// Init Function
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

  // ── Renderer ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  console.log('[3D] renderer created, size:', window.innerWidth, 'x', window.innerHeight);

  // ── Scene ─────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9e2dc');

  // ── Camera ────────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(
    isMobile() ? 28 : 24,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.35, isMobile() ? 12 : 11);
  console.log('[3D] camera position:', camera.position);

  // ── Lights ────────────────────────────────────────────────────────────────
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(3, 5, 4);
  dirLight.castShadow = true;
  scene.add(dirLight);
  const pointLight = new THREE.PointLight(0xffffff, 0.3);
  pointLight.position.set(0, 2, 8);
  scene.add(pointLight);
  const spotLight = new THREE.SpotLight(0xffffff, 0.5);
  spotLight.position.set(0, 5, 10);
  spotLight.angle = 0.3;
  spotLight.penumbra = 1;
  spotLight.castShadow = true;
  scene.add(spotLight);
  // Warm fill from below-front to soften lower petal shadows
  const fillLight = new THREE.PointLight(0xffe8d0, 0.35);
  fillLight.position.set(-1, -1, 6);
  scene.add(fillLight);
  console.log('[3D] lights added');

  // ── Model state ───────────────────────────────────────────────────────────
  let mixer = null;
  let action = null;
  let flower = null;

  // ── Scroll ────────────────────────────────────────────────────────────────
  const SCROLL_RANGE_VH = 3;
  let progress = 0;

  const onScroll = () => {
    const maxScroll = window.innerHeight * SCROLL_RANGE_VH;
    progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    canvas.style.opacity = window.scrollY > maxScroll ? '0' : '1';
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

    if (flower && action && mixer) {
      const clamped = Math.min(1, Math.max(0, progress));
      const eased = 1 - (1 - clamped) * (1 - clamped);

      const mobile = isMobile();
      const scale = mobile ? lerp(1.7, 2.25, eased) : lerp(2.1, 3.35, eased);
      // Shift flower up for better visibility
      const posY = mobile ? lerp(0.5, 0.2, eased) : lerp(0.7, 0.35, eased);
      const posX = mobile ? lerp(0.08, -0.08, eased) : lerp(0, -0.2, eased);
      const rotX = lerp(0.5, 0.3, eased);
      const rotY = mobile ? lerp(-0.28, -0.08, eased) : lerp(-0.3, -0.1, eased);

      flower.position.set(posX, posY, 0);
      flower.rotation.set(rotX, rotY, -0.3);
      flower.scale.setScalar(scale);

      const duration = action.getClip().duration;
      action.time = duration * Math.min(0.9999, clamped);
      mixer.update(0);
    }

    renderer.render(scene, camera);
  }

  animate();

  // ── Load ─────────────────────────────────────────────────────────────────
  console.log('[3D] calling load()...');
  load()
    .then((data) => {
      console.log('[3D] load() resolved');
      console.log('[3D] animations:', data.animations.length);
      data.animations.forEach((clip, i) =>
        console.log(`[3D]   clip[${i}]: "${clip.name}" duration=${clip.duration}s`)
      );

      // Count meshes
      let meshCount = 0;
      data.flower.traverse((child) => {
        if (child.isMesh) meshCount++;
      });
      console.log('[3D] mesh count:', meshCount);

      // Log textures
      // Log the GLTF's own materials (we keep them as-is — MeshPhysicalMaterial)
      data.flower.traverse((child) => {
        if (child.isMesh) {
          const mat = child.material;
          console.log(
            '[3D]   mesh:',
            child.name,
            '| mat:',
            mat.type,
            '| map:',
            mat.map?.image?.width,
            '| normalMap:',
            mat.normalMap?.image?.width,
            '| transparent:',
            mat.transparent,
            '| transmission:',
            mat.transmission
          );
        }
      });
      console.log('[3D] keeping GLTF original materials (MeshPhysicalMaterial)');

      flower = data.flower;
      scene.add(flower);
      console.log('[3D] flower added to scene');

      if (data.animations && data.animations.length > 0) {
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

/* Loader Functions */
async function load() {
  const gltfUrl =
    'https://cdn.prod.website-files.com/68c45f560e661eb43d42aeb3/69962edb65c81369a5fb02cf_Flower8ExportAsGLTF%20(2).txt';
  const binUrl =
    'https://cdn.prod.website-files.com/68c45f560e661eb43d42aeb3/69962edeb4b0ae0a8d37014b_Flower8ExportAsGLTF.txt';
  const albedoUrl =
    'https://cdn.prod.website-files.com/68c45f560e661eb43d42aeb3/69962d965377c263bec5ab67_Flower%20Material%20Albedo.png';
  const albedoTransparencyUrl =
    'https://cdn.prod.website-files.com/68c45f560e661eb43d42aeb3/69962d968205bd9305ac558b_Flower%20Material%20Albedo-Flower%20Material%20Transparency.png';
  const normalUrl =
    'https://cdn.prod.website-files.com/68c45f560e661eb43d42aeb3/69962d96052ea844b99b2549_Flower%20Material%20Normal.png';

  console.log('[3D] fetching GLTF JSON...');
  const response = await fetch(gltfUrl);
  console.log('[3D] GLTF fetch status:', response.status, response.ok);
  const gltfJson = await response.json();
  console.log(
    '[3D] GLTF images in file:',
    gltfJson.images?.map((i) => i.uri)
  );
  console.log(
    '[3D] GLTF buffers:',
    gltfJson.buffers?.map((b) => ({ uri: b.uri, byteLength: b.byteLength }))
  );
  console.log(
    '[3D] GLTF materials:',
    gltfJson.materials?.map((m) => m.name)
  );

  if (gltfJson.buffers?.[0]) {
    gltfJson.buffers[0].uri = binUrl;
    console.log('[3D] buffer[0] URI patched');
  }

  if (gltfJson.images) {
    gltfJson.images.forEach((img, i) => {
      if (!img.uri) return;
      const lower = img.uri.toLowerCase();
      const before = img.uri;
      if (lower.includes('normal')) {
        img.uri = normalUrl;
      } else if (lower.includes('transparency')) {
        img.uri = albedoTransparencyUrl;
      } else {
        img.uri = albedoUrl;
      }
      console.log(
        `[3D] image[${i}]: "${before}" → ${
          img.uri === albedoUrl ? 'albedo' : img.uri === normalUrl ? 'normal' : 'albedoTransparency'
        }`
      );
    });
  }

  console.log('[3D] parsing GLTF...');
  const gltf = await new Promise((resolve, reject) => {
    modelLoader.parse(
      JSON.stringify(gltfJson),
      '',
      (g) => {
        console.log('[3D] GLTF parsed, animations:', g.animations.length);
        resolve(g);
      },
      reject
    );
  });

  console.log('[3D] loading textures...');
  const [albedo, albedoTransparency, normal] = await Promise.all([
    loadTexture(albedoUrl),
    loadTexture(albedoTransparencyUrl),
    loadTexture(normalUrl),
  ]);
  console.log('[3D] all textures loaded');

  return { flower: gltf.scene, animations: gltf.animations, albedo, albedoTransparency, normal };
}

const textureLoader = new TextureLoader();
const modelLoader = new GLTFLoader();

function loadTexture(url) {
  return new Promise((resolve) => {
    textureLoader.load(
      url,
      (data) => {
        data.needsUpdate = true;
        data.flipY = false;
        console.log(
          '[3D] texture loaded:',
          url.split('/').pop(),
          '|',
          data.image?.width,
          'x',
          data.image?.height
        );
        resolve(data);
      },
      undefined,
      (err) => console.error('[3D] texture failed:', url, err)
    );
  });
}
