import * as THREE from 'three';

let scene, camera, renderer, cube;
let isDragging = false;
let startX = 0;
let startY = 0;
let currentFaceIndex = 0;

let targetRotation = { x: 0, y: 0 };
let easing = 0.1;

const loader = new THREE.TextureLoader();

const projects = [
  { image: '/DD.jpg', link: 'https://github.com/you/project1', name: 'Daredevil Clip Discord Bot' },
  { image: '/dogmeditate.jpg', link: 'https://github.com/you/project3' },
  { image: '/dogmeditate.jpg', link: 'https://github.com/you/project3' },
  { image: '/dogmeditate.jpg', link: 'https://github.com/you/project4' },
  { image: '/dogmeditate.jpg', link: 'https://github.com/you/project5' },
  { image: '/dogmeditate.jpg', link: 'https://github.com/you/project6' }
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



let materials = [];
Promise.all(shuffled.map(p => createMaterial(p.image))).then((loadedMaterials) => {
  materials = loadedMaterials;
  cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials);
  scene.add(cube);
});

init();
animate();

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 2.5;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // Prevent color distortion
  document.body.appendChild(renderer.domElement);

  const geometry = new THREE.BoxGeometry(1, 1, 1);

  updateLink(0); // Start with front face (index 4 in Three.js)

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
  const project = shuffled[faceIndex];
  const linkEl = document.getElementById('link-btn');
  if (project && linkEl) {
    linkEl.href = project.link;
    linkEl.textContent = `View Project: ${project.name}`;
  }
}



function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += (targetRotation.x - cube.rotation.x) * easing;
  cube.rotation.y += (targetRotation.y - cube.rotation.y) * easing;
  renderer.render(scene, camera);
}
