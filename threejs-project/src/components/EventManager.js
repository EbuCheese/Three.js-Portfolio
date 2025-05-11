// EventManager.js
export class EventManager {
  constructor(app) {
    this.app = app;
    this.cursor = null;
  }
  
  init() {
    this.createCustomCursor();
    this.setupMouseEvents();
    this.setupTouchEvents();
    this.setupVideoControlEvents();
  }
  
  createCustomCursor() {
    // Create custom cursor
    this.cursor = document.createElement('div');
    this.cursor.id = 'custom-cursor';
    document.body.appendChild(this.cursor);
    
    // When cursor hovers a clickable elem
    document.querySelectorAll('a, button, .clickable').forEach(el => {
      el.addEventListener('mouseenter', () => {
        this.cursor.classList.add('hovering');
      });
      
      el.addEventListener('mouseleave', () => {
        this.cursor.classList.remove('hovering');
      });
    });
  }
  
  setupMouseEvents() {
    window.addEventListener('mousedown', this.handleMouseDown.bind(this));
    window.addEventListener('mouseup', this.handleMouseUp.bind(this));
    window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    window.addEventListener('dblclick', this.handleDoubleClick.bind(this));
    window.addEventListener('click', this.handleClick.bind(this));
  }
  
  setupTouchEvents() {
    window.addEventListener('touchstart', this.handleTouchStart.bind(this));
    window.addEventListener('touchmove', this.handleTouchMove.bind(this));
    window.addEventListener('touchend', this.handleTouchEnd.bind(this));
  }
  
  setupVideoControlEvents() {
    // No need to add more events as click and dblclick are already handled
  }
  
  // Check if the click was on a UI element
  isClickOnUI(event) {
    const ignoredElements = ['bg-selector', 'help-button', 'help-panel', 'link-btn', 'click-hint', 'scroll-hint'];
    return ignoredElements.some(id => {
      const el = document.getElementById(id);
      return el && (el.contains(event.target) || event.target === el);
    });
  }
  
  handleMouseDown(event) {
    const { cubeController, popupPlaneController } = this.app;
    cubeController.handleMouseDown(
      event, 
      this.isClickOnUI.bind(this), 
      popupPlaneController.getPopupState()
    );
  }
  
  handleMouseUp(event) {
    const { cubeController } = this.app;
    cubeController.handleMouseUp(event, this.cursor, this.isClickOnUI.bind(this));
  }
  
  handleMouseMove(event) {
    const { cubeController, popupPlaneController } = this.app;
    cubeController.handleMouseMove(
      event, 
      this.cursor, 
      this.isClickOnUI.bind(this), 
      popupPlaneController.getPopupState()
    );
  }
  
  handleTouchStart(event) {
    const { cubeController, popupPlaneController } = this.app;
    cubeController.handleTouchStart(
      event, 
      this.isClickOnUI.bind(this), 
      popupPlaneController.getPopupState()
    );
  }
  
  handleTouchMove(event) {
    const { cubeController, popupPlaneController } = this.app;
    cubeController.handleTouchMove(
      event, 
      this.isClickOnUI.bind(this), 
      popupPlaneController.getPopupState()
    );
  }
  
  handleTouchEnd(event) {
    const { cubeController } = this.app;
    cubeController.handleTouchEnd(event, this.isClickOnUI.bind(this));
  }
  
  handleClick(event) {
    const { cubeController, popupPlaneController, raycaster, mouse, camera } = this.app;
    
    // Check if we're in the middle of a drag operation or clicking on UI elements
    if (cubeController.isDragging || this.isClickOnUI(event)) {
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
  
  handleDoubleClick(event) {
    const { cubeController, popupPlaneController } = this.app;
    
    if (this.isClickOnUI(event)) {
      return;
    }
    
    cubeController.handleDoubleClick(
      event,
      this.isClickOnUI.bind(this),
      popupPlaneController,
      (faceIndex) => this.app.showPopupPlane(faceIndex),
      () => this.app.hidePopup()
    );
  }
}