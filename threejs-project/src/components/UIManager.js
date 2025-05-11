// UIManager.js
export class UIManager {
  constructor(app) {
    this.app = app;
  }
  
  init() {
    this.setupHelpPanel();
    this.setupBackgroundSelector();
  }
  
  setupHelpPanel() {
    const helpButton = document.getElementById('help-button');
    const helpPanel = document.getElementById('help-panel');
    
    if (!helpButton || !helpPanel) return;
    
    // Show help info on click
    helpButton.addEventListener('click', () => {
      helpPanel.classList.toggle('show');
    });
  }
  
  setupBackgroundSelector() {
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
    const cursor = document.getElementById('custom-cursor');
    if (cursor) {
      optionsList.addEventListener('mouseenter', () => {
        cursor.classList.add('cursor-square');
      });
      
      optionsList.addEventListener('mouseleave', () => {
        cursor.classList.remove('cursor-square');
      });
    }
    
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
        this.app.cubeController.updateSceneEnvironment(
          selectedValue, 
          () => this.app.hidePopup(), 
          (faceIndex) => this.updateLink(faceIndex)
        );
        
        // Prevent bgSelector click from also toggling the dropdown again
        e.stopPropagation();
      });
    });
    
    // Initial environment update
    this.app.cubeController.updateSceneEnvironment(
      defaultBg, 
      () => this.app.hidePopup(), 
      (faceIndex) => this.updateLink(faceIndex)
    );
  }
  
  // update the link for popupPlane
  updateLink(faceIndex) {
    const { popupPlaneController, cubeController } = this.app;
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
}