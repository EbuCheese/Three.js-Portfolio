# 🎨 3D Portfolio Cube (Three.js)

A visually engaging, interactive 3D portfolio built with Three.js. This project features a rotating cube where each face showcases a different project. Clicking on a face opens a preview popup with a video or image and a link to the project's repository or live site. The environment of the project features real world lighting through hdri's, material effects and bloom.

---

## 🚀 Features

- 🌐 3D rotating cube with mouse/touch and snapping interaction
- 🖼️ Randomized project face assignment on each load
- 🎥 Popup with embedded video preview and controls
- 🔗 Link to GitHub Repo
- 🌈 Postprocessing effects (e.g., bloom, depth of field)
- 🌍 Option to change environment with different real world lighting and materials 
- 📱 Responsive design for desktop and mobile
- 🎞️ Animated transitions between states using gsap

---

## 🧱 Tech Stack

- [Three.js](https://threejs.org/)
- GSAP (for animation)
- HTML5 + CSS3 (for project core and ui styles)
- JavaScript (ES6 Modules)

---

## 📂 Folder Structure

/public

└── # hdri's, background/cube images, popup videos

/src

├── main.js # starts the app

/components

├── Cube.js # Cube creation, project data, scene updater, cube interaction

├── EventManager.js # Manage touch, click, cursor events

├── OrientationHandler.js # Logic for checking orientation on mobile views

├── PopupPlane.js # Video preview popup logic

├── UIManager.js # Manages all UI elements in the project 

├── VideoControls.js # Logic for the video controls that sit on top of the PopupPlane

/controllers

├── Application.js # Ties all the logic togethor to initialize the three.js project with camera, post processing, performance, animations, mobile views and popups.

index.html # used for UI elements and their styles in the 3D environment

## ⚙️ Setup & Use for your own projects

1. Clone the repo:

```bash
git clone https://github.com/yourusername/3d-portfolio-cube.git
cd 3d-portfolio-cube
```
2. npm install

3. npm run dev

4. Add your own project data in Cube.js:

```javascript
this.projects = [
      { image: '/fish.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project2', name: 'Right (+X)' },
      { image: '/dogmeditate.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project1', name: 'Left (-X)' },
      { image: '/catcreeper.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project3', name: 'Top (+Y)' },
      { image: '/DD.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project4', name: 'Bottom (-Y)' },
      { image: '/lego-sleep.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project5', name: 'Front (+Z)' },
      { image: '/lime.jpg', video: '/testvid.mp4', link: 'https://github.com/you/project6', name: 'Back (-Z)' }
    ];
```
