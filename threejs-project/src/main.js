import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { gsap } from 'gsap';
import { PopupPlane, CUBE_FACES } from './components/PopupPlane';
import { Cube } from './components/Cube';

let scene, camera, renderer, composer, bloomPass;
let cubeController;
let popupPlaneController;
let openedFaceIndex = null;
let raycaster, mouse;

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


function handleAllClicks(event) {
  // Check if we're in the middle of a drag operation or clicking on UI elements
  if (cubeController.isDragging || isClickOnUI(event)) {
    console.log("Click ignored - drag or UI click");
    return;
  }

  const popupState = popupPlaneController.getPopupState();

  if (popupState.isAnimating) {
    console.log("Click ignored - animation in progress");
    return;
  }

  // If we have video controls and they're active, let them handle clicks first
  if (popupPlaneController.videoControls && 
      popupPlaneController.videoControls.isActive && 
      popupPlaneController.videoControls.isVisible && 
      popupPlaneController.videoControls.handleClick(event, popupState)) {
    console.log("controls got the click");
    return;
  }
    
  // Secondary check - did we click on the popup plane itself?
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  if (popupPlaneController.popupPlane) {
    const hits = raycaster.intersectObject(popupPlaneController.popupPlane);
    if (hits.length > 0) {
      popupPlaneController.videoControls.toggleVisibility(popupState);
      return;
    }
  }
  
  // If we get here, the click was on the cube or background
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


function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 2.5;

  // init the renderer
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  // Initialize raycaster and mouse for interaction
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

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

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });
}


function setupEvents() {
  // Mouse controls
  window.addEventListener('mousedown', (e) => {
    cubeController.handleMouseDown(e, isClickOnUI, popupPlaneController.getPopupState());
  });

  window.addEventListener('mouseup', (e) => {
    cubeController.handleMouseUp(e, cursor, isClickOnUI);
  });

  window.addEventListener('mousemove', (e) => {
    cubeController.handleMouseMove(e, cursor, isClickOnUI, popupPlaneController.getPopupState());
  });

  // Touch controls
  window.addEventListener('touchstart', (e) => {
    cubeController.handleTouchStart(e, isClickOnUI, popupPlaneController.getPopupState());
  });

  window.addEventListener('touchmove', (e) => {
    cubeController.handleTouchMove(e, isClickOnUI, popupPlaneController.getPopupState());
  });

  window.addEventListener('touchend', (e) => {
    cubeController.handleTouchEnd(e, isClickOnUI);
  });
}


function setupBackgroundSelector() {
  const bgSelector = document.getElementById('bg-selector');
  if (!bgSelector) return;
  
  const selectedSpan = bgSelector.querySelector('.selected');
  const optionsList = bgSelector.querySelector('.dropdown-options');
  if (!optionsList) return;

  // Set initial background
  const defaultBgOption = optionsList.querySelector('.active');
  const defaultBg = defaultBgOption ? defaultBgOption.dataset.value : null;
  
  if (!defaultBg) return;
  
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

      // Update environment
      cubeController.updateSceneEnvironment(selectedValue, hidePopup, updateLink);

      // Prevent bgSelector click from also toggling the dropdown again
      e.stopPropagation();
    });
  });
  
  // Initial environment update
  cubeController.updateSceneEnvironment(defaultBg, hidePopup, updateLink);
}


// Function to update the link btn inside the popupPlane for project face
function updateLink(faceIndex) {
  const popupState = popupPlaneController.getPopupState();
  const linkEl = document.getElementById('link-btn');
  const projectNameEl = document.getElementById('project-name');
  
  if (!linkEl || !projectNameEl) return;
  
  // Only show link if popup is active AND not closing
  if (faceIndex !== null && popupState.isActive && !popupState.isClosing) {
    const shuffled = cubeController.getShuffledProjects();
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
  // Delegate double-click handling to the cube controller
  cubeController.handleDoubleClick(
    event, 
    isClickOnUI, 
    popupPlaneController, 
    showPopupPlane, 
    hidePopup
  );
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

  
  const shuffled = cubeController.getShuffledProjects();
  const materials = cubeController.materials;

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
    cubeController.snapRotation.bind(cubeController)
  );
}

function hidePopup() {
  // Check if popup is currently animating before proceeding
  const popupState = popupPlaneController.getPopupState();
  if (popupState.isAnimating) {
    console.log("Hide popup ignored - animation already in progress");
    return;
  }
  
  popupPlaneController.hidePopup(updateLink);
}


function animate() {
  requestAnimationFrame(animate);
  
  const time = new THREE.Clock().getElapsedTime();
  const popupState = popupPlaneController.getPopupState();
  
  // Update bloom and other effects
  popupPlaneController.updateBloom();
  
  // Update cube animation
  cubeController.animate(time, popupState);
  
  // Update video controls in the animation loop
  if (popupPlaneController.videoControls) {
    popupPlaneController.videoControls.animate();
  }
  
  // Render scene
  composer.render();
}

async function startApp() {
  console.log("Starting app...");
  init();
  
  try {
    console.log("Initializing cube controller...");
    cubeController = new Cube(renderer, bloomPass, camera, scene);
    
    // Initialize cube controller first and wait for it to complete
    console.log("Waiting for cube initialization...");
    await cubeController.init();
    console.log("Cube initialization complete");
    
    // Now that cube is initialized, create popup plane controller
    console.log("Creating popup plane controller...");
    const cube = cubeController.getCube();
    popupPlaneController = new PopupPlane(cube, renderer, bloomPass, camera);
    
    cubeController.setPopupController(popupPlaneController);
    // Set up events
    console.log("Setting up events...");
    setupEvents();
    setupVideoControlEvents();
    setupBackgroundSelector();
    
    // Set initial link
    updateLink(cubeController.getCurrentFaceIndex());
    
    // Fade out loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('loaded');
    }
    
    console.log("Starting animation loop");
    // Start animation loop
    animate();
    
  } catch (error) {
    console.error("Error starting application:", error);
  }
}

// Start the application
startApp();

