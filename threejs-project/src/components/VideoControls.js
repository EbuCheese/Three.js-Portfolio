import * as THREE from 'three';
import { gsap } from 'gsap';
import { popupWidth, popupHeight } from './PopupPlane';

// Constants
const controlsWidthRatio = 1;  
const controlsHeight = 0.1; 

class VideoControls {
  constructor(cube, renderer, camera) {
    this.cube = cube;
    this.renderer = renderer;
    this.camera = camera;
    this.controls = null;
    this.currentVideo = null;
    this.videoDuration = 0;
    this.videoCurrentTime = 0;
    this.isVisible = true;
    this.isActive = false;
    this.isPlaying = true;
    this.isMuted = true;
    this.buttons = {};
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }

  /**
   * Add video controls to the popup plane
   * @param {HTMLVideoElement} videoElement - The video element to control
   * @param {THREE.Mesh} popupPlane - The popup plane to attach controls to
   * @param {Object} popupState - Current state of the popup
   */
  add(videoElement, popupPlane, popupState) {
    // Check if animations are in progress
    if (popupState.isAnimating) {
      console.log("Add video controls ignored - animation in progress");
      return;
    }

    this.remove();
    
    // Store reference to current video
    this.currentVideo = videoElement;
    this.videoDuration = videoElement.duration || 0;
    this.videoCurrentTime = videoElement.currentTime || 0;
    
    // Reset video state when opening popup
    this.isPlaying = true;
    videoElement.play().catch(e => console.warn("Failed to play video:", e));
    this.isMuted = true;
    videoElement.muted = true;
    this.isVisible = true;

    // Create controls texture
    const { texture, canvas } = this.createControlsTexture();
    
    // Create plane for controls
    const controlsWidth = popupWidth * controlsWidthRatio;
    const controlsGeometry = new THREE.PlaneGeometry(controlsWidth, controlsHeight);
    const controlsMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    
    this.controls = new THREE.Mesh(controlsGeometry, controlsMaterial);
    
    // Position controls at the bottom of the video
    this.controls.position.copy(popupPlane.position);
    this.controls.rotation.copy(popupPlane.rotation);
    
    const isMobile = window.innerWidth <= 900;

    // Offset to bottom of video
    const localOffset = isMobile ? new THREE.Vector3(0, -popupHeight/2 + -0.045, 0.001) : new THREE.Vector3(0, -popupHeight/2 + 0.05, 0.001) ;
    this.controls.position.add(
      localOffset.applyQuaternion(popupPlane.quaternion)
    );

    // For mobile, make controls larger
    if (isMobile) {
      // Scale up controls for mobile - use same factor as popup
      this.controls.scale.set(1.2, 1.15, 1.2);
    } else {
      // Normal scale for desktop
      this.controls.scale.set(1, 1, 1);
    }

    // Ensure controls are visible and properly sized from the start
    this.controls.visible = this.isVisible; 
    this.controls.renderOrder = 1000; // Ensure it renders on top
    
    this.cube.add(this.controls);
    
    console.log("Video controls added:", {
      controlsVisible: this.controls.visible,
      controlsPosition: this.controls.position,
      videoDuration: this.videoDuration
    });
    
    // Update video controls canvas when video time updates
    videoElement.addEventListener('timeupdate', this.updateProgress.bind(this));
    
    // Get video duration once it's loaded
    if (isNaN(videoElement.duration) || videoElement.duration === 0) {
      videoElement.addEventListener('loadedmetadata', () => {
        this.videoDuration = videoElement.duration;
        console.log("Video metadata loaded, duration:", this.videoDuration);
        this.update();
      });
    }
    
    this.isActive = true;
  }

  /**
   * Create the texture for video controls
   * @returns {Object} The texture and canvas
   */
  createControlsTexture() {
    // Create a canvas for our controls
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background with gradient for a more refined look
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(20, 20, 20, 0.7)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Make the hide button larger to match the play and mute buttons
    const playButtonRect = { x: 16, y: 8, width: 48, height: 48 };
    const muteButtonRect = { x: 70, y: 5, width: 48, height: 48 };
    const progressBarRect = { x: 145, y: 24, width: 690, height: 16 };
    const hideButtonRect = { x: 850, y: 5, width: 48, height: 48 }; 

    // Store these for interaction
    this.buttons = {
      play: playButtonRect,
      mute: muteButtonRect,
      progress: progressBarRect,
      hide: hideButtonRect
    };
    
    // Function to draw a glowing element
    const drawGlow = (drawFunc) => {
      // Draw the cyan glow shadow
      ctx.save();
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 1.25;
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = '#00ffff';
      drawFunc(true); // true = draw glow
      ctx.restore();
      
      // Draw the white content
      ctx.fillStyle = '#ffffff';
      drawFunc(false); // false = draw content
    };

    // Draw Play button with glow
    drawGlow((isGlow) => {
      if (this.isPlaying) {
        // Pause icon
        if (isGlow) {
          ctx.strokeRect(playButtonRect.x + 15, playButtonRect.y + 12, 7, 26);
          ctx.strokeRect(playButtonRect.x + 28, playButtonRect.y + 12, 7, 26);
        } else {
          ctx.fillRect(playButtonRect.x + 15, playButtonRect.y + 12, 7, 26);
          ctx.fillRect(playButtonRect.x + 28, playButtonRect.y + 12, 7, 26);
        }
      } else {
        // Play triangle
        ctx.beginPath();
        ctx.moveTo(playButtonRect.x + 16, playButtonRect.y + 7);
        ctx.lineTo(playButtonRect.x + 16, playButtonRect.y + 40);
        ctx.lineTo(playButtonRect.x + 36, playButtonRect.y + 24);
        ctx.closePath();
        if (isGlow) {
          ctx.stroke();
        } else {
          ctx.fill();
        }
      }
    });
    
    // Draw Mute button with glow
    drawGlow((isGlow) => {
      // Speaker base (rectangle)
      if (isGlow) {
        ctx.strokeRect(muteButtonRect.x + 12, muteButtonRect.y + 22, 13, 13);
      } else {
        ctx.fillRect(muteButtonRect.x + 12, muteButtonRect.y + 22, 13, 13);
      }
      
      // Speaker cone (triangle)
      ctx.beginPath();
      ctx.moveTo(muteButtonRect.x + 15, muteButtonRect.y + 24);  // Top connection
      ctx.lineTo(muteButtonRect.x + 25, muteButtonRect.y + 10);  // Top point
      ctx.lineTo(muteButtonRect.x + 25, muteButtonRect.y + 44);  // Bottom point
      ctx.lineTo(muteButtonRect.x + 15, muteButtonRect.y + 32);  // Bottom connection
      ctx.closePath();
      
      if (isGlow) {
        ctx.stroke();
      } else {
        ctx.fill();
      }
      
      const waveOffsetX = -3;
      const waveOffsetY = 2;

      // Sound waves or X
      if (!this.isMuted) {
        // Sound waves
        if (!isGlow) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
        }
        
        // First wave
        ctx.beginPath();
        ctx.moveTo(
          muteButtonRect.x + 34 + waveOffsetX,
          muteButtonRect.y + 21 + waveOffsetY
        );
        ctx.quadraticCurveTo(
          muteButtonRect.x + 38 + waveOffsetX,
          muteButtonRect.y + 25 + waveOffsetY,
          muteButtonRect.x + 34 + waveOffsetX,
          muteButtonRect.y + 29 + waveOffsetY
        );
        ctx.stroke();

        // Second wave
        ctx.beginPath();
        ctx.moveTo(
          muteButtonRect.x + 37 + waveOffsetX,
          muteButtonRect.y + 18 + waveOffsetY
        );
        ctx.quadraticCurveTo(
          muteButtonRect.x + 43 + waveOffsetX,
          muteButtonRect.y + 25 + waveOffsetY,
          muteButtonRect.x + 37 + waveOffsetX,
          muteButtonRect.y + 32 + waveOffsetY
        );
        ctx.stroke();

        // Third wave
        ctx.beginPath();
        ctx.moveTo(
          muteButtonRect.x + 40 + waveOffsetX,
          muteButtonRect.y + 15 + waveOffsetY
        );
        ctx.quadraticCurveTo(
          muteButtonRect.x + 48 + waveOffsetX,
          muteButtonRect.y + 25 + waveOffsetY,
          muteButtonRect.x + 40 + waveOffsetX,
          muteButtonRect.y + 35 + waveOffsetY
        );
        ctx.stroke();
      } else {
        // X mark
        if (!isGlow) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
        }
        
        ctx.beginPath();
        ctx.moveTo(
          muteButtonRect.x + 34 + waveOffsetX,
          muteButtonRect.y + 17 + waveOffsetY
        );
        ctx.lineTo(
          muteButtonRect.x + 42 + waveOffsetX,
          muteButtonRect.y + 33 + waveOffsetY
        );
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(
          muteButtonRect.x + 42 + waveOffsetX,
          muteButtonRect.y + 17 + waveOffsetY
        );
        ctx.lineTo(
          muteButtonRect.x + 34 + waveOffsetX,
          muteButtonRect.y + 33 + waveOffsetY
        );
        ctx.stroke();
      }
    });

    // Draw hide/show button with glow
    drawGlow((isGlow) => {
      if (this.isVisible) {
        // Down arrow (to indicate hiding)
        ctx.beginPath();
        ctx.moveTo(hideButtonRect.x + 12, hideButtonRect.y + 18);
        ctx.lineTo(hideButtonRect.x + 36, hideButtonRect.y + 18);
        ctx.lineTo(hideButtonRect.x + 24, hideButtonRect.y + 30);
        ctx.closePath();
        
        if (isGlow) {
          ctx.stroke();
        } else {
          ctx.fill();
        }
        
        // Line at bottom
        if (isGlow) {
          ctx.strokeRect(hideButtonRect.x + 12, hideButtonRect.y + 35, 24, 3);
        } else {
          ctx.fillRect(hideButtonRect.x + 12, hideButtonRect.y + 35, 24, 3);
        }
      } else {
        // Up arrow (to indicate showing)
        ctx.beginPath();
        ctx.moveTo(hideButtonRect.x + 12, hideButtonRect.y + 30);
        ctx.lineTo(hideButtonRect.x + 36, hideButtonRect.y + 30); 
        ctx.lineTo(hideButtonRect.x + 24, hideButtonRect.y + 18);
        ctx.closePath();
        
        if (isGlow) {
          ctx.stroke();
        } else {
          ctx.fill();
        }
        
        // Line at bottom
        if (isGlow) {
          ctx.strokeRect(hideButtonRect.x + 12, hideButtonRect.y + 35, 24, 3);
        } else {
          ctx.fillRect(hideButtonRect.x + 12, hideButtonRect.y + 35, 24, 3);
        }
      }
    });
    
    // Progress bar with glow
    // First draw the background
    ctx.fillStyle = '#333333';
    ctx.fillRect(progressBarRect.x, progressBarRect.y, progressBarRect.width, progressBarRect.height);
    
    // Draw glow for progress bar outline
    ctx.save();
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 1.5;
    ctx.strokeStyle = '#00ffff';
    ctx.strokeRect(progressBarRect.x, progressBarRect.y, progressBarRect.width, progressBarRect.height);
    ctx.restore();
    
    // Progress indicator with glow
    if (this.videoDuration > 0) {
      const progress = this.videoCurrentTime / this.videoDuration;
      const progressWidth = progressBarRect.width * progress;
      
      // Draw the glowing progress fill
      ctx.save();
      ctx.shadowColor = '#daf7fe';
      ctx.shadowBlur = 1.5;
      const progressGradient = ctx.createLinearGradient(
        progressBarRect.x, 
        progressBarRect.y, 
        progressBarRect.x + progressWidth, 
        progressBarRect.y
      );
      progressGradient.addColorStop(0, '#daf7fe');
      progressGradient.addColorStop(1, '#00ffff');
      ctx.fillStyle = progressGradient;
      ctx.fillRect(
        progressBarRect.x, 
        progressBarRect.y, 
        progressWidth, 
        progressBarRect.height
      );
      ctx.restore();
    }
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    return { texture, canvas };
  }

  /**
   * Handle click event on video controls
   * @param {Event} event - The click event
   * @param {Object} popupState - Current state of the popup
   * @returns {boolean} True if the event was handled by video controls
   */
  handleClick(event, popupState) {
    if (!this.isActive || !this.controls || !this.currentVideo) {
      return false;
    }

    if (!this.isVisible) {
      return false;
    }
    
    // Check if animation is in progress
    if (popupState.isAnimating) {
      return false;
    }
    
    console.log('testing video control handler click')
    console.log(this.isActive, this.isVisible);
    
    // Convert screen coordinates to normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the ray with new mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Check for intersections with controls
    const intersects = this.raycaster.intersectObject(this.controls);
    
    if (intersects.length > 0) {
      console.log("Hit video controls at UV:", intersects[0].uv);
      
      // Get hit point in UV coordinates (0-1)
      const uv = intersects[0].uv;
      
      // Convert to pixel coordinates on our canvas
      const x = uv.x * 900;
      const y = (1 - uv.y) * 64;
      
      console.log("Click position on controls:", x, y);
      
      // Check which button was clicked
      if (this.isPointInRect(x, y, this.buttons.play)) {
        console.log("Play/pause button clicked");
        this.togglePlayback();
        
      } else if (this.isPointInRect(x, y, this.buttons.mute)) {
        console.log("Mute button clicked");
        this.toggleMute();
        
      } else if (this.isPointInRect(x, y, this.buttons.progress)) {
        console.log("Progress bar clicked");
        const progress = (x - this.buttons.progress.x) / this.buttons.progress.width;
        this.seek(progress);
      } else if (this.isPointInRect(x, y, this.buttons.hide)) {
        console.log("Hide/show button clicked");
        this.toggleVisibility(popupState);
      }
      
      // Prevent the event from being processed further
      event.stopPropagation();
      return true;
    }
    
    return false;
  }

  /**
   * Check if a point is within a rectangle
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} rect - Rectangle with x, y, width, height
   * @returns {boolean} True if point is in rect
   */
  isPointInRect(x, y, rect) {
    return (
      x >= rect.x && 
      x <= rect.x + rect.width && 
      y >= rect.y && 
      y <= rect.y + rect.height
    );
  }

  /**
   * Toggle visibility of controls
   * @param {Object} popupState - Current state of the popup
   */
  toggleVisibility(popupState) {
    // Don't toggle if animation is in progress
    if (popupState.isAnimating) {
      console.log("Toggle controls ignored - animation in progress");
      return;
    }

    this.isVisible = !this.isVisible;
    console.log('video controls visible: ', this.isVisible);

    if (this.controls) {
    // Get the current X scale which contains our mobile adjustment if applicable
    const currentXScale = this.controls.scale.x;
    
    if (this.isVisible) {
      // Show controls with animation
      this.controls.visible = true;
      gsap.fromTo(this.controls.scale, 
        { y: 0 },
        { 
          y: currentXScale, // Use the same scale as X (1.2 for mobile, 1.0 for desktop)
          duration: 0.3, 
          ease: "back.out(1.7)" 
        }
      );
    } else {
      // Hide controls with animation
      gsap.to(this.controls.scale, {
        y: 0,
        duration: 0.3,
        ease: "back.in(1.7)",
        onComplete: () => {
          if (this.controls) {
            this.controls.visible = false;
          }
        }
      });
    }
    
    // Update the control panel UI (show/hide button)
    this.update();
  }
}

  /**
   * Toggle video playback
   */
  togglePlayback() {
    if (!this.currentVideo) return;
    
    if (this.isPlaying) {
      this.currentVideo.pause();
      this.isPlaying = false;
    } else {
      this.currentVideo.play().catch(e => console.warn("Failed to play video:", e));
      this.isPlaying = true;
    }
    
    this.update();
  }

  /**
   * Toggle video mute state
   */
  toggleMute() {
    if (!this.currentVideo) return;
    
    this.isMuted = !this.isMuted;
    this.currentVideo.muted = this.isMuted;
    this.update();
  }

  /**
   * Seek to position in video
   * @param {number} progress - Position to seek to (0-1)
   */
  seek(progress) {
    if (!this.currentVideo || !this.videoDuration) return;
    
    // Clamp progress between 0 and 1
    progress = Math.max(0, Math.min(1, progress));
    
    // Set current time
    this.currentVideo.currentTime = progress * this.videoDuration;
    this.videoCurrentTime = this.currentVideo.currentTime;
    
    this.update();
  }

  /**
   * Update progress bar based on current video time
   */
  updateProgress() {
    if (!this.currentVideo) return;
    this.videoCurrentTime = this.currentVideo.currentTime;
    this.update();
  }

  /**
   * Update the controls texture with current state
   */
  update() {
    if (!this.controls) return;
    
    const { texture } = this.createControlsTexture();
    this.controls.material.map = texture;
    this.controls.material.needsUpdate = true;
  }

  /**
   * Remove video controls
   */
  remove() {
    // Immediately mark controls as inactive
    this.isActive = false;
    
    // First check if we have controls to remove
    if (this.controls && this.cube.children.includes(this.controls)) {
      // Remove video element event listeners first
      if (this.currentVideo) {
        this.currentVideo.removeEventListener('timeupdate', this.updateProgress.bind(this));
        this.currentVideo = null;
      }
      
      // Animate out and remove
      gsap.to(this.controls.scale, {
        x: 0, 
        y: 0,
        z: 0,
        duration: 0.2,
        ease: "back.in(1.7)",
        onComplete: () => {
          // Double check if controls is still in the scene
          if (this.controls && this.cube.children.includes(this.controls)) {
            this.cube.remove(this.controls);
          }
          this.controls = null;
          this.isVisible = true; // Reset for next video
        }
      });
    } else {
      // No video controls exist, or they've already been removed
      this.controls = null;
      this.isVisible = true; // Reset for next video
      
      // Still need to clean up video event listeners
      if (this.currentVideo) {
        this.currentVideo.removeEventListener('timeupdate', this.updateProgress.bind(this));
        this.currentVideo = null;
      }
    }
  }

  /**
   * Update in animation loop
   */
  animate() {
    // Update video progress in the animation loop if active
    if (this.isActive && this.currentVideo) {
      if (this.videoCurrentTime !== this.currentVideo.currentTime) {
        this.videoCurrentTime = this.currentVideo.currentTime;
        this.update();
      }
    }
  }
}

export { VideoControls };