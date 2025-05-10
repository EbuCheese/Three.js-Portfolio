import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { gsap } from 'gsap';
import { PopupPlane, CUBE_FACES } from './components/PopupPlane';

let popupPlaneController;
let openedFaceIndex = null;

let scene, camera, renderer, composer, cube, outlineMesh;
let initialSnap = false;
let hasShownClickHint = false;
let startX = 0;
let startY = 0;
let currentFaceIndex = 0;
let targetRotation = { x: 0, y: 3.89 };
let easing = 0.1;
let bloomPass;

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
  initialSnap = false;

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

function handleAllClicks(event) {
  // Never fire during drag or on other UI
  if (isDragging || isClickOnUI(event)) {
    console.log("Click ignored - drag or UI click");
    return;
  }

  const popupState = popupPlaneController.getPopupState();

  if (popupState.isAnimating) {
    console.log("Click ignored - animation in progress");
    return;
  }

    // If we have video controls and they're active, let them handle clicks first
  if (popupPlaneController.videoControls.isActive && 
      popupPlaneController.videoControls.isVisible && 
      popupPlaneController.videoControls.handleClick(event, popupState)) {
    console.log("controls got the click")
    return
  }
    
    // Secondary check - did we click on the popup plane itself?
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (popupPlaneController.popupPlane) {
      const hits = raycaster.intersectObject(popupPlaneController.popupPlane);
      if (hits.length > 0) {
        popupPlaneController.videoControls.toggleVisibility(popupState);
      }
    }
    // If we get here, handle cube clicks or other behavior
    console.log("Click not handled by video controls or popup plane");
  }
  


// Fix the event listeners for single click handling
function setupVideoControlEvents() {
  // Remove any existing listeners to avoid duplicates
  window.removeEventListener('click', handleAllClicks);
  window.removeEventListener('dblclick', onDoubleClick);
  
  // Add event listeners with passive option for better performance
  window.addEventListener('click', handleAllClicks, { passive: false });
  window.addEventListener('dblclick', onDoubleClick, { passive: false });
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
  popupPlaneController = new PopupPlane(cube, renderer, bloomPass, camera);

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
  setupVideoControlEvents();

  // Smooth exposure fade-in for background
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
    new THREE.Vector2(window.innerWidth/2, window.innerHeight/2),
    0.2, // strength
    0.2, // radius
    0.1 // threshold
  );

  composer = new EffectComposer(renderer);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);

  // EVENTS //
  
  // Mouse controls
  window.addEventListener('mousedown', (e) => {
    if (isClickOnUI(e)) return;

    // Check if any popup animation is in progress
    const popupState = popupPlaneController.getPopupState();
    if (popupState.isAnimating) {
      console.log("Mouse down ignored - animation in progress");
      return;
    }

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

    // Check if any popup animation is in progress
    const popupState = popupPlaneController.getPopupState();
    if (popupState.isAnimating) {
      return; // Don't process drag during animations
    }

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

    // Check if any popup animation is in progress
    const popupState = popupPlaneController.getPopupState();
    if (popupState.isAnimating) {
      console.log("Touch start ignored - animation in progress");
      return;
    }

    isDragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  });

  window.addEventListener('touchmove', (e) => {
    if (isClickOnUI(e)) return;
    if (!isDragging) return;

    // Check if any popup animation is in progress
    const popupState = popupPlaneController.getPopupState();
    if (popupState.isAnimating) {
      return; // Don't process drag during animations
    }

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
  initialSnap = true;

  const snappedX = Math.round(targetRotation.x / (Math.PI / 2)) * (Math.PI / 2);
  const snappedY = Math.round(targetRotation.y / (Math.PI / 2)) * (Math.PI / 2);

  targetRotation.x = snappedX;
  targetRotation.y = snappedY;

  const newFaceIndex = getFrontFaceIndex(snappedX, snappedY);
  const popupState = popupPlaneController.getPopupState();

  if (popupState.isActive && currentFaceIndex !== newFaceIndex) {
    // Close popup if snapped to a new face
    hidePopup();
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
  const popupState = popupPlaneController.getPopupState();
  const linkEl = document.getElementById('link-btn');
  const projectNameEl = document.getElementById('project-name');
  
  if (!linkEl || !projectNameEl) return;
  
  // Only show link if popup is active AND not closing
  if (faceIndex !== null && popupState.isActive && !popupState.isClosing) {
    const project = shuffled[faceIndex];
    if (project) {
      linkEl.href = project.link;
      projectNameEl.textContent = project.name;
      linkEl.style.display = 'flex'; // Show link
    }
  } else {
    linkEl.style.display = 'none'; // Hide link
  }
}

// Click Func
function onDoubleClick(event) {
  if (!initialSnap) return;
  if (isDragging || isClickOnUI(event)) return;

  const popupState = popupPlaneController.getPopupState();

  if (popupState.isAnimating) {
    console.log("Double-click ignored - animation in progress");
    return;
  }

  const now = Date.now();
  if (now - popupState.lastAnimationTime < popupPlaneController.animationDelay) {
    console.log("Double-click ignored - on animation cooldown");
    return;
  }

  if (popupPlaneController.videoControls.handleClick(event, popupState)) {
    return; // Already handled by video controls
  }

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

  if (popupState.isActive) {
    if (popupState.openedFaceIndex === faceIndex) {
      return; // clicking same face again → do nothing
    } else {
      hidePopup(); // different face → close current
      openedFaceIndex = null;
      return;
    }
  }

  // No popup yet → open the new one
  showPopupPlane(faceIndex);
  openedFaceIndex = faceIndex;
}


function showPopupPlane(faceIndex) {

  // Check if there's an animation in progress
  const popupState = popupPlaneController.getPopupState();
  if (popupState.isAnimating) {
    console.log("Show popup ignored - animation in progress");
    return;
  }
  
  // Check animation cooldown 
  const now = Date.now();
  if (now - popupState.lastAnimationTime < popupPlaneController.animationDelay) {
    console.log("Show popup ignored - on animation cooldown");
    return;
  }

  popupPlaneController.showPopupPlane(
    faceIndex, 
    shuffled, 
    materials, 
    () => {
      console.log("Popup shown, project:", shuffled[faceIndex]);
    }, 
    (videoElement, popupPlane, popupState) => {
      // Only add video controls if we have a video element
      if (videoElement) {
        console.log("Adding video controls for video element");
        popupPlaneController.videoControls.add(videoElement, popupPlane, popupState);
      }
    },
    updateLink, 
    snapRotation
  );
}

function hidePopup() {
  // Check if popup is currently animating before proceeding
  const popupState = popupPlaneController.getPopupState();
  if (popupState.isAnimating) {
    console.log("Hide popup ignored - animation already in progress");
    return;
  }

  // hide link asap
  const linkEl = document.getElementById('link-btn');
  if (linkEl) {
    linkEl.style.display = 'none';
  }
  
  popupPlaneController.hidePopup(updateLink);
}


const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  if (!cube) return;

  const popupState = popupPlaneController.getPopupState();
  popupPlaneController.updateBloom();

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
  if (!popupState.isActive) {
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
    
    // Update video controls in the animation loop
    if (popupPlaneController.videoControls) {
      popupPlaneController.videoControls.animate();
    }

    // render 
    composer.render();

}

