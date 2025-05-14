/**
 * OrientationHandler.js
 * Manages device orientation detection and displays appropriate messages
 */
class OrientationHandler {
  constructor() {
    this.orientationCheckEl = document.getElementById('orientation-check');
    this.isPortrait = false;
    this.isMobileOrTablet = false;
    this.landscapeOnly = true; // Set to true to enforce landscape mode on mobile/tablet
    
    // Initialize
    this.init();
  }
  
  init() {
    // Create tilt message element if it doesn't exist
    if (!this.orientationCheckEl) {
      this.orientationCheckEl = document.createElement('div');
      this.orientationCheckEl.id = 'orientation-check';
      document.body.appendChild(this.orientationCheckEl);
    }
    
    // Style the orientation check element
    this.styleOrientationMessage();
    
    // Initial check
    this.checkDeviceType();
    this.checkOrientation();
    
    // Set up event listeners
    window.addEventListener('resize', this.handleResize.bind(this));
    window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
  }
  
  /**
   * Style the orientation message element
   */
  styleOrientationMessage() {
    const style = this.orientationCheckEl.style;
    style.position = 'fixed';
    style.top = '0';
    style.left = '0';
    style.width = '100%';
    style.height = '100%';
    style.backgroundColor = '#000000';
    style.color = '#FFFFFF';
    style.display = 'none';
    style.flexDirection = 'column';
    style.justifyContent = 'center';
    style.alignItems = 'center';
    style.zIndex = '10000';
    style.textAlign = 'center';
    
    // Create and append the rotation icon
    const rotationIcon = document.createElement('div');
    rotationIcon.innerHTML = `
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M70 20H30C24.4772 20 20 24.4772 20 30V70C20 75.5228 24.4772 80 30 80H70C75.5228 80 80 75.5228 80 70V30C80 24.4772 75.5228 20 70 20Z" stroke="white" stroke-width="3"/>
        <path d="M40 50L60 50" stroke="white" stroke-width="3" stroke-linecap="round"/>
        <path d="M50 40L60 50L50 60" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    rotationIcon.style.marginBottom = '20px';
    rotationIcon.style.animation = 'rotate90 1.5s infinite';
    
    // Create animation style
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      @keyframes rotate90 {
        0% { transform: rotate(0deg); }
        50% { transform: rotate(-90deg); }
        100% { transform: rotate(0deg); }
      }
    `;
    document.head.appendChild(styleSheet);
    
    // Create message text
    const messageText = document.createElement('h2');
    messageText.textContent = 'PLEASE ROTATE YOUR DEVICE';
    messageText.style.fontSize = '24px';
    messageText.style.fontWeight = 'bold';
    
    // Create subtitle text
    const subtitleText = document.createElement('p');
    subtitleText.textContent = 'This experience works best in landscape mode';
    subtitleText.style.fontSize = '16px';
    subtitleText.style.marginTop = '10px';
    
    // Add elements to orientation check div
    this.orientationCheckEl.innerHTML = '';
    this.orientationCheckEl.appendChild(rotationIcon);
    this.orientationCheckEl.appendChild(messageText);
    this.orientationCheckEl.appendChild(subtitleText);
  }
  
  /**
   * Check if the device is mobile or tablet
   */
  checkDeviceType() {
    // Simple detection based on screen size and user agent
    const width = window.innerWidth;
    const height = window.innerHeight;
    const userAgent = navigator.userAgent.toLowerCase();
    
    const mobileKeywords = ['android', 'iphone', 'ipod', 'windows phone'];
    const tabletKeywords = ['ipad', 'tablet'];
    
    const isMobileByUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
    const isTabletByUA = tabletKeywords.some(keyword => userAgent.includes(keyword));
    
    // Consider it mobile/tablet if either UA indicates or screen size is small enough
    this.isMobileOrTablet = isMobileByUA || isTabletByUA || width <= 1024;
    
    return this.isMobileOrTablet;
  }
  
  /**
   * Check the current orientation
   */
  checkOrientation() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.isPortrait = height > width;
    
    // Show/hide orientation message based on device type and orientation
    if (this.isMobileOrTablet && this.isPortrait && this.landscapeOnly) {
      this.showOrientationMessage(true);
    } else {
      this.showOrientationMessage(false);
    }
    
    return this.isPortrait;
  }
  
  /**
   * Show or hide the orientation message
   * @param {boolean} show - Whether to show the message
   */
  showOrientationMessage(show) {
    this.orientationCheckEl.style.display = show ? 'flex' : 'none';
    
    // Hide/show the renderer and other UI elements
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.style.visibility = show ? 'hidden' : 'visible';
    }
    
    // Find and hide other UI elements when showing orientation message
    if (show) {
      const uiElements = document.querySelectorAll('.ui-element, #link-btn');
      uiElements.forEach(el => {
        el.style.visibility = 'hidden';
      });
    } else {
      const uiElements = document.querySelectorAll('.ui-element, #link-btn');
      uiElements.forEach(el => {
        el.style.visibility = 'visible';
      });
    }
    
    return show;
  }
  
  /**
   * Handle window resize event
   */
  handleResize() {
    this.checkDeviceType();
    this.checkOrientation();
  }
  
  /**
   * Handle orientation change event
   */
  handleOrientationChange() {
    // Small delay to ensure new dimensions are ready
    setTimeout(() => {
      this.checkOrientation();
    }, 100);
  }
  
  /**
   * Check if the app should be rendered now
   * Returns true if we should render, false if orientation message is shown
   */
  shouldRender() {
    if (this.isMobileOrTablet && this.isPortrait && this.landscapeOnly) {
      return false;
    }
    return true;
  }
}

export { OrientationHandler };