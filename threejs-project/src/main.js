import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { gsap } from 'gsap';


let scene, camera, renderer, composer, cube;
let isDragging = false;
let startX = 0;
let startY = 0;
let currentFaceIndex = 0;
let targetRotation = { x: 0, y: 3.89 };
let easing = 0.1;

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
  });
}

init();

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

// set the texture for env and bg
const rgbeLoader = new RGBELoader();
rgbeLoader.load('/test2.hdr', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture; 
  scene.background = texture; 
});


let materials = [];
Promise.all(shuffled.map(p => createMaterial(p.image))).then((loadedMaterials) => {
  materials = loadedMaterials;
  // Create the base cube
  cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials);

  // Add glowing edges using a slightly bigger outline cube with emissive material
  const outlineShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0x00ffff) },
      glowIntensity: { value: 4 }, // Control the intensity of the glow
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position; // Capture the position for later use
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float glowIntensity;
      varying vec3 vPosition;
  
      void main() {
        // Apply glow effect equally across all edges
        float intensity = glowIntensity / length(vPosition); // More glow for edges further from the center
        gl_FragColor = vec4(glowColor * intensity, 1.03);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });
  
  // Create outline mesh
  const outlineMesh = new THREE.Mesh(cube.geometry.clone(), outlineShaderMaterial);
  outlineMesh.scale.multiplyScalar(1.02); // Scale slightly to make outline glow bigger
  cube.add(outlineMesh);

  // BG FX

  // const gradientBG = new THREE.CanvasTexture(generateRadialGradient());
  // scene.background = gradientBG;

  
  materials.forEach(mat => {
    mat.transparent = true;
    mat.opacity = 0;
  });

  scene.add(cube);

  materials.forEach(mat => {
    gsap.to(mat, {
      opacity: 1,
      duration: 1.2,
      ease: "power2.out",
      delay: 0.1
    });
  });

  updateLink(0); // Start with front face (index 4 in Three.js)
  
  // Finished Loading Logic
  document.getElementById('loading-screen').classList.add('loaded');
  animate();
});


function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 2.5;

  renderer = new THREE.WebGLRenderer({ antialias: true });

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
  renderer.setPixelRatio(window.devicePixelRatio); // important!
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // Prevent color distortion
  document.body.appendChild(renderer.domElement);


  // === POSTPROCESSING ===
  const renderPass = new RenderPass(scene, camera);

  const bloomPass = new UnrealBloomPass(
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

// function snapRotation() {
//   const snappedX = Math.round(targetRotation.x / (Math.PI / 2)) * (Math.PI / 2);
//   const snappedY = Math.round(targetRotation.y / (Math.PI / 2)) * (Math.PI / 2);
//   targetRotation.x = snappedX;
//   targetRotation.y = snappedY;

//   currentFaceIndex = getFrontFaceIndex(snappedX, snappedY);
//   updateLink(currentFaceIndex);
// }

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

let popupPlane;

function showPopupPlane(faceIndex) {
  if (popupPlane) {
    // Animate scale down and fade out before removing
    gsap.to(popupPlane.scale, {
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
        popupPlane = null;
      }
    });
  
    return;
  }

  const popupWidth = 1.8;
  const popupHeight = 1;
  const geometry = new THREE.PlaneGeometry(popupWidth, popupHeight);

  // create video material
  let material;
  const project = shuffled[faceIndex];

  if (project.video) {
    const popupVideo = document.createElement('video');
    popupVideo.src = project.video;
    popupVideo.loop = true;
    popupVideo.muted = true;
    popupVideo.playsInline = true;
    popupVideo.autoplay = true;
    popupVideo.crossOrigin = 'anonymous';
    popupVideo.load();
    popupVideo.play().catch(e => console.warn('Autoplay failed:', e));

    const popupVideoTexture = new THREE.VideoTexture(popupVideo);
    popupVideoTexture.colorSpace = THREE.SRGBColorSpace;
    popupVideoTexture.minFilter = THREE.LinearFilter;
    popupVideoTexture.magFilter = THREE.LinearFilter;
    popupVideoTexture.generateMipmaps = false;

    material = new THREE.MeshBasicMaterial({ map: popupVideoTexture });
  } else {
    material = new THREE.MeshBasicMaterial({ map: materials[faceIndex].map });
  }

  material.transparent = true;
  material.opacity = 0;


  popupPlane = new THREE.Mesh(geometry, material);


  // Position popup in front of the clicked face
  const offset = 0.61; // slightly in front of cube
  
  const positions = [
    [offset, 0, 0],     // right
    [-offset, 0, 0],    // left
    [0, offset, 0],     // top
    [0, -offset, 0],    // bottom
    [0, 0, offset],     // front
    [0, 0, -offset]     // back
  ];
  const rotation = [
    [0, Math.PI / 2, 0],
    [0, -Math.PI / 2, 0],
    [-Math.PI / 2, 0, 0],
    [Math.PI / 2, 0, 0],
    [0, 0, 0],
    [0, Math.PI, 0],
  ];

  // Start at scale 0
  popupPlane.scale.set(0, 0, 0);

  popupPlane.position.set(...positions[faceIndex]);
  popupPlane.rotation.set(...rotation[faceIndex]);

  cube.add(popupPlane);

  // animate the plane popup
  gsap.to(popupPlane.scale, {
    x: 1,
    y: 1,
    z: 1,
    duration: 0.6,
    ease: "back.out(1.7)"
  });

  gsap.to(material, {
    opacity: 1,
    duration: 0.5,
    ease: "power2.out"
  });

  
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  
  

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

  
  // smooth rotation logic 
  cube.rotation.x += (targetRotation.x - cube.rotation.x) * easing;
  cube.rotation.y += (targetRotation.y - cube.rotation.y) * easing;
  
  // render
  composer.render();
  // boost hdr realism
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
}
