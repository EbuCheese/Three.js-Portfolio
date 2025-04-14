import * as THREE from 'three';

let scene, camera, renderer, cube;
let isDragging = false;
let startX = 0;
let rotationY = 0;
let currentFaceIndex = 0;

const loader = new THREE.TextureLoader();
const projects = [
  { image: '/dogmeditate.jpg', link: 'https://github.com/you/project1' },
  { image: '/dogmeditate.jpg', link: 'https://github.com/you/project2' },
  { image: '/dogmeditate.jpg', link: 'https://github.com/you/project3' },
  { image: '/dogmeditate.jpg', link: 'https://github.com/you/project4' },
  { image: '/dogmeditate.jpg', link: 'https://github.com/you/project5' },
  { image: '/dogmeditate.jpg', link: 'https://github.com/you/project6' }
];

// Shuffle and assign
const shuffled = projects.sort(() => 0.5 - Math.random()).slice(0, 6);
const materials = shuffled.map(p => 
  new THREE.MeshBasicMaterial({ map: loader.load(p.image) })
);

init();
animate();

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.z = 3;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  cube = new THREE.Mesh(geometry, materials);
  scene.add(cube);

  updateLink(0); // Start with front face (index 4 in Three.js)

  // Mouse controls
  window.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    const snappedAngle = Math.round(cube.rotation.y / (Math.PI / 2)) * (Math.PI / 2);
    rotationY = snappedAngle;
    cube.rotation.y = rotationY;
    currentFaceIndex = getFrontFaceIndex(rotationY);
    updateLink(currentFaceIndex);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    const rotationDelta = deltaX * 0.01;
    rotationY += rotationDelta;
    cube.rotation.y = rotationY;
    startX = e.clientX;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function getFrontFaceIndex(rotationY) {
  const step = Math.round(rotationY / (Math.PI / 2));
  const index = ((step % 4) + 4) % 4; // Normalize
  return [4, 0, 5, 1][index]; // Map Y-rotated front to face indices
}

function updateLink(faceIndex) {
  const project = shuffled[faceIndex];
  const linkEl = document.getElementById('link-btn');
  if (project) {
    linkEl.href = project.link;
    linkEl.textContent = `View Project ${faceIndex + 1}`;
  }
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
