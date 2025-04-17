import * as THREE from 'three';

let scene, camera, renderer, cube;
let isDragging = false;
let startX = 0;
let startY = 0;
let currentFaceIndex = 0;

let targetRotation = { x: 0, y: 0 };
let easing = 0.1;

const loader = new THREE.TextureLoader();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();


const projects = [
  { image: '/dogmeditate.jpg', video: '', link: 'https://github.com/you/project1', name: 'Youtube Clip Discord Bot' },
  { image: '/fish.jpg', video: '', link: 'https://github.com/you/project2' },
  { image: '/catcreeper.jpg', video: '', link: 'https://github.com/you/project3' },
  { image: '/DD.jpg', video: '', link: 'https://github.com/you/project4' },
  { image: '/lego-sleep.jpg', video: '', link: 'https://github.com/you/project5' },
  { image: '/lime.jpg', video: '', link: 'https://github.com/you/project6' }
];

// Shuffle and assign 6 random projects
const shuffled = projects.sort(() => 0.5 - Math.random()).slice(0, 6);

// Function to create a material with high-quality texture
async function createMaterial(imagePath) {
  const texture = await loader.loadAsync(imagePath);
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;

  return new THREE.MeshBasicMaterial({ map: texture });
}

const video = document.createElement('video');
video.src = '/video.mp4'; // Replace with your actual video path
video.loop = true;
video.muted = true;
video.playsInline = true;
video.autoplay = true;
video.crossOrigin = 'anonymous';
video.load();
video.play().catch(e => console.warn('Autoplay failed:', e));

const videoTexture = new THREE.VideoTexture(video);
videoTexture.colorSpace = THREE.SRGBColorSpace;
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;
videoTexture.generateMipmaps = false;

const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });

init();

let materials = [];
Promise.all(shuffled.map(p => createMaterial(p.image))).then((loadedMaterials) => {
  materials = loadedMaterials;
  // Create the base cube
  cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials);
  scene.add(cube);
  updateLink(0); // Start with front face (index 4 in Three.js)
  animate();
});


function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 2.5;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio); // important!
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // Prevent color distortion
  document.body.appendChild(renderer.domElement);

  // updateLink(0); // Start with front face (index 4 in Three.js)

  // Click Event
  window.addEventListener('click', onClick);

  // Mouse controls
  window.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    snapRotation();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    targetRotation.y += deltaX * 0.005;
    targetRotation.x += deltaY * 0.005;

    startX = e.clientX;
    startY = e.clientY;
  });

  // Touch controls
  window.addEventListener('touchstart', (e) => {
    isDragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  });

  window.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const deltaX = e.touches[0].clientX - startX;
    const deltaY = e.touches[0].clientY - startY;

    targetRotation.y += deltaX * 0.005;
    targetRotation.x += deltaY * 0.005;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  });

  window.addEventListener('touchend', () => {
    isDragging = false;
    snapRotation();
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function snapRotation() {
  const snappedX = Math.round(targetRotation.x / (Math.PI / 2)) * (Math.PI / 2);
  const snappedY = Math.round(targetRotation.y / (Math.PI / 2)) * (Math.PI / 2);
  targetRotation.x = snappedX;
  targetRotation.y = snappedY;

  currentFaceIndex = getFrontFaceIndex(snappedX, snappedY);
  updateLink(currentFaceIndex);
}

function getFrontFaceIndex(rotX, rotY) {
  const x = ((Math.round(rotX / (Math.PI / 2)) % 4) + 4) % 4;
  const y = ((Math.round(rotY / (Math.PI / 2)) % 4) + 4) % 4;

  // Face order: 
  // 0: right, 1: left, 2: top, 3: bottom, 4: front, 5: back
  if (x === 1) return 2; // top
  if (x === 3) return 3; // bottom
  if (y === 0) return 4; // front
  if (y === 1) return 0; // right
  if (y === 2) return 5; // back
  if (y === 3) return 1; // left
}

function updateLink(faceIndex) {

  // remove previous popup if face does not match
  if (popupPlane && currentFaceIndex !== faceIndex) {
    scene.remove(popupPlane); // make sure it's removed from the right parent
    popupPlane = null;
  }

  const project = shuffled[faceIndex];
  const linkEl = document.getElementById('link-btn');
  if (project && linkEl) {
    linkEl.href = project.link;
    linkEl.textContent = `View Repo: ${project.name}`; // add github svg?
  }
}

// Click Func

function onClick(event) {
  if (isDragging) return; // don't trigger on drag

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(cube, false);

  if (intersects.length > 0) {
    const faceIndex = Math.floor(intersects[0].faceIndex / 2);
    showPopupPlane(faceIndex);
  }
}

// Popup Plane Func

let popupPlane;

function showPopupPlane(faceIndex) {
  if (popupPlane) {
    cube.remove(popupPlane);
    popupPlane = null;
    return;
  }

  const project = shuffled[faceIndex];
  const popupWidth = 1.8;
  const popupHeight = 1;

  const geometry = new THREE.PlaneGeometry(popupWidth, popupHeight);
  const material = faceIndex === 0 ? videoMaterial : new THREE.MeshBasicMaterial({ map: materials[faceIndex].map });

  popupPlane = new THREE.Mesh(geometry, material);

  // Position popup in front of the clicked face
  const offset = 0.61; // slightly in front of cube
  const positions = [
    [offset, 0, 0],     // right
    [-offset, 0, 0],    // left
    [0, offset, 0],     // top
    [0, -offset, 0],    // bottom
    [0, 0, offset],     // front
    [0, 0, -offset]     // back
  ];
  const rotation = [
    [0, -Math.PI / 2, 0],
    [0, Math.PI / 2, 0],
    [-Math.PI / 2, 0, 0],
    [Math.PI / 2, 0, 0],
    [0, 0, 0],
    [0, Math.PI, 0],
  ];

  popupPlane.position.set(...positions[faceIndex]);
  popupPlane.rotation.set(...rotation[faceIndex]);

  cube.add(popupPlane);
}


function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += (targetRotation.x - cube.rotation.x) * easing;
  cube.rotation.y += (targetRotation.y - cube.rotation.y) * easing;
  renderer.render(scene, camera);
}
