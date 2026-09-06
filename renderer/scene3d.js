import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

const TYPE_COLORS = {
  desk_top: 0x8b6914,
  monitor: 0x222222,
};

function colorForType(type) {
  return TYPE_COLORS[type] ?? 0x999999;
}

export function renderScene(sceneSolution, graph) {
  const container = document.getElementById('scene');
  container.replaceChildren();
  const width = container.clientWidth;
  const height = container.clientHeight;
  const byId = new Map(graph.map((node) => [node.id, node]));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f5);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
  camera.position.set(2, 1.5, 2);
  camera.lookAt(0.8, 0.3, 0.4);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(5, 10, 5);
  scene.add(directional);

  for (const placement of sceneSolution.placements) {
    const element = byId.get(placement.elementId);
    if (!element) {
      continue;
    }

    const geometry = new THREE.BoxGeometry(
      element.dimensions.width / 1000,
      element.dimensions.height / 1000,
      element.dimensions.depth / 1000
    );
    const material = new THREE.MeshStandardMaterial({
      color: colorForType(element.type),
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      placement.position.x / 1000,
      placement.position.y / 1000,
      placement.position.z / 1000
    );
    scene.add(mesh);

    const label = document.createElement('div');
    label.className = 'element-label';
    label.textContent = element.name;
    const labelObject = new CSS2DObject(label);
    labelObject.position.set(0, element.dimensions.height / 2000 + 0.02, 0);
    mesh.add(labelObject);
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(width, height);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.8, 0.3, 0.4);
  controls.enableDamping = true;
  controls.update();

  function onResize() {
    const nextWidth = container.clientWidth;
    const nextHeight = container.clientHeight;
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight);
    labelRenderer.setSize(nextWidth, nextHeight);
  }

  window.addEventListener('resize', onResize);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  animate();
  return renderer;
}
