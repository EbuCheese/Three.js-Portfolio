import * as THREE from 'three';
import { gsap } from 'gsap';
import { VideoControls } from './VideoControls';

// Constants
const popupWidth = 2;
const popupHeight = 1;
const borderThickness = 0.04;

// Geometry for the planes
const popupGeometry = new THREE.PlaneGeometry(popupWidth, popupHeight, 4, 4);
const borderGeometry = new THREE.PlaneGeometry(popupWidth + borderThickness, popupHeight + borderThickness, 4, 4);
const shadowGeometry = new THREE.PlaneGeometry(popupWidth + 0.1, popupHeight + 0.1, 4, 4);

// Glow material for the border
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

// Cube face positions mapping
const CUBE_FACES = {
  RIGHT: 0,  // +X
  LEFT: 1,   // -X
  TOP: 2,    // +Y
  BOTTOM: 3, // -Y
  FRONT: 4,  // +Z
  BACK: 5    // -Z
};

class PopupPlane {
  constructor(cube, renderer, bloomPass, camera) {
    this.cube = cube;
    this.renderer = renderer;
    this.bloomPass = bloomPass;
    this.camera = camera;
    this.popupPlane = null;
    this.borderPlane = null;
    this.shadowPlane = null;
    this.isPopupActive = false;
    this.openedFaceIndex = null;
    this.originalBloomStrength = 0.2;
    this.isClosing = false;
    this.isOpening = false;
    this.animationDelay = 650; // Animation cooldown in ms
    this.lastAnimationTime = 0;

    this.videoControls = new VideoControls(cube, renderer, camera);

    // Preload materials to improve performance
    this.borderMaterial = glowPlaneMaterial.clone();
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35
    });

    // Positions and rotations for each face
    this.positions = [
      [0.61, 0, 0], [-0.61, 0, 0],
      [0, 0.61, 0], [0, -0.61, 0],
      [0, 0, 0.61], [0, 0, -0.61]
    ];
    
    this.rotations = [
      [0, Math.PI / 2, 0], [0, -Math.PI / 2, 0],
      [-Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0],
      [0, 0, 0], [0, Math.PI, 0]
    ];

    // Loader for textures
    this.loader = new THREE.TextureLoader();
  }

  /**
   * Show popup plane for the specified face index
   * @param {number} faceIndex - Index of the face to show popup for
   * @param {Array} projects - Array of project data
   * @param {Array} materials - Array of materials
   * @param {Function} onPopupShow - Callback when popup is shown
   * @param {Function} addVideoControls - Function to add video controls
   * @param {Function} updateLink - Function to update the link
   * @param {Function} snapRotation - Function to snap the cube rotation
   */
  showPopupPlane(faceIndex, projects, materials, onPopupShow, addVideoControls, updateLink, snapRotation) {
    // Remove the click hint element if on screen
    const clickHint = document.getElementById('click-hint');
    if (clickHint) {
      clickHint.remove();
    }

    const now = Date.now();
    if (now - this.lastAnimationTime < this.animationDelay) {
      console.log("Animation cooldown active, ignoring request");
      return;
    }

    if (this.isClosing || this.isOpening) {
      console.log("Animation already in progress, ignoring request");
      return;
    }

    this.openedFaceIndex = faceIndex;
    
    // If popup is already active, close it first
    if (this.popupPlane) {
      this.hidePopup();
      return;
    }

    this.isOpening = true;
    this.lastAnimationTime = now;

    this.bloomPass.strength = 0.12;

    const pos = this.positions[faceIndex];
    const rot = this.rotations[faceIndex];

    const project = projects[faceIndex];
    console.log('Popup debug - faceIndex:', faceIndex, 'project:', project);

    let material;
    let videoElement = null;

    if (project.video) {
      videoElement = document.createElement('video');
      videoElement.src = project.video;
      videoElement.loop = true;
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.autoplay = true;
      videoElement.crossOrigin = 'anonymous';
      videoElement.load();
      videoElement.play().catch(e => console.warn("Video failed:", e));

      const texture = new THREE.VideoTexture(videoElement);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

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
    this.popupPlane = new THREE.Mesh(
      popupGeometry,
      material
    );
    this.popupPlane.position.set(...pos);
    this.popupPlane.rotation.set(...rot);
    this.popupPlane.scale.set(0, 0, 0);
    this.popupPlane.renderOrder = 999;
    this.popupPlane.material.depthWrite = false;
    this.popupPlane.material.depthTest = false;

    this.popupPlane.material.polygonOffset = true;
    this.popupPlane.material.polygonOffsetFactor = -1;
    this.popupPlane.material.polygonOffsetUnits = -4;

    // --- BORDER PLANE
    this.borderPlane = new THREE.Mesh(
      borderGeometry,
      glowPlaneMaterial
    );
    this.borderPlane.position.set(...pos);
    this.borderPlane.rotation.set(...rot);
    this.borderPlane.scale.set(0, 0, 0);
    this.borderPlane.translateZ(-0.008); // just behind popupPlane
    this.borderPlane.renderOrder = 998;

    // --- SHADOW PLANE 
    this.shadowPlane = new THREE.Mesh(
      shadowGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.35 
      })
    );
    this.shadowPlane.position.set(...pos);
    this.shadowPlane.rotation.set(...rot);
    this.shadowPlane.scale.set(0, 0, 0);
    this.shadowPlane.translateZ(-0.015);
    this.shadowPlane.renderOrder = 997;

    this.cube.add(this.shadowPlane);
    this.cube.add(this.borderPlane);
    this.cube.add(this.popupPlane);

    this.isPopupActive = true;

    gsap.to([this.popupPlane.scale, this.borderPlane.scale, this.shadowPlane.scale], {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.6,
      ease: "back.out(1.7)",
      onComplete: () => {
        this.isPopupActive = true;
        this.isOpening = false;
        document.getElementById('link-btn').style.display = 'flex';
        updateLink(faceIndex);
        snapRotation();

        if (videoElement) {
          const popupState = this.getPopupState();
          this.videoControls.add(videoElement, this.popupPlane, popupState);
        }

        if (onPopupShow) onPopupShow();
      }
    });

    gsap.to(this.popupPlane.material, {
      opacity: 1,
      duration: 0.5,
      ease: "power2.out"
    });

    return this.popupPlane;
  }


/**
 * Force reset popup state - useful for handling edge cases
 */
resetPopupState() {
  // Clean up meshes if they exist
  if (this.popupPlane && this.cube.children.includes(this.popupPlane)) {
    this.cube.remove(this.popupPlane);
  }
  if (this.borderPlane && this.cube.children.includes(this.borderPlane)) {
    this.cube.remove(this.borderPlane);
  }
  if (this.shadowPlane && this.cube.children.includes(this.shadowPlane)) {
    this.cube.remove(this.shadowPlane);
  }
  
  // Reset all state
  this.popupPlane = null;
  this.borderPlane = null;
  this.shadowPlane = null;
  this.isPopupActive = false;
  this.openedFaceIndex = null;
  this.isClosing = false;
  this.isOpening = false;
  
  // Reset bloom
  this.bloomPass.strength = this.originalBloomStrength;
  
  // Make sure link is hidden
  const linkEl = document.getElementById('link-btn');
  if (linkEl) {
    linkEl.style.display = 'none';
  }
  
  console.log("Popup state forcibly reset");
}

 /**
   * Hide the popup plane
   * @param {Function} updateLink - Function to update link visibility
   */
 hidePopup(updateLink) {
  if (this.popupPlane && !this.isClosing) {
    this.isClosing = true; // Set closing flag
    this.isPopupActive = false;
    
    this.lastAnimationTime = Date.now();

    // Reset opened face index immediately
    const previousFaceIndex = this.openedFaceIndex;
    this.openedFaceIndex = null;
    
    // Reset bloom to default
    this.bloomPass.strength = 0.2;

    // First remove video controls if they exist
    this.videoControls.remove();

    // Hide link immediately if updateLink provided
    if (typeof updateLink === 'function') {
      updateLink(null); // Pass null to ensure it's hidden
    }

    // Safety measure - if animation takes too long, force reset
    const safetyTimeout = setTimeout(() => {
      if (this.isClosing) {
        console.log("Safety timeout triggered - forcibly resetting popup state");
        this.resetPopupState();
      }
    }, 1000); // 1 second timeout

    // Animate closing
    gsap.to([this.popupPlane.scale, this.borderPlane.scale, this.shadowPlane.scale], {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.4,
      ease: "back.in(1.7)"
    });

    gsap.to(this.popupPlane.material, {
      opacity: 0,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => {

        clearTimeout(safetyTimeout);
        // Clean up the meshes
        if (this.popupPlane && this.cube.children.includes(this.popupPlane)) {
          this.cube.remove(this.popupPlane);
        }
        if (this.borderPlane && this.cube.children.includes(this.borderPlane)) {
          this.cube.remove(this.borderPlane);
        }
        if (this.shadowPlane && this.cube.children.includes(this.shadowPlane)) {
          this.cube.remove(this.shadowPlane);
        }
        
        this.popupPlane = null;
        this.borderPlane = null;
        this.shadowPlane = null;
        
        // Clear closing flag when animation completes
        this.isClosing = false;
        
        // Hide the link button again to be super safe
        const linkEl = document.getElementById('link-btn');
          if (linkEl) {
            linkEl.style.display = 'none';
          }
        
        // Final updateLink call after everything is cleaned up
        if (typeof updateLink === 'function') {
          updateLink(null);
        }
      }
    });
  }
}
  /**
   * Get the current popup state
   * @returns {Object} Information about the current popup state
   */
  getPopupState() {
    return {
      isActive: this.isPopupActive,
      openedFaceIndex: this.openedFaceIndex,
      popupPlane: this.popupPlane,
      isClosing: this.isClosing,
      isOpening: this.isOpening,
      isAnimating: this.isClosing || this.isOpening,
      lastAnimationTime: this.lastAnimationTime
    };
  }

   /**
   * Handle click event on video controls
   * @param {Event} event - The click event
   * @returns {boolean} True if the event was handled by video controls
   */
   handleVideoControlClick(event) {
    const popupState = this.getPopupState();
    return this.videoControls.handleClick(event, popupState);
  }

  /**
   * Check if popup is currently in an animation state
   * @returns {boolean} True if popup is currently animating
   */
  isAnimating() {
    return this.isClosing || this.isOpening;
  }

  /**
   * Update bloom effect when popup is visible
   */
  updateBloom() {
    // This is still useful as a safety check in the animation loop
    if (this.isPopupActive && this.bloomPass.strength !== 0.12) {
      this.bloomPass.strength = 0.12; // Popup bloom value
    } else if (!this.isPopupActive && this.bloomPass.strength !== this.originalBloomStrength) {
      this.bloomPass.strength = this.originalBloomStrength; // Default bloom value
    }
  }

  /**
   * Update video controls in animation loop if active
   */
  animate() {
    // Allow the VideoControls class to handle its own animation updates
    this.videoControls.animate();
  }

}

export { PopupPlane, CUBE_FACES, popupWidth, popupHeight };