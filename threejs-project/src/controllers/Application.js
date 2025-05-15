// Application.js
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Cube } from '../components/Cube';
import { PopupPlane } from '../components/PopupPlane';
import { UIManager } from '../components/UIManager';
import { EventManager } from '../components/EventManager';
import { OrientationHandler } from '../components/OrientationHandler';

export class Application {
  constructor() {
    // Core Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.bloomPass = null;
    
    // Performance Toggle
    this.isLowPerformanceMode = false;

    // Interaction components
    this.raycaster = null;
    this.mouse = null;
    
    // Controllers
    this.cubeController = null;
    this.popupPlaneController = null;
    this.uiManager = null;
    this.eventManager = null;
    
    // State
    this.clock = new THREE.Clock();

    // Orientation
    this.orientationHandler = null;
  }
  
  async init() {
    console.log("Initializing application...");
    
    // init the threeJS scene, camera, rendering process
    this.initThreeJS();
    // init the added post processing
    this.initPostprocessing();
    // init the mouse and raycaster
    this.initInteraction();
    
    // Initialize the cube component
    this.cubeController = new Cube(this.renderer, this.bloomPass, this.camera, this.scene);
    await this.cubeController.init();
    
    const cube = this.cubeController.getCube();
    this.popupPlaneController = new PopupPlane(cube, this.renderer, this.bloomPass, this.camera);
    this.cubeController.setPopupController(this.popupPlaneController);
    
    // Initialize the UI and events
    this.uiManager = new UIManager(this);
    this.uiManager.init();
    
    this.eventManager = new EventManager(this);
    this.eventManager.init();
    
    // Initial link update
    this.uiManager.updateLink(this.cubeController.getCurrentFaceIndex());
  
    // Fade out loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('loaded');
    }
    
    console.log("Application initialized");
  }
  
  isMobileDevice() {
    return window.innerWidth <= 900;
  }

  initThreeJS() {
    // Create orientation handler before setting up rest of scene
    this.orientationHandler = new OrientationHandler();

    // Automatically enable low performance mode on mobile
    if (this.isMobileDevice()) {
      this.isLowPerformanceMode = true;
      console.log("Mobile device detected - enabling low performance mode automatically");
    }

    // Scene setup
    this.scene = new THREE.Scene();
    
    // Camera setup
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.updateCameraForViewport();
    this.camera.position.z = 2.5;
    
    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.physicallyCorrectLights = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(this.renderer.domElement);
    
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
    window.addEventListener('orientationchange', () => {
      // Small delay to ensure new dimensions are ready
      setTimeout(this.onWindowResize.bind(this), 100);
    });
  }
  
  initPostprocessing() {
    const renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth/2, window.innerHeight/2),
      0.2, // strength
      0.2, // radius
      0.1  // threshold
    );
    
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.bloomPass);
  }
  
  initInteraction() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }
  
  // Update camera fov based on device dimensions
updateCameraForViewport() {
  if (!this.camera) return;
  
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspectRatio = width / height;
  
  // Adjust field of view for different devices in landscape mode
  let fov = 50; // Default FOV
  let zPosition = 2.5; // Default z position
  
  // For mobile landscape
  if (width <= 900) {
    if (aspectRatio > 1) { // Landscape
      fov = 50; // Wider FOV for landscape mobile
      zPosition = 2; // Closer to see better
    } else {
      fov = 45;
      zPosition = 2.5;
    }
  } 
  // For tablet landscape
  else if (width <= 1180) {
    if (aspectRatio > 1) { // Landscape
      fov = 55;
      zPosition = 2.15;
    } else {
      fov = 45;
      zPosition = 2.85;
    }
  } 
  // For desktop
  else {
    fov = 50;
    zPosition = 2.5;
  }
  
  // Update the camera parameters
  this.camera.fov = fov;
  this.camera.aspect = width / height;
  this.camera.position.z = zPosition;
  this.camera.updateProjectionMatrix();
  
  console.log(`Camera updated: FOV=${fov}, Z=${zPosition}, aspect=${aspectRatio.toFixed(2)}`);
}


  onWindowResize() {
  // Update camera aspect and projection
  this.updateCameraForViewport();
  
  // Update renderer size
  this.renderer.setSize(window.innerWidth, window.innerHeight);
  this.composer.setSize(window.innerWidth, window.innerHeight);
  
  // Update cube size
  if (this.cubeController) {
    this.cubeController.updateCubeSize();
    this.popupPlaneController.hidePopup(); // hide popup to avoid bug when re-sizing window
  }
}
  
setLowPerformanceMode(isLowPerf) {
  console.log(`Setting low performance mode: ${isLowPerf}`);
  this.isLowPerformanceMode = isLowPerf;
  
  // Update renderer settings
  if (isLowPerf) {
    // Lower resolution rendering
    this.renderer.setPixelRatio(1);
     
    // Reduce shadow quality
    this.renderer.shadowMap.enabled = false;
    
    // Disable physically correct lights for better performance
    this.renderer.physicallyCorrectLights = false;
    
    // Reduce tone mapping quality
    this.renderer.toneMapping = THREE.NoToneMapping;
    
    // Disable bloom effect or reduce quality
    this.bloomPass.enabled = false;
  } else {
    // Restore high quality settings
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.bloomPass.enabled = true;
  }
  
  // Update cube materials (if they have performance-impacting settings)
  if (this.cubeController) {
    this.cubeController.updateMaterialQuality(isLowPerf);
  }
  
  // Force resize to apply pixel ratio changes
  this.onWindowResize();
}

  // animate manager, managing popupPlane animate method
  animate() {

  if (this.orientationHandler && !this.orientationHandler.shouldRender()) {
    requestAnimationFrame(this.animate.bind(this));
    return; // Skip rendering
  }

  requestAnimationFrame(this.animate.bind(this));
  
  const time = this.clock.getElapsedTime();
  const popupState = this.popupPlaneController.getPopupState();
  
  // Update bloom and other effects - skip in low performance mode
  if (!this.isLowPerformanceMode) {
    this.popupPlaneController.updateBloom();
  }
  
  // Update cube animation - possibly with simplified animation in low perf mode
  this.cubeController.animate(time, popupState, this.isLowPerformanceMode);
  
  // Update video controls in the animation loop - always needed for functionality
  if (this.popupPlaneController.videoControls) {
    this.popupPlaneController.videoControls.animate();
  }
  
  // Render scene - use simpler rendering in low perf mode
  if (this.isLowPerformanceMode) {
    // In low perf mode, potentially skip some frames when nothing important is happening
    const currentTime = this.clock.getElapsedTime();
    this.lastRenderTime = currentTime;
    
    // Direct render without post-processing when possible
    if (!popupState.isActive && !popupState.isAnimating) {
      this.renderer.render(this.scene, this.camera);
    } else {
      // Use composer for popups even in low perf mode for proper display
      this.composer.render();
    }
  } else {
    // Normal render with post-processing
    this.composer.render();
  }
}
  
  // showPopupPlane manager, managing popupPlane showPopupPlane method
  showPopupPlane(faceIndex) {
    // Check if there's an animation in progress
    const popupState = this.popupPlaneController.getPopupState();
    if (popupState.isAnimating) {
      console.log("Show popup ignored - animation in progress");
      return;
    }
    
    // Check animation cooldown 
    const now = Date.now();
    if (now - popupState.lastAnimationTime < this.popupPlaneController.animationDelay) {
      console.log("Show popup ignored - on animation cooldown");
      return;
    }
    
    const shuffled = this.cubeController.getShuffledProjects();
    const materials = this.cubeController.materials;
    
    this.popupPlaneController.showPopupPlane(
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
          this.popupPlaneController.videoControls.add(videoElement, popupPlane, popupState);
        }
      },
      () => this.uiManager.updateLink(faceIndex), 
      this.cubeController.snapRotation.bind(this.cubeController)
    );
  }
  
  // hidePopup manager, managing popupPlane hidePopup method
  hidePopup() {
    // Check if popup is currently animating before proceeding
    const popupState = this.popupPlaneController.getPopupState();
    if (popupState.isAnimating) {
      console.log("Hide popup ignored - animation already in progress");
      return;
    }
    
    this.popupPlaneController.hidePopup(() => this.uiManager.updateLink(null));
  }
  
  // start the animation
  start() {
    console.log("Starting animation loop");
    this.animate();
  }
}