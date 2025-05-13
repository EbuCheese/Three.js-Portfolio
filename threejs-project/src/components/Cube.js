import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { gsap } from 'gsap';
import { CUBE_FACES } from './PopupPlane';

export class Cube {
  constructor(renderer, bloomPass, camera, scene) {
    // Cube params
    this.renderer = renderer;
    this.bloomPass = bloomPass;
    this.camera = camera;
    this.scene = scene;
    
    // Cube properties
    this.cube = null;
    this.outlineMesh = null;
    this.materials = [];
    this.currentFaceIndex = 0;
    this.targetRotation = { x: 0, y: 3.89 };
    this.easing = 0.1;
    this.initialSnap = false;
    
    // Interaction states
    this.isDragging = false;
    this.dragInitiated = false;
    this.startX = 0;
    this.startY = 0;
    this.DRAG_THRESHOLD = 3;
    this.hasShownClickHint = false;

    // Project data 
    this.projects = [
      { image: '/fish.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project2', name: 'Right (+X)' },
      { image: '/dogmeditate.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project1', name: 'Left (-X)' },
      { image: '/catcreeper.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project3', name: 'Top (+Y)' },
      { image: '/DD.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project4', name: 'Bottom (-Y)' },
      { image: '/lego-sleep.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project5', name: 'Front (+Z)' },
      { image: '/lime.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project6', name: 'Back (-Z)' }
    ];
    
    // shuffle the projects
    this.shuffledProjects = [...this.projects].sort(() => 0.5 - Math.random());
    
    // Material adjustments for different backgrounds
    this.materialAdjustments = {
      '/fu1.jpg': { metalness: 0.95, roughness: 0.15, envMapIntensity: 1.2 },
      '/fu2.jpg': { metalness: 0.8, roughness: 0.3, envMapIntensity: 0.8 },
      '/fu3.png': { metalness: 0.6, roughness: 0.25, envMapIntensity: 0.5 },
      '/fu4.jpg': { metalness: 0.9, roughness: 0.2, envMapIntensity: 0.9 },
      '/fu5.jpg': { metalness: 0.6, roughness: 0.3, envMapIntensity: 0.8 },
      '/fu6.jpg': { metalness: 0.8, roughness: 0.3, envMapIntensity: 1 },
      '/fu7.jpg': { metalness: 1, roughness: 0.2, envMapIntensity: 1.0 },
      '/fu8.jpg': { metalness: 0.75, roughness: 0.3, envMapIntensity: 0.65 },
    };
    
    // Background to HDRI mapping
    this.bgToHDRMap = {
      "/fu1.jpg": "/hdri2.hdr",
      "/fu2.jpg": "/hdri1.hdr",
      "/fu3.png": "/hdri3.hdr",
      "/fu4.jpg": "/hdri4.hdr",
      "/fu5.jpg": "/hdri5.hdr",
      "/fu6.jpg": "/hdri6.hdr",
      "/fu7.jpg": "/hdri7.hdr",
      "/fu8.jpg": "/hdri8.hdr",
    };
    
    this.textureLoader = new THREE.TextureLoader();
    this.rgbeLoader = new RGBELoader();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
  }
  
  async init() {
    try {
      console.log("Starting cube initialization");

      // Create and load materials first
      await this.loadMaterials();
      console.log("Materials loaded, creating cube");

      // Create the cube geometry
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      this.cube = new THREE.Mesh(geometry, this.materials);
      
      // Create glowing outline
      this.createOutlineMesh();
      
      // Set materials initially invisible for fade-in effect
      this.materials.forEach(mat => {
        mat.transparent = true;
        mat.opacity = 0;
      });
      
      // Add cube to scene
      this.scene.add(this.cube);
      
      // Fade in materials
      this.fadeInMaterials();
      
      return this.cube;
    } catch (error) {
      console.error("Error initializing cube:", error);
      throw error;
    }
  }
  
  // set the popupController --> see PopupPlane.js 
  setPopupController(controller) {
    this.popupPlaneController = controller;
  }

  async loadMaterials() {
    // Create array in the correct order for cube faces
    const orderedProjects = [
      this.shuffledProjects[CUBE_FACES.RIGHT],  // right (+X) 
      this.shuffledProjects[CUBE_FACES.LEFT],   // left (-X)
      this.shuffledProjects[CUBE_FACES.TOP],    // top (+Y)
      this.shuffledProjects[CUBE_FACES.BOTTOM], // bottom (-Y)
      this.shuffledProjects[CUBE_FACES.FRONT],  // front (+Z)
      this.shuffledProjects[CUBE_FACES.BACK]    // back (-Z)
    ];
    
    // Create and load all materials asynchronously
    const materialPromises = orderedProjects.map(project => 
      this.createMaterial(project.image)
    );
    // set the promise for cube materials
    try {
      this.materials = await Promise.all(materialPromises);
      return this.materials;
    } catch (error) {
      console.error("Error loading materials:", error);
      throw error;
    }
  }
  
  async createMaterial(imagePath) {
    // Create a material with high-quality texture settings
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        imagePath, 
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = true;
          texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          texture.needsUpdate = true;
          // default material for cube faces
          const material = new THREE.MeshStandardMaterial({
            map: texture,
            metalness: 0.95,
            roughness: 0.15,
            envMapIntensity: 1.2,
            transparent: true,
            opacity: 0,
          });
          
          resolve(material);
        },
        undefined,
        (error) => {
          console.error(`Error loading texture ${imagePath}:`, error);
          reject(error);
        }
      );
    });
  }
  
  createOutlineMesh() {
    // Create glowing outline effect around cube edges
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
    
    this.outlineMesh = new THREE.Mesh(this.cube.geometry.clone(), outlineShaderMaterial);
    this.outlineMesh.scale.multiplyScalar(1.02);
    this.cube.add(this.outlineMesh);
    
    return this.outlineMesh;
  }
  
  fadeInMaterials() {
    // Animate material opacity for fade-in effect
    this.materials.forEach(mat => {
      gsap.to(mat, {
        opacity: 1,
        duration: 1.2,
        ease: "power2.out",
        delay: 0.1
      });
    });
  }
  
  // update the background, material adjustments, and hdri 
  async updateSceneEnvironment(bgPath, hidePopupCallback, updateLinkCallback) {
    const loaderEl = document.getElementById('bg-loading');
    if (loaderEl) loaderEl.classList.remove('hidden');
    
    try {
      // Close any open popups
      if (hidePopupCallback) hidePopupCallback();
      if (updateLinkCallback) updateLinkCallback(1);
      
      // Reset rotation
      this.targetRotation = { x: 0, y: 3.89 };
      this.initialSnap = false;
      
      const hdrPath = this.bgToHDRMap[bgPath];
      const adjustments = this.materialAdjustments[bgPath];
      if (!hdrPath) return;
      
      // Load background and HDR environment in parallel
      const bgPromise = new Promise((resolve, reject) => {
        this.textureLoader.load(
          bgPath, 
          texture => {
            this.scene.background = texture;
            resolve();
          },
          undefined,
          reject
        );
      });
      
      const hdrTexture = await this.loadHDR(hdrPath);
      this.scene.environment = hdrTexture;
      
      // Apply material adjustments
      this.materials.forEach(mat => {
        if (adjustments) {
          mat.envMapIntensity = adjustments.envMapIntensity;
          mat.metalness = adjustments.metalness;
          mat.roughness = adjustments.roughness;
        }
        mat.needsUpdate = true;
      });
      
      await bgPromise;
    } catch (error) {
      console.error("Error updating scene environment:", error);
    } finally {
      // Always hide loader
      if (loaderEl) loaderEl.classList.add('hidden');
    }
  }
  
  loadHDR(path) {
    // Helper to load HDR as a Promise
    return new Promise((resolve, reject) => {
      this.rgbeLoader.load(
        path, 
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          resolve(texture);
        },
        undefined,
        reject
      );
    });
  }
  
  /// Handle the mouse and touch events ///

  handleMouseDown(e, isClickOnUI, popupState) {
    if (isClickOnUI(e)) return;
    
    // Check if any popup animation is in progress
    if (popupState.isAnimating) {
      console.log("Mouse down ignored - animation in progress");
      return;
    }
    
    this.dragInitiated = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
  }
  
  handleMouseMove(e, cursor, isClickOnUI, popupState) {
    cursor.style.top = `${e.clientY}px`;
    cursor.style.left = `${e.clientX}px`;
    
    // Check if any popup animation is in progress
    if (popupState.isAnimating) {
      return; // Don't process drag during animations
    }
    
    if (this.dragInitiated && !this.isDragging) {
      const distX = Math.abs(e.clientX - this.startX);
      const distY = Math.abs(e.clientY - this.startY);
      if (distX > this.DRAG_THRESHOLD || distY > this.DRAG_THRESHOLD) {
        this.isDragging = true;
        cursor.classList.add('grabbing');
      }
    }
    
    if (!this.isDragging) return;
    
    const deltaX = e.clientX - this.startX;
    const deltaY = e.clientY - this.startY;
    
    this.targetRotation.y += deltaX * 0.005;
    this.targetRotation.x += deltaY * 0.005;
    
    this.startX = e.clientX;
    this.startY = e.clientY;
  }
  
  handleMouseUp(e, cursor, isClickOnUI) {
    if (this.isDragging && !isClickOnUI(e)) {
      this.snapRotation();
    }
    
    this.isDragging = false;
    this.dragInitiated = false;
    cursor.classList.remove('grabbing');
  }
  
  handleTouchStart(e, isClickOnUI, popupState) {
    if (isClickOnUI(e)) return;
    
    // Check if any popup animation is in progress
    if (popupState.isAnimating) {
      console.log("Touch start ignored - animation in progress");
      return;
    }
    
    this.isDragging = true;
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
  }
  
  handleTouchMove(e, isClickOnUI, popupState) {
    if (isClickOnUI(e)) return;
    if (!this.isDragging) return;
    
    // Check if any popup animation is in progress
    if (popupState.isAnimating) {
      return; // Don't process drag during animations
    }
    
    const deltaX = e.touches[0].clientX - this.startX;
    const deltaY = e.touches[0].clientY - this.startY;
    
    this.targetRotation.y += deltaX * 0.005;
    this.targetRotation.x += deltaY * 0.005;
    
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
  }
  
  handleTouchEnd(e, isClickOnUI) {
    if (isClickOnUI(e)) return;
    this.isDragging = false;
    this.snapRotation();
  }
  
  // Snapping to faces logic
  snapRotation() {
    this.initialSnap = true;
    
    const snappedX = Math.round(this.targetRotation.x / (Math.PI / 2)) * (Math.PI / 2);
    const snappedY = Math.round(this.targetRotation.y / (Math.PI / 2)) * (Math.PI / 2);
    
    this.targetRotation.x = snappedX;
    this.targetRotation.y = snappedY;
    
    const newFaceIndex = this.getFrontFaceIndex(snappedX, snappedY);
    
    const popupState = this.popupPlaneController.getPopupState();
    if (popupState.isActive && this.currentFaceIndex !== newFaceIndex) {
      this.popupPlaneController.hidePopup();
    }
  

    // Logic to show hints for cube interaction
    if (!this.hasShownClickHint) {
      const clickHint = document.getElementById('click-hint');
      const dragHint = document.getElementById('scroll-hint');
      
      if (clickHint) {
        clickHint.style.display = 'flex';
        clickHint.style.animation = 'floatFade 5s ease-out forwards';
      }
      
      if (dragHint) {
        dragHint.classList.add('fade-out');
      }
      
      this.hasShownClickHint = true;
    }
    
    
    this.currentFaceIndex = newFaceIndex;
    
    console.log('SnapRotation(); Called - Snapped to new face:', {
      face: newFaceIndex,
      faceName: ["RIGHT", "LEFT", "TOP", "BOTTOM", "FRONT", "BACK"][newFaceIndex],
      project: this.shuffledProjects[newFaceIndex]
    });
    
    return newFaceIndex;
  }
  
  // logic to get the front face of cube
  getFrontFaceIndex(rotX, rotY) {
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
  
  // handle normal clicking
  handleClick(event, isClickOnUI, popupPlaneController) {
    // Never fire during drag or on other UI
    if (this.isDragging || isClickOnUI(event)) {
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
      console.log("controls got the click");
      return;
    }
    
    // Secondary check - did we click on the popup plane itself?
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    if (popupPlaneController.popupPlane) {
      const hits = this.raycaster.intersectObject(popupPlaneController.popupPlane);
      if (hits.length > 0) {
        popupPlaneController.videoControls.toggleVisibility(popupState);
      }
    }
    
    // If we get here, handle cube clicks or other behavior
    console.log("Click not handled by video controls or popup plane");
  }
  
  // handle the double clicking
  handleDoubleClick(event, isClickOnUI, popupPlaneController, showPopupPlane, hidePopup) {
    if (!this.initialSnap) return;
    if (this.isDragging || isClickOnUI(event)) return;
    
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
    
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObject(this.cube, true);
    
    if (!hits.length) return;
    
    // Filter out the outlineMesh so it can't trigger popups
    const validHit = hits.find(hit => hit.object !== this.outlineMesh);
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
        return;
      }
    }
    
    // No popup yet → open the new one
    showPopupPlane(faceIndex);
  }
  
  updateMaterialQuality(isLowPerf) {
  if (!this.materials) return;
  
  // Store original material properties if not already stored
  if (!this.originalMaterialProps && isLowPerf) {
    this.originalMaterialProps = this.materials.map(material => ({
      roughness: material.roughness,
      metalness: material.metalness,
      envMapIntensity: material.envMapIntensity,
      anisotropy: material.map?.anisotropy,
      mipMapBias: material.map?.mipMapBias,
      generateMipmaps: material.map?.generateMipmaps,
      minFilter: material.map?.minFilter,
      magFilter: material.map?.magFilter
    }));
  }
  
  // Apply optimizations to all materials
  this.materials.forEach((material, index) => {
    if (isLowPerf) {
      // Reduce material complexity
      material.roughness = 1.0; // Simpler lighting calculation
      material.metalness = 0.0; // Simpler lighting calculation
      material.envMapIntensity = 0.0; // Disable environment reflections
      material.flatShading = true; // Use flat shading instead of smooth
      
      // Reduce texture quality
      if (material.map) {
        material.map.anisotropy = 1; // Disable anisotropic filtering
        material.map.generateMipmaps = false; // Disable mipmap generation
        material.map.minFilter = THREE.LinearFilter; // Simpler texture filtering
        material.map.magFilter = THREE.LinearFilter;
      }
      
      // Disable any material-specific effects
      if (material.emissive) {
        material.emissiveIntensity = 0;
      }
    } else if (this.originalMaterialProps) {
      // Restore original material quality from stored values
      const origProps = this.originalMaterialProps[index];
      material.roughness = origProps.roughness;
      material.metalness = origProps.metalness;
      material.envMapIntensity = origProps.envMapIntensity;
      material.flatShading = false;
      
      if (material.map) {
        material.map.anisotropy = origProps.anisotropy;
        material.map.generateMipmaps = origProps.generateMipmaps;
        material.map.minFilter = origProps.minFilter;
        material.map.magFilter = origProps.magFilter;
      }
      
      if (material.emissive) {
        material.emissiveIntensity = 1.0;
      }
    }
    
    material.needsUpdate = true;
    if (material.map) material.map.needsUpdate = true;
  });
  
}

  // logic for bouncing animation
  animate(time, popupState, isLowPerformanceMode = false) {
  if (!this.cube) return;
  
  const phaseDuration = 4;       // Time to complete 1 full wave (e.g., up-down-up)
  const pauseDuration = 0.25;    // Pause at center
  const cycleDuration = (phaseDuration + pauseDuration) * 2; // Total cycle time
  const amplitude = isLowPerformanceMode ? 0 : 0.03; // No bounce animation in low perf mode
  
  // Helper: clean sine wave cycle
  function sineCycle(t) {
    return Math.sin(t * Math.PI * 2); // Starts and ends at 0
  }
  
  // Only animate if popup is not visible
  if (!popupState.isActive) {
    const t = time % cycleDuration;
    
    // Reset positions
    this.cube.position.x = 0;
    this.cube.position.y = 0;
    
    // Skip subtle animations in low performance mode
    if (!isLowPerformanceMode) {
      if (t < phaseDuration) {
        // Phase 1: up-down-up (Y axis)
        const progress = t / phaseDuration;
        this.cube.position.y = sineCycle(progress) * amplitude;
      } else if (t < phaseDuration + pauseDuration) {
        // Phase 2: pause in center (Y axis)
        this.cube.position.y = 0;
      } else if (t < 2 * phaseDuration + pauseDuration) {
        // Phase 3: left-right-left (X axis)
        const progress = (t - phaseDuration - pauseDuration) / phaseDuration;
        this.cube.position.x = sineCycle(progress) * amplitude;
      } else {
        // Phase 4: pause in center (X axis)
        this.cube.position.x = 0;
      }
    }
  } else {
    // Reset position when popup is shown
    this.cube.position.x = 0;
    this.cube.position.y = 0;
  }
  
  // Smooth rotation logic - less smooth in low performance mode for better performance
  const easing = isLowPerformanceMode ? this.easing * 1.5 : this.easing;
  this.cube.rotation.x += (this.targetRotation.x - this.cube.rotation.x) * easing;
  this.cube.rotation.y += (this.targetRotation.y - this.cube.rotation.y) * easing;
}
  
  getShuffledProjects() {
    return this.shuffledProjects;
  }
  
  getCurrentFaceIndex() {
    return this.currentFaceIndex;
  }
  
  getCube() {
    return this.cube;
  }
}