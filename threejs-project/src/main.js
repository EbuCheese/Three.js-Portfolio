import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { gsap } from 'gsap';
import { TextureLoader } from 'three';

const CUBE_FACES = {
  RIGHT: 0,  // +X
  LEFT: 1,   // -X
  TOP: 2,    // +Y
  BOTTOM: 3, // -Y
  FRONT: 4,  // +Z
  BACK: 5    // -Z
};

let scene, camera, renderer, composer, cube;
let isPopupActive = false;
let hasShownClickHint = false;
let isDragging = false;
let startX = 0;
let startY = 0;
let currentFaceIndex = 0;
let targetRotation = { x: 0, y: 3.89 };
let easing = 0.1;
let bloomPass;
let openedFaceIndex = null;  // Global opened face

const loader = new THREE.TextureLoader();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// create custom cursor
const cursor = document.createElement('div');
cursor.id = 'custom-cursor';
document.body.appendChild(cursor);

// when cursor hovers a clickable elem
document.querySelectorAll('a, button, .clickable').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursor.classList.add('hovering');
    cursor.style.transform = 'translate(-50%, -50%) scale(1.3)';
    cursor.style.boxShadow = '0 0 20px #00ffff, 0 0 40px rgba(0, 255, 255, 0.8)';
  });
  
  el.addEventListener('mouseleave', () => {
    cursor.classList.remove('hovering');
    cursor.style.transform = 'translate(-50%, -50%) scale(1)';
    cursor.style.boxShadow = '0 0 12px #00ffff, 0 0 24px rgba(0, 255, 255, 0.5)';
  });
});


// get help button elems
const helpButton = document.getElementById('help-button');
const helpPanel = document.getElementById('help-panel');

// show help info on click
helpButton.addEventListener('click', () => {
  helpPanel.classList.toggle('show');
});

// function to ignore the UI elements
function isClickOnUI(event) {
  const ignoredElements = ['bg-selector', 'help-button', 'help-panel', 'link-btn', 'click-hint', 'scroll-hint'];
  return ignoredElements.some(id => {
    const el = document.getElementById(id);
    return el && (el.contains(event.target) || event.target === el);
  });
}

// project data array
const projects = [
  { image: '/fish.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project2', name: 'Right (+X)' },
  { image: '/dogmeditate.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project1', name: 'Left (-X)' },
  { image: '/catcreeper.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project3', name: 'Top (+Y)' },
  { image: '/DD.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project4', name: 'Bottom (-Y)' },
  { image: '/lego-sleep.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project5', name: 'Front (+Z)' },
  { image: '/lime.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project6', name: 'Back (-Z)' }
];

// Shuffle and assign 6 random projects
const shuffled = [...projects].sort(() => 0.5 - Math.random());
console.log(shuffled);

const orderedShuffled = [
  shuffled[1], // right -> shuffled[1] (not 0!)
  shuffled[0], // left -> shuffled[0]
  shuffled[2], // top
  shuffled[3], // bottom
  shuffled[4], // front
  shuffled[5], // back
];

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


init();


let materials = [];
// Load everything before starting the scene
Promise.all([
  loadHDR('/test2.hdr'),
  Promise.all(orderedShuffled.map(p => createMaterial(p.image)))
]).then(([hdrTexture, loadedMaterials]) => {
  // Set the HDR environment
  scene.environment = hdrTexture;
  
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

  updateLink(1);
  // Fade out loading screen
  document.getElementById('loading-screen').classList.add('loaded');
  animate();

});

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 2.5;

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

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
    if (isClickOnUI(e)) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
  });

  window.addEventListener('mouseup', (e) => {
    if (isDragging) {
      isDragging = false;
      if (!isClickOnUI(e)) {
        snapRotation();
      }
    }
  });

  window.addEventListener('mousemove', (e) => {

    cursor.style.top = `${e.clientY}px`;
    cursor.style.left = `${e.clientX}px`;

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
    if (isClickOnUI(e)) return;
    isDragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  });

  window.addEventListener('touchmove', (e) => {
    if (isClickOnUI(e)) return;
    if (!isDragging) return;
    const deltaX = e.touches[0].clientX - startX;
    const deltaY = e.touches[0].clientY - startY;

    targetRotation.y += deltaX * 0.005;
    targetRotation.x += deltaY * 0.005;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  });

  window.addEventListener('touchend', () => {
    if (isClickOnUI(e)) return;
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
    // Close popup if snapped to a new face
    cube.remove(popupPlane);
    cube.remove(borderPlane);
    cube.remove(shadowPlane);
    popupPlane = null;
    borderPlane = null;
    shadowPlane = null;
    isPopupActive = false;
  }

  // logic to show hints for cube interaction
  if (!hasShownClickHint) {
    const clickHint = document.getElementById('click-hint');
    const dragHint = document.getElementById('scroll-hint');

    clickHint.style.display = 'flex';
    clickHint.style.animation = 'floatFade 5s ease-out forwards';

    if (dragHint) {
      dragHint.classList.add('fade-out');
    }

    hasShownClickHint = true;
  }

  currentFaceIndex = getFrontFaceIndex(snappedX, snappedY);
  updateLink(currentFaceIndex);

  console.log('SnapRotation(); Called - Snapped to new face:', {
    face: newFaceIndex,
    faceName: ["RIGHT", "LEFT", "TOP", "BOTTOM", "FRONT", "BACK"][newFaceIndex],
    project: shuffled[newFaceIndex]
  });
}

function getFrontFaceIndex(rotX, rotY) {
  // Normalize rotations to 0-3 range (representing 0, 90, 180, 270 degrees)
  const normalizedX = ((Math.round(rotX / (Math.PI / 2)) % 4) + 4) % 4;
  const normalizedY = ((Math.round(rotY / (Math.PI / 2)) % 4) + 4) % 4;
  
  
  console.log('Rotation debug:', {
    rawX: rotX, 
    rawY: rotY, 
    normalizedX, 
    normalizedY
  });

  // Standard cube mapping logic
  if (normalizedX === 1) return CUBE_FACES.TOP;    // Top face
  if (normalizedX === 3) return CUBE_FACES.BOTTOM; // Bottom face
  
  // Handle front/back/left/right based on Y rotation
  if (normalizedX === 0 || normalizedX === 2) {
    // Y-rotation determines which of the side faces we see
    if (normalizedY === 0) return CUBE_FACES.FRONT; // Front
    if (normalizedY === 1) return CUBE_FACES.RIGHT; // Right
    if (normalizedY === 2) return CUBE_FACES.BACK;  // Back
    if (normalizedY === 3) return CUBE_FACES.LEFT;  // Left
  }
  
  return CUBE_FACES.FRONT; // Default to front if something goes wrong
}

// Function to update the link btn inside the popupPlane for project face
function updateLink(faceIndex) {
  const project = shuffled[faceIndex];
  
  console.log('Updating link for:', {
    face: faceIndex,
    faceName: Object.keys(CUBE_FACES)[Object.values(CUBE_FACES).indexOf(faceIndex)],
    project: project,
    isPopupActive: isPopupActive
  });
  
  const linkEl = document.getElementById('link-btn');
  const projectNameEl = document.getElementById('project-name');
  
  if (!linkEl || !projectNameEl) return;
  
  if (project && isPopupActive) {
    linkEl.href = project.link;
    projectNameEl.textContent = project.name;
    linkEl.style.display = 'flex'; // Show link
  } else {
    linkEl.style.display = 'none'; // Hide link
  }
}

// Click Func


function onDoubleClick(event) {
  // Don’t interfere while dragging or when clicking UI elements
  if (isDragging || isClickOnUI(event)) return;

  // Convert mouse to normalized device coords
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Raycast against the cube (including its outline/shadow children)
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(cube, true);
  if (!hits.length) return;

  // Geometry face → raw face index (0–5)
  const raw = Math.floor(hits[0].faceIndex / 2);

  // Map raw face to your logical CUBE_FACES enum
  const faceLookup = [
    CUBE_FACES.RIGHT,   // raw 0 → +X
    CUBE_FACES.LEFT,    // raw 1 → -X
    CUBE_FACES.TOP,     // raw 2 → +Y
    CUBE_FACES.BOTTOM,  // raw 3 → -Y
    CUBE_FACES.FRONT,   // raw 4 → +Z
    CUBE_FACES.BACK     // raw 5 → -Z
  ];
  const faceIndex = faceLookup[raw];

  // If a popup is already open:
  if (popupPlane) {
    if (openedFaceIndex === faceIndex) {
      // clicking same face again → do nothing
      return;
    } else {
      // clicking a different face while popup open → just close it
      hidePopup();
      openedFaceIndex = null;
      return;
    }
  }

  // No popup yet → open the new one
  showPopupPlane(faceIndex);
  updateLink(faceIndex);
  openedFaceIndex = faceIndex;
}


function hidePopup() {
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

        const linkEl = document.getElementById('link-btn');
        if (linkEl) {
          linkEl.style.display = 'none';
        }

        // Reset the opened face
        openedFaceIndex = null;
      }
    });
  }
}


// Popup Planes Creation

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
    // remove the click hint elem right away if on screen
    const clickHint = document.getElementById('click-hint');
    if (clickHint) {
      clickHint.remove();
    }

  openedFaceIndex = faceIndex;
  console.log(openedFaceIndex);
  const originalBloomStrength = 0.2; // Store the default bloom strength
  
  // If popup is already active, close it first
  if (popupPlane) {
    // Make sure we set a consistent cleanup function
    const cleanupPopup = () => {
      cube.remove(popupPlane);
      cube.remove(borderPlane);
      cube.remove(shadowPlane);
      popupPlane = null;
      borderPlane = null;
      shadowPlane = null;
      isPopupActive = false;

      // Reset bloom to original value
      bloomPass.strength = originalBloomStrength;
      
      // Hide link when popup is closed
      const linkEl = document.getElementById('link-btn');
      if (linkEl) {
        linkEl.style.display = 'none';
      }
      
      console.log("Popup closed, bloom reset to:", originalBloomStrength);
    };

    // Make sure the animation completes properly
    bloomPass.strength = 0.2; // Reset bloom first
    
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
      onComplete: cleanupPopup // Use our consistent cleanup function
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
  console.log('Popup debug – faceIndex:', faceIndex, 'project:', project);

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
  shadowPlane.translateZ(-0.015);
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
      document.getElementById('link-btn').style.display = 'flex';
      updateLink(faceIndex);
      snapRotation();
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

  if (popupPlane) {
    if (bloomPass.strength !== 0.12) {
      bloomPass.strength = 0.12; // Ensure popup bloom value
    }
  } else {
    if (bloomPass.strength !== 0.2) {
      bloomPass.strength = 0.2; // Ensure default bloom value
    }
  }

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


