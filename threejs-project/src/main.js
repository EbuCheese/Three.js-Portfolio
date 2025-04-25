import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { gsap } from 'gsap';
import { TextureLoader } from 'three';

let scene, camera, renderer, composer, cube;
let isPopupActive = false;
let isDragging = false;
let startX = 0;
let startY = 0;
let currentFaceIndex = 0;
let targetRotation = { x: 0, y: 3.89 };
let easing = 0.1;
let bloomPass;

const loader = new THREE.TextureLoader();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// project data array
const projects = [
  { image: '/dogmeditate.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project1', name: 'Youtube Clip Discord Bot' },
  { image: '/fish.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project2' },
  { image: '/catcreeper.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project3' },
  { image: '/DD.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project4' },
  { image: '/lego-sleep.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project5' },
  { image: '/lime.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project6' }
];

// Shuffle and assign 6 random projects
const shuffled = projects.sort(() => 0.5 - Math.random()).slice(0, 6);

// Function to create a material with high-quality texture
async function createMaterial(imagePath) {
  const texture = await loader.loadAsync(imagePath);
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;

  // texture mapping
  return new THREE.MeshStandardMaterial({
    map: texture,
    metalness: 0.95,
    roughness: 0.15,
    envMapIntensity: 1.2,
    transparent: true,
    opacity: 0,
  });
}

export function setSceneBackground(imagePath, scene) {
  loader.load(imagePath, texture => {
    scene.background = texture;
  });
}

const bgSelector = document.getElementById('bg-selector');
bgSelector.addEventListener('change', (e) => {
  const selectedValue = e.target.value;
  loader.load(selectedValue, texture => {
    scene.background = texture;
  });
});


// Gradient BG
function generateRadialGradient() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(256, 256, 50, 256, 256, 256);
  gradient.addColorStop(0, '#2200aa');
  gradient.addColorStop(1, '#000000');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas;
}


init();

// Helper to load HDR as a Promise
function loadHDR(path) {
  return new Promise((resolve) => {
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load(path, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      resolve(texture);
    });
  });
}

let materials = [];


// Load everything before starting the scene
Promise.all([
  loadHDR('/test2.hdr'),
  Promise.all(shuffled.map(p => createMaterial(p.image)))
]).then(([hdrTexture, loadedMaterials]) => {
  // Set the HDR environment and background
  scene.environment = hdrTexture;
  // scene.background = backgroundTexture;

  const bgSelector = document.getElementById('bg-selector');
  const defaultBg = bgSelector.value;

  loader.load(defaultBg, texture => {
    scene.background = texture;
  });

  materials = loadedMaterials;

  // Create the cube with loaded materials
  cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials);

  // Glowing outline
  const outlineShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0x00ffff) },
      glowIntensity: { value: 4 },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float glowIntensity;
      varying vec3 vPosition;
  
      void main() {
        float intensity = glowIntensity / length(vPosition);
        gl_FragColor = vec4(glowColor * intensity, 1.03);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });

  const outlineMesh = new THREE.Mesh(cube.geometry.clone(), outlineShaderMaterial);
  outlineMesh.scale.multiplyScalar(1.02);
  cube.add(outlineMesh);

  // Set materials initially invisible
  materials.forEach(mat => {
    mat.transparent = true;
    mat.opacity = 0;
  });

  scene.add(cube);
  
  // Optional: Smooth exposure fade-in for background
  const fade = { val: 0 };
  renderer.toneMappingExposure = 0;
  gsap.to(fade, {
    val: 1.2,
    duration: 1.2,
    ease: "power2.out",
    delay: 0.1,
    onUpdate: () => {
      renderer.toneMappingExposure = fade.val;
    }
  });

  // Fade in cube materials
  materials.forEach(mat => {
    gsap.to(mat, {
      opacity: 1,
      duration: 1.2,
      ease: "power2.out",
      delay: 0.1
    });
  });

  updateLink(0); // Start with front face

  // Fade out loading screen
  document.getElementById('loading-screen').classList.add('loaded');

  cube.rotation.x = targetRotation.x;
  cube.rotation.y = targetRotation.y;

  animate();

});

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 2.5;
  camera.layers.enable(0);
  camera.layers.enable(1);

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;


  // add light if needed
  // const light = new THREE.DirectionalLight(0xffffff, 0.6);
  // light.position.set(5, 5, 5);
  // scene.add(light);

  // const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  // scene.add(ambient);


  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);


  // === POSTPROCESSING ===
  const renderPass = new RenderPass(scene, camera);

    bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.2, // strength
    0.2, // radius
    0.1 // threshold
  );

  composer = new EffectComposer(renderer);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);

  // EVENTS //

  // Click Event
  window.addEventListener('dblclick', onDoubleClick);

  // Mouse controls
  window.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    snapRotation();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    targetRotation.y += deltaX * 0.005;
    targetRotation.x += deltaY * 0.005;

    startX = e.clientX;
    startY = e.clientY;
  });

  // Touch controls
  window.addEventListener('touchstart', (e) => {
    isDragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  });

  window.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const deltaX = e.touches[0].clientX - startX;
    const deltaY = e.touches[0].clientY - startY;

    targetRotation.y += deltaX * 0.005;
    targetRotation.x += deltaY * 0.005;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  });

  window.addEventListener('touchend', () => {
    isDragging = false;
    snapRotation();
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function snapRotation() {
  const snappedX = Math.round(targetRotation.x / (Math.PI / 2)) * (Math.PI / 2);
  const snappedY = Math.round(targetRotation.y / (Math.PI / 2)) * (Math.PI / 2);
  targetRotation.x = snappedX;
  targetRotation.y = snappedY;

  const newFaceIndex = getFrontFaceIndex(snappedX, snappedY);

  if (popupPlane && currentFaceIndex !== newFaceIndex) {
    // Close popup if we snapped to a new face
    cube.remove(popupPlane);
    cube.remove(borderPlane);
    cube.remove(shadowPlane);
    popupPlane = null;
    borderPlane = null;
    shadowPlane = null;
    isPopupActive = false;
  }

  currentFaceIndex = getFrontFaceIndex(snappedX, snappedY);
  updateLink(currentFaceIndex);
}

function getFrontFaceIndex(rotX, rotY) {
  const x = ((Math.round(rotX / (Math.PI / 2)) % 4) + 4) % 4;
  const y = ((Math.round(rotY / (Math.PI / 2)) % 4) + 4) % 4;

  // Face order: 
  // 0: right, 1: left, 2: top, 3: bottom, 4: front, 5: back
  if (x === 1) return 2; // top
  if (x === 3) return 3; // bottom
  if (y === 0) return 4; // front
  if (y === 1) return 0; // right
  if (y === 2) return 5; // back
  if (y === 3) return 1; // left
}


function updateLink(faceIndex) {

  // remove previous popup if face does not match
  if (popupPlane && currentFaceIndex !== faceIndex) {
    scene.remove(popupPlane); // make sure it's removed from the right parent
    popupPlane = null;
  }

  const project = shuffled[faceIndex];
  const linkEl = document.getElementById('link-btn');
  if (project && linkEl) {
    linkEl.href = project.link;
    linkEl.textContent = `View Repo: ${project.name}`; // add github svg?
  }
}

// Click Func

function onDoubleClick(event) {
  if (isDragging) return; // don't trigger on drag

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(cube, false);

  if (intersects.length > 0) {
    const faceIndex = Math.floor(intersects[0].faceIndex / 2);
    showPopupPlane(faceIndex);
  }
}

// Popup Plane Func

let popupPlane, borderPlane, shadowPlane;

const popupWidth = 2;
const popupHeight = 1;
const borderThickness = 0.04; // or however thick you want it

const popupGeometry = new THREE.PlaneGeometry(popupWidth, popupHeight, 4, 4);
const borderGeometry = new THREE.PlaneGeometry(popupWidth + borderThickness, popupHeight + borderThickness, 4, 4);
const shadowGeometry = new THREE.PlaneGeometry(popupWidth + 0.1, popupHeight + 0.1, 4, 4);

const glowPlaneMaterial = new THREE.ShaderMaterial({
  uniforms: {
    glowColor: { value: new THREE.Color(0x00ffff) },
    glowIntensity: { value: 4 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 glowColor;
    uniform float glowIntensity;
    varying vec2 vUv;

    void main() {
      float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      float intensity = clamp(edgeDist * glowIntensity, 0.0, 1.0);
      float alpha = 1.0 - intensity;
      gl_FragColor = vec4(glowColor * alpha * 5.0, alpha); // adjust for brighter / more glow
    }
  `,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false
});




function showPopupPlane(faceIndex) {
  if (popupPlane) {
    bloomPass.strength = 0.2;

    gsap.to([popupPlane.scale, borderPlane.scale, shadowPlane.scale], {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.4,
      ease: "back.in(1.7)"
    });

    gsap.to(popupPlane.material, {
      opacity: 0,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => {
        cube.remove(popupPlane);
        cube.remove(borderPlane);
        cube.remove(shadowPlane);
        popupPlane = null;
        borderPlane = null;
        shadowPlane = null;
        isPopupActive = false;
      }
    });

    return;
  }

  const offset = 0.61;

  const positions = [
    [offset, 0, 0], [-offset, 0, 0],
    [0, offset, 0], [0, -offset, 0],
    [0, 0, offset], [0, 0, -offset]
  ];
  const rotation = [
    [0, Math.PI / 2, 0], [0, -Math.PI / 2, 0],
    [-Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0],
    [0, 0, 0], [0, Math.PI, 0]
  ];

  const pos = positions[faceIndex];
  const rot = rotation[faceIndex];

  const project = shuffled[faceIndex];
  let material;

  if (project.video) {
    const video = document.createElement('video');
    video.src = project.video;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.crossOrigin = 'anonymous';
    video.load();
    video.play().catch(e => console.warn("Video failed:", e));

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0
    });
  } else {
    material = new THREE.MeshBasicMaterial({
      map: materials[faceIndex].map,
      transparent: true,
      opacity: 0,
      toneMapped: false
    });
  }

  // --- POPUP PLANE
  popupPlane = new THREE.Mesh(
    popupGeometry,
    material
  );
  popupPlane.position.set(...pos);
  popupPlane.rotation.set(...rot);
  popupPlane.scale.set(0, 0, 0);
  popupPlane.renderOrder = 999;
  popupPlane.material.depthWrite = false;
  popupPlane.material.depthTest = false;

  popupPlane.material.polygonOffset = true;
  popupPlane.material.polygonOffsetFactor = -1;
  popupPlane.material.polygonOffsetUnits = -4;

  // --- BORDER PLANE
  borderPlane = new THREE.Mesh(
    borderGeometry,
    glowPlaneMaterial
  );
  borderPlane.position.set(...pos);
  borderPlane.rotation.set(...rot);
  borderPlane.scale.set(0, 0, 0);
  borderPlane.translateZ(-0.008); // just behind popupPlane
  borderPlane.renderOrder = 998;


  // --- SHADOW PLANE 
  shadowPlane = new THREE.Mesh(
    shadowGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35 
    })
  );
  shadowPlane.position.set(...pos);
  shadowPlane.rotation.set(...rot);
  shadowPlane.scale.set(0, 0, 0);
  shadowPlane.translateZ(-0.015); // Further behind
  shadowPlane.renderOrder = 997;

  cube.add(shadowPlane);
  cube.add(borderPlane);
  cube.add(popupPlane);

  bloomPass.strength = 0.12;

  gsap.to([popupPlane.scale, borderPlane.scale, shadowPlane.scale], {
    x: 1,
    y: 1,
    z: 1,
    duration: 0.6,
    ease: "back.out(1.7)",
    onComplete: () => {
      isPopupActive = true;
    }
  });

  gsap.to(popupPlane.material, {
    opacity: 1,
    duration: 0.5,
    ease: "power2.out"
  });
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  if (!cube) return;

  const time = clock.getElapsedTime();
  const phaseDuration = 4;       // Time to complete 1 full wave (e.g., up-down-up)
  const pauseDuration = 0.25;       // Pause at center
  const cycleDuration = (phaseDuration + pauseDuration) * 2; // Total cycle time

  const t = time % cycleDuration;
  const amplitude = 0.03;

  // Helper: clean sine wave cycle
  function sineCycle(t) {
    return Math.sin(t * Math.PI * 2); // Starts and ends at 0
  }

  // Only animate if popup is not visible
  if (!popupPlane) {
    const t = time % cycleDuration;

    // Reset positions
    cube.position.x = 0;
    cube.position.y = 0;

    if (t < phaseDuration) {
      // Phase 1: up-down-up (Y axis)
      const progress = t / phaseDuration;
      cube.position.y = sineCycle(progress) * amplitude;
    } else if (t < phaseDuration + pauseDuration) {
      // Phase 2: pause in center (Y axis)
      cube.position.y = 0;
    } else if (t < 2 * phaseDuration + pauseDuration) {
      // Phase 3: left-right-left (X axis)
      const progress = (t - phaseDuration - pauseDuration) / phaseDuration;
      cube.position.x = sineCycle(progress) * amplitude;
    } else {
      // Phase 4: pause in center (X axis)
      cube.position.x = 0;
    }
    } else {
      // Optional: Reset position when popup is shown
      cube.position.x = 0;
      cube.position.y = 0;
    }

    
    // smooth rotation logic 
    cube.rotation.x += (targetRotation.x - cube.rotation.x) * easing;
    cube.rotation.y += (targetRotation.y - cube.rotation.y) * easing;
    
    // render 
    composer.render();

    
}


