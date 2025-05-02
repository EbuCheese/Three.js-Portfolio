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

let scene, camera, renderer, composer, cube, outlineMesh;
let isPopupActive = false;
let hasShownClickHint = false;
let startX = 0;
let startY = 0;
let currentFaceIndex = 0;
let targetRotation = { x: 0, y: 3.89 };
let easing = 0.1;
let bloomPass;
let openedFaceIndex = null;  // Global opened face

let isDragging = false;
let dragInitiated = false;
const DRAG_THRESHOLD = 3;

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
  });
  
  el.addEventListener('mouseleave', () => {
    cursor.classList.remove('hovering');
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

// BG to HDRI mapping
const bgToHDRMap = {
  "/fu1.jpg": "/hdri2.hdr",
  "/fu2.jpg": "/hdri1.hdr",
  "/fu3.png": "/hdri3.hdr",
  "/fu4.jpg": "/hdri4.hdr",
  "/fu5.jpg": "/hdri5.hdr",
  "/fu6.jpg": "/hdri6.hdr",
  "/fu7.jpg": "/hdri7.hdr",
  "/fu8.jpg": "/hdri8.hdr",
};

let materials = [];
const materialAdjustments = {
  '/fu1.jpg': { metalness: 0.95, roughness: 0.15, envMapIntensity: 1.2 },
  '/fu2.jpg': { metalness: 0.8, roughness: 0.3, envMapIntensity: 0.8 },
  '/fu3.png': { metalness: 0.6, roughness: 0.25, envMapIntensity: 0.5 },
  '/fu4.jpg': { metalness: 0.9, roughness: 0.2, envMapIntensity: 1.0 },
  '/fu5.jpg': { metalness: 0.6, roughness: 0.3, envMapIntensity: 0.8 },
  '/fu6.jpg': { metalness: 0.8, roughness: 0.3, envMapIntensity: 1 },
  '/fu7.jpg': { metalness: 1, roughness: 0.2, envMapIntensity: 1.0 },
  '/fu8.jpg': { metalness: 0.75, roughness: 0.3, envMapIntensity: 0.65 },
};

// Shuffle and assign 6 random projects
const shuffled = [...projects].sort(() => 0.5 - Math.random());
console.log(shuffled);

const orderedShuffled = [
  shuffled[1], // right 
  shuffled[0], // left
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


async function updateSceneEnvironment(bgPath) {
  const loaderEl = document.getElementById('bg-loading');
  loaderEl.classList.remove('hidden');

  // close the popups
  hidePopup();
  updateLink(1);

  // rotate back to default
  targetRotation = { x: 0, y: 3.89 };

  const hdrPath = bgToHDRMap[bgPath];
  const adjustments = materialAdjustments[bgPath];
  if (!hdrPath) return;

  // Load background
  const bgPromise = new Promise(resolve => {
    loader.load(bgPath, texture => {
      scene.background = texture;
      resolve();
    });
  });

  // Load HDR environment
  const hdrTexture = await loadHDR(hdrPath);
  scene.environment = hdrTexture;

  // Apply to all relevant materials
  materials.forEach(mat => {
    mat.envMap = hdrTexture;
    mat.envMapIntensity = adjustments?.envMapIntensity ?? mat.envMapIntensity;
    mat.metalness = adjustments?.metalness ?? mat.metalness;
    mat.roughness = adjustments?.roughness ?? mat.roughness;
    mat.needsUpdate = true;
  });
  
  await bgPromise;


  // Hide loader
  loaderEl.classList.add('hidden');
}


init();


// Load everything before starting the scene
Promise.all([
  loadHDR('/hdri2.hdr'),
  Promise.all(orderedShuffled.map(p => createMaterial(p.image)))
]).then(([hdrTexture, loadedMaterials]) => {
  // Set the HDR environment
  scene.environment = hdrTexture;
  
  const bgSelector = document.getElementById('bg-selector');
  const selectedSpan = bgSelector.querySelector('.selected');
  const optionsList = bgSelector.querySelector('.dropdown-options');

  const defaultBg = optionsList.querySelector('.active').dataset.value;
  loader.load(defaultBg, texture => {
    scene.background = texture;
  });

  // Toggle dropdown on bgSelector click (but not when clicking on an option)
  bgSelector.addEventListener('click', (e) => {
    // Ignore clicks on <li> items inside dropdown
    if (e.target.tagName.toLowerCase() === 'li') return;
    optionsList.classList.toggle('open');
  });

  // Cursor changes on dropdown hover
  optionsList.addEventListener('mouseenter', () => {
    cursor.classList.add('cursor-square');
  });
  optionsList.addEventListener('mouseleave', () => {
    cursor.classList.remove('cursor-square');
  });

  // Handle option selection
  optionsList.querySelectorAll('li').forEach(option => {
    option.addEventListener('click', (e) => {
      const selectedValue = option.dataset.value;

      // Update UI
      optionsList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
      option.classList.add('active');
      selectedSpan.textContent = option.textContent;
      optionsList.classList.remove('open');

      // Load background
      loader.load(selectedValue, texture => {
        scene.background = texture;
      });

      //update the scene env
      updateSceneEnvironment(selectedValue);

      // Prevent bgSelector click from also toggling the dropdown again
      e.stopPropagation();
    });
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

  outlineMesh = new THREE.Mesh(cube.geometry.clone(), outlineShaderMaterial);
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
    dragInitiated = true;
    startX = e.clientX;
    startY = e.clientY;
  });

  window.addEventListener('mouseup', (e) => {
    if (isDragging && !isClickOnUI(e)) {
      snapRotation();
    }
  
    isDragging = false;
    dragInitiated = false;
    cursor.classList.remove('grabbing');
  });

  window.addEventListener('mousemove', (e) => {
    cursor.style.top = `${e.clientY}px`;
    cursor.style.left = `${e.clientX}px`;

    if (dragInitiated && !isDragging) {
      const distX = Math.abs(e.clientX - startX);
      const distY = Math.abs(e.clientY - startY);
      if (distX > DRAG_THRESHOLD || distY > DRAG_THRESHOLD) {
        isDragging = true;
        cursor.classList.add('grabbing');
      }
    }


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
  const normalizedX = ((Math.round(rotX / (Math.PI / 2)) % 4) + 4) % 4;
  const normalizedY = ((Math.round(rotY / (Math.PI / 2)) % 4) + 4) % 4;

  console.log('Rotation debug:', {
    rawX: rotX,
    rawY: rotY,
    normalizedX,
    normalizedY
  });

  if (normalizedX === 1) return CUBE_FACES.TOP;
  if (normalizedX === 3) return CUBE_FACES.BOTTOM;

  // Get the default face based on Y rotation
  const faceMap = [CUBE_FACES.FRONT, CUBE_FACES.RIGHT, CUBE_FACES.BACK, CUBE_FACES.LEFT];

  // If upside down, reverse the side face directions
  if (normalizedX === 2) {
    // 180° X rotation inverts the Y-axis perspective
    const flippedMap = [CUBE_FACES.BACK, CUBE_FACES.LEFT, CUBE_FACES.FRONT, CUBE_FACES.RIGHT];
    return flippedMap[normalizedY];
  }

  return faceMap[normalizedY];
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
  if (isDragging || isClickOnUI(event)) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(cube, true);

  if (!hits.length) return;

  // Filter out the outlineMesh so it can't trigger popups
  const validHit = hits.find(hit => hit.object !== outlineMesh);
  if (!validHit) return;

  // Geometry face → raw face index (0–5)
  const raw = Math.floor(validHit.faceIndex / 2);

  const faceLookup = [
    CUBE_FACES.RIGHT,   // raw 0 → +X
    CUBE_FACES.LEFT,    // raw 1 → -X
    CUBE_FACES.TOP,     // raw 2 → +Y
    CUBE_FACES.BOTTOM,  // raw 3 → -Y
    CUBE_FACES.FRONT,   // raw 4 → +Z
    CUBE_FACES.BACK     // raw 5 → -Z
  ];
  const faceIndex = faceLookup[raw];

  if (popupPlane) {
    if (openedFaceIndex === faceIndex) {
      return; // clicking same face again → do nothing
    } else {
      hidePopup(); // different face → close current
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
  console.log('Popup debug - faceIndex:', faceIndex, 'project:', project);

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


