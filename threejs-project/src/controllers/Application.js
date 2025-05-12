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

export class Application {
  constructor() {
    // Core Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.bloomPass = null;
    
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
  
  initThreeJS() {
    // Scene setup
    this.scene = new THREE.Scene();
    
    // Camera setup
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
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
  
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }
  
  // animate manager, managing popupPlane animate method
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    
    const time = this.clock.getElapsedTime();
    const popupState = this.popupPlaneController.getPopupState();
    
    // Update bloom and other effects
    this.popupPlaneController.updateBloom();
    
    // Update cube animation
    this.cubeController.animate(time, popupState);
    
    // Update video controls in the animation loop
    if (this.popupPlaneController.videoControls) {
      this.popupPlaneController.videoControls.animate();
    }
    
    // Render scene
    this.composer.render();
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