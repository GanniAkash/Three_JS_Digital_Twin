// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import axios from 'axios';
import osmtogeojson from 'osmtogeojson';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { Earcut } from 'three/src/extras/Earcut.js';

// Initialize the scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue background

// Set up camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(0, 500, 500);
camera.lookAt(0, 0, 0);

// Set up renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Add controls for panning, zooming, and rotating
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.screenSpacePanning = false;
controls.maxPolarAngle = Math.PI / 2;

// Add ambient light
// const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
// scene.add(ambientLight);

// // Add directional light (like sunlight)
// const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
// directionalLight.position.set(1000, 1000, 1000);
// directionalLight.castShadow = true;
// directionalLight.shadow.mapSize.width = 2048;
// directionalLight.shadow.mapSize.height = 2048;
// scene.add(directionalLight);
// scene.remove(ambientLight);
// scene.remove(directionalLight);

// New enhanced lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Reduced intensity for more contrast
scene.add(ambientLight);

// Main directional light (sun)
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(500, 1000, 500);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 4096;
directionalLight.shadow.mapSize.height = 4096;
directionalLight.shadow.camera.near = 100;
directionalLight.shadow.camera.far = 3000;
directionalLight.shadow.camera.left = -1000;
directionalLight.shadow.camera.right = 1000;
directionalLight.shadow.camera.top = 1000;
directionalLight.shadow.camera.bottom = -1000;
scene.add(directionalLight);

// Add a secondary light for fill
const fillLight = new THREE.DirectionalLight(0xadd8e6, 0.5); // Slightly blue for ambient occlusion effect
fillLight.position.set(-500, 500, -500);
scene.add(fillLight);

// Add ground plane
const groundGeometry = new THREE.PlaneGeometry(1500, 1500);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x8a9e6c,  // More greenish ground color
  roughness: 0.9,
  metalness: 0.1
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);


// Material dictionary for different building types
const buildingMaterials = {
  residential: {
    wall: new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.7,
      metalness: 0.1
    }),
    roof: new THREE.MeshStandardMaterial({
      color: 0xeeeeee, // Reddish roof color
      roughness: 0.8,
      metalness: 0.2
    })
  },
  commercial: {
    wall: new THREE.MeshStandardMaterial({
      color: 0xd1bea8,
      roughness: 0.5,
      metalness: 0.3
    }),
    roof: new THREE.MeshStandardMaterial({
      color: 0xeeeeee, // Bluish roof
      roughness: 0.6,
      metalness: 0.4
    })
  },
  industrial: {
    wall: new THREE.MeshStandardMaterial({
      color: 0xb8b2a7,
      roughness: 0.8,
      metalness: 0.4
    }),
    roof: new THREE.MeshStandardMaterial({
      color: 0xeeeeee, // Dark greenish roof
      roughness: 0.7,
      metalness: 0.5
    })
  },
  retail: {
    wall: new THREE.MeshStandardMaterial({
      color: 0xeed9c4,
      roughness: 0.6,
      metalness: 0.2
    }),
    roof: new THREE.MeshStandardMaterial({
      color: 0xeeeeee, // Amber/gold roof
      roughness: 0.6,
      metalness: 0.3
    })
  },
  default: {
    wall: new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.7,
      metalness: 0.1
    }),
    roof: new THREE.MeshStandardMaterial({
      color: 0xeeeeee, // Grey-blue roof
      roughness: 0.7,
      metalness: 0.3
    })
  }
};

// Road material
const roadMaterial = new THREE.MeshStandardMaterial({
  color: 0xeeeeee,
  roughness: 0.9,
  metalness: 0.1
});

// Function to fetch OSM data from Overpass API
async function fetchOSMData(boundingBox) {
  const [south, west, north, east] = boundingBox;

  const query = `
    [out:json];
    (
      way[building]${boundingBox ? `(${south},${west},${north},${east})` : ''};
      way[highway]${boundingBox ? `(${south},${west},${north},${east})` : ''};
      relation[building]${boundingBox ? `(${south},${west},${north},${east})` : ''};
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await axios.post('https://overpass-api.de/api/interpreter', query);
    const data = osmtogeojson(response.data);
    console.log('OSM Data:', data); // Log the data to inspect
    return data;
  } catch (error) {
    console.error('Error fetching OSM data:', error);
    return null;
  }
}

function clearScene(scene, keepList) {
  const toRemove = [];

  scene.traverse((child) => {
    if (!keepList.includes(child) && child.type !== 'Scene') {
      toRemove.push(child);
    }
  });

  toRemove.forEach((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(mat => mat.dispose());
      } else {
        child.material.dispose();
      }
    }
    if (child.parent) {
      child.parent.remove(child);
    }
  });
}



function centerSceneObjects(objectsArray) {
  // Create a bounding box for all objects
  const boundingBox = new THREE.Box3();

  objectsArray.forEach(object => {
    object.updateMatrixWorld(true); // Ensure matrix is up to date
    boundingBox.expandByObject(object);
  });

  if (boundingBox.isEmpty()) return;

  // Get the center of the bounding box but preserve Y (height)
  const center = new THREE.Vector3();
  boundingBox.getCenter(center);
  center.y = 0; // Don't move objects vertically

  // Apply the offset to each object
  objectsArray.forEach(object => {
    // Only move in X and Z to keep objects on the ground
    object.position.x -= center.x;
    object.position.z -= center.z;
  });

  // Calculate the size of the bounding box
  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  // Adjust ground plane size based on the objects
  const groundSize = Math.max(400, Math.max(size.x, size.z) * 1.2);
  ground.geometry.dispose(); // Clean up old geometry
  ground.geometry = new THREE.PlaneGeometry(groundSize, groundSize);

  // Position camera to view the entire scene
  const maxDimension = Math.max(size.x, size.z);
  camera.position.set(maxDimension * 0.6, maxDimension * 0.5, maxDimension * 0.6);
  camera.lookAt(0, 0, 0);

  if (controls) {
    controls.target.set(0, 0, 0);
    controls.update();
  }
}



// Function to create a 3D building
function createHollowBuildingWithRoof(feature, toLocalCoords, buildingGroup = null) {
  if (!buildingGroup) {
    buildingGroup = new THREE.Group();
  }

  const coordinates = feature.geometry.coordinates[0];
  const properties = feature.properties || {};

  // Skip if not enough points for a polygon
  if (coordinates.length < 3) return buildingGroup;

  // Convert to local coordinates
  const points = coordinates.map(coord => {
    const localCoord = toLocalCoords(coord[0], coord[1]);
    return new THREE.Vector2(localCoord.x, localCoord.z);
  });

  // Create building shape
  const shape = new THREE.Shape(points);

  // Determine building height
  let height = 10; // Default height
  if (properties.height) {
    height = parseFloat(properties.height);
  } else if (properties.levels) {
    height = parseFloat(properties.levels) * 3; // 3 meters per level
  } else if (properties['building:levels']) {
    height = parseFloat(properties['building:levels']) * 3;
  }

  // Determine materials based on building type
  let buildingType = 'default';
  if (properties['building:use'] === 'residential' || properties.residential) {
    buildingType = 'residential';
  } else if (properties['building:use'] === 'commercial' || properties.commercial) {
    buildingType = 'commercial';
  } else if (properties['building:use'] === 'industrial' || properties.industrial) {
    buildingType = 'industrial';
  } else if (properties['building:use'] === 'retail' || properties.retail) {
    buildingType = 'retail';
  }

  // Clone materials to avoid shared material modifications
  const wallMaterial = buildingMaterials[buildingType].wall.clone();
  const roofMaterial = buildingMaterials[buildingType].roof.clone();

  // Make materials double-sided for inside viewing
  wallMaterial.side = THREE.DoubleSided;
  roofMaterial.side = THREE.DoubleSided;

  // Alternative approach: Use ExtrudeGeometry but set the opacity of interior faces
  // This creates a single solid mesh that looks better from outside but is still navigable
  const extrudeSettings = {
    depth: height,
    bevelEnabled: false
  };

  // Create the main building geometry
  const buildingGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const buildingMesh = new THREE.Mesh(buildingGeometry, wallMaterial);

  // Make building traversable by camera by setting renderOrder and depthWrite
  buildingMesh.renderOrder = 1;
  wallMaterial.depthWrite = false;
  wallMaterial.transparent = true;
  wallMaterial.opacity = 0.95; // Almost solid but will allow camera through

  // Rotate to stand upright
  buildingMesh.rotation.x = -Math.PI / 2;
  buildingMesh.position.y = 0; // Place on ground
  buildingMesh.castShadow = true;
  buildingMesh.receiveShadow = true;

  // Create the roof (separate piece that precisely fits on top)
  const roofShape = new THREE.ShapeGeometry(shape);
  const roofMesh = new THREE.Mesh(roofShape, roofMaterial);

  // Position the roof on top of the building
  roofMesh.rotation.x = -Math.PI / 2;
  roofMesh.position.y = height;
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;

  // Add both to the group
  buildingGroup.add(buildingMesh);
  buildingGroup.add(roofMesh);

  // Add outlines to make the structure clearer
  const edges = new THREE.EdgesGeometry(buildingGeometry);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 })
  );
  line.rotation.x = -Math.PI / 2;
  buildingGroup.add(line);

  return buildingGroup;
}


function setupBuildingMaterials() {
  // Modify all materials in the buildingMaterials dictionary
  for (const type in buildingMaterials) {
    if (buildingMaterials.hasOwnProperty(type)) {
      // Set up wall material for transparent but solid appearance
      buildingMaterials[type].wall.transparent = true;
      buildingMaterials[type].wall.opacity = 0.95; // Almost completely solid
      buildingMaterials[type].wall.side = THREE.DoubleSided;
      buildingMaterials[type].wall.depthWrite = false; // This allows camera to pass through

      // Set up roof material
      buildingMaterials[type].roof.side = THREE.DoubleSided;
      buildingMaterials[type].roof.transparent = true;
      buildingMaterials[type].roof.opacity = 0.95;
      buildingMaterials[type].roof.depthWrite = false;
    }
  }
}

// Update the createBuildings function 
function createBuildings(geojson) {
  if (!geojson) return;


  console.log('Processing GeoJSON features:', geojson.features.length);

  // Set up our materials to allow camera passage
  setupBuildingMaterials();

  // Reference point for local coordinates
  let referencePoint = null;

  // Find the first valid coordinate to use as reference
  for (const feature of geojson.features) {
    if (feature.geometry) {
      if (feature.geometry.type === 'Polygon' && feature.geometry.coordinates[0].length > 0) {
        referencePoint = { lon: feature.geometry.coordinates[0][0][0], lat: feature.geometry.coordinates[0][0][1] };
        break;
      } else if (feature.geometry.type === 'LineString' && feature.geometry.coordinates.length > 0) {
        referencePoint = { lon: feature.geometry.coordinates[0][0], lat: feature.geometry.coordinates[0][1] };
        break;
      }
    }
  }

  if (!referencePoint) {
    console.error('No reference point found in GeoJSON data');
    return;
  }

  console.log('Using reference point:', referencePoint);

  // Function to convert lon/lat to local coordinates
  const toLocalCoords = (lon, lat) => {
    // Scale factors (approximate meters per degree at equator)
    const lonScale = 111320 * Math.cos(referencePoint.lat * Math.PI / 180);
    const latScale = 110540;

    return {
      x: (lon - referencePoint.lon) * lonScale,
      z: (lat - referencePoint.lat) * latScale
    };
  };

  // Store all geometries for proper centering
  const allObjects = [];
  // Process each feature
  geojson.features.forEach(feature => {
    if (!feature.geometry) return;

    const properties = feature.properties || {};
    const objectGroup = new THREE.Group(); // Group for this feature

    // Process building (Polygon)
    if (feature.geometry.type === 'Polygon' && properties.building) {
      // Use our hollow building with roof function
      createHollowBuildingWithRoof(feature, toLocalCoords, objectGroup);
      if (properties.alt_name) {
        objectGroup.name = properties.alt_name;
      }
      else {
        objectGroup.name = properties.name;
      }
      scene.add(objectGroup);
      allObjects.push(objectGroup);

    }
    // Process roads (LineString or Polygon)
    else if (properties.highway) {
      if (feature.geometry.type === 'LineString' || feature.geometry.type === 'Polygon') {
        // let tempRoads = createRoad(feature, toLocalCoords);
        // allObjects.push(tempRoads);
      }
    }
  });


  // Center all objects together
  centerSceneObjects(allObjects);

  // Set up camera controls after everything is loaded
  setupCameraControls();
}


function createBuildingWalls(points, height, material) {
  const walls = [];

  // Create a wall for each edge of the building footprint
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Skip very close points
    if (p1.distanceTo(p2) < 0.1) continue;

    // Create wall geometry (a simple plane)
    const wallWidth = p1.distanceTo(p2);
    const wallGeometry = new THREE.PlaneGeometry(wallWidth, height, 1, 1);

    const wall = new THREE.Mesh(wallGeometry, material);

    // Position and rotate the wall
    wall.position.set(
      (p1.x + p2.x) / 2,  // Center of the wall in X
      height / 2,         // Half height (as PlaneGeometry is centered)
      (p1.y + p2.y) / 2   // Center of the wall in Z
    );

    // Calculate the rotation angle
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    wall.rotation.y = -angle;  // Rotate around Y axis

    walls.push(wall);
  }

  // Connect the last point to the first point
  if (points.length > 2) {
    const p1 = points[points.length - 1];
    const p2 = points[0];

    // Skip very close points
    if (p1.distanceTo(p2) > 0.1) {
      const wallWidth = p1.distanceTo(p2);
      const wallGeometry = new THREE.PlaneGeometry(wallWidth, height, 1, 1);

      const wall = new THREE.Mesh(wallGeometry, material);

      wall.position.set(
        (p1.x + p2.x) / 2,
        height / 2,
        (p1.y + p2.y) / 2
      );

      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      wall.rotation.y = -angle;

      walls.push(wall);
    }
  }

  return walls;
}


function setupCameraControls() {
  // Assuming you're using OrbitControls
  controls.minDistance = 1; // Allow camera to get very close to objects
  controls.maxDistance = 1500; // Maximum zoom out distance

  // Enable damping for smoother camera movements
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;

  // Allow full rotations
  controls.maxPolarAngle = Math.PI/2;

  // Optional: Increase movement speed for easier navigation
  controls.panSpeed = 1.5;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 1.5;
}



function makeAllMaterialsDoubleSided() {
  // Clone and modify all materials in the buildingMaterials dictionary
  for (const type in buildingMaterials) {
    if (buildingMaterials.hasOwnProperty(type)) {
      // Clone to avoid affecting other instances
      const wallMaterial = buildingMaterials[type].wall.clone();
      const roofMaterial = buildingMaterials[type].roof.clone();

      // Set to double-sided
      wallMaterial.side = THREE.DoubleSided;
      roofMaterial.side = THREE.DoubleSided;

      // Replace the originals
      buildingMaterials[type].wall = wallMaterial;
      buildingMaterials[type].roof = roofMaterial;
    }
  }

  // Also set the road material to be double-sided
  roadMaterial.side = THREE.DoubleSided;
}


function initSceneForHollowBuildings() {
  // Set renderer parameters to work better with our setup
  if (renderer) {
    renderer.localClippingEnabled = true;
    renderer.sortObjects = true; // Make sure transparent objects render correctly
  }

  // Setup camera controls
  setupCameraControls();

  // Make ground plane slightly transparent for better navigation
  ground.material.transparent = true;
  ground.material.opacity = 0.9;
}


function getRoadColor(type) {
  switch (type) {
    case "motorway": return 0xff0000;
    case "primary": return 0xffa500;
    case "secondary": return 0xffff00;
    case "tertiary": return 0x00ff00;
    case "residential": return 0xaaaaaa;
    case "footway":
    case "path": return 0x0000ff;
    default: return 0x888888;
  }
}

// Add loading indicator
const loadingElement = document.createElement('div');
loadingElement.id = 'loading';
loadingElement.style.position = 'absolute';
loadingElement.style.top = '50%';
loadingElement.style.left = '50%';
loadingElement.style.transform = 'translate(-50%, -50%)';
loadingElement.style.background = 'rgba(0, 0, 0, 0.7)';
loadingElement.style.color = 'white';
loadingElement.style.padding = '20px';
loadingElement.style.borderRadius = '5px';
loadingElement.style.fontFamily = 'Arial, sans-serif';
loadingElement.textContent = 'Loading OSM data...';
document.body.appendChild(loadingElement);

// Add UI controls
const uiContainer = document.createElement('div');
uiContainer.style.position = 'absolute';
uiContainer.style.top = '10px';
uiContainer.style.left = '10px';
uiContainer.style.background = 'rgba(255, 255, 255, 0.8)';
uiContainer.style.padding = '10px';
uiContainer.style.borderRadius = '5px';
uiContainer.style.fontFamily = 'Arial, sans-serif';
document.body.appendChild(uiContainer);

// Add input for location search
const locationInput = document.createElement('input');
locationInput.type = 'text';
locationInput.placeholder = 'Enter location (e.g., "VNIT, Nagpur")';
locationInput.style.width = '300px';
locationInput.style.marginBottom = '10px';
locationInput.style.padding = '5px';
locationInput.addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    const location = locationInput.value.trim();
    if (location !== '') {
      loadOSMData(location);
      // Your logic here, e.g., search location

    }
  }
});
uiContainer.appendChild(locationInput);

// Add button for loading data
const loadButton = document.createElement('button');
loadButton.textContent = 'Load Area';
loadButton.style.padding = '5px 10px';
loadButton.style.marginLeft = '10px';
loadButton.addEventListener('click', () => {
  loadOSMData(locationInput.value);
});
uiContainer.appendChild(loadButton);


async function downloadMapImage(areaName, lati, loni, wid, hei, zom) {
  try {
    // 1. Get coordinates from Nominatim
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(areaName)}`;
    const response = await axios.get(nominatimUrl);
    const result = response.data[0];

    if (!result) {
      alert("Area not found");
      return;
    }

    // const lat = parseFloat(result.lat);
    // const lon = parseFloat(result.lon);

    const lat = lati;
    const lon = loni;

    // 2. Build Mapbox static image URL
    const zoom = 16;
    const width = 512;
    const height = 512;
    const MAPBOX_TOKEN = "pk.eyJ1IjoieW9kYTE2MTAiLCJhIjoiY21hOGs2dW5tMWNyaDJqc2RwYXR0YndmZSJ9.T4hoZGsy6TegORwcW1nEfA";  // Replace this with your actual token

    const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${lon},${lat},${zoom}/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;

    // 3. Fetch the image as a Blob
    const imageResponse = await fetch(mapUrl);
    const imageBlob = await imageResponse.blob();

    // 4. Create a download link for the image Blob
    const a = document.createElement('a');
    const url = URL.createObjectURL(imageBlob);  // Create a temporary URL for the Blob
    a.href = url;
    a.download = `${areaName.replace(/\s+/g, "_")}_map.png`;

    // Ensure that the anchor tag is not navigated to
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up the Blob URL
    URL.revokeObjectURL(url);

  } catch (err) {
    console.error("Map image download failed:", err);
  }
}


// Function to load OSM data for a specific area
async function loadOSMData(location) {

  let keepList = [ambientLight, directionalLight, fillLight, ground];
  clearScene(scene, keepList);
  if (signalPropagation.transmitter) {
    scene.remove(signalPropagation.transmitter);
    signalPropagation.transmitter = null;
    signalPropagation.transmitterPosition = null;
  }
  loadingElement.style.display = 'block';

  try {
    // First, geocode the location to get coordinates
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;
    const geocodeResponse = await axios.get(geocodeUrl);

    if (geocodeResponse.data && geocodeResponse.data.length > 0) {
      const result = geocodeResponse.data[0];
      const boundingBox = [
        parseFloat(result.boundingbox[0]), // south
        parseFloat(result.boundingbox[2]), // west
        parseFloat(result.boundingbox[1]), // north
        parseFloat(result.boundingbox[3])  // east
      ];

      // Clear existing buildings and roads
      // Clear existing buildings and roads
      scene.children.forEach(child => {
        if (child !== ground && child !== ambientLight && child !== directionalLight && child !== fillLight) {
          scene.remove(child);
          // Properly dispose of geometries and materials to prevent memory leaks
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });

      // Fetch and create new buildings
      const geojsonData = await fetchOSMData(boundingBox);
      createBuildings(geojsonData);
      // Call this function during initialization
      // makeAllMaterialsDoubleSided();f
      initSceneForHollowBuildings();

      // Add info text about the loaded area
      // const infoText = document.createElement('div');
      // infoText.id = 'infoText';
      // infoText.textContent = `Loaded: ${result.display_name}`;
      // infoText.style.marginTop = '10px';
      // uiContainer.appendChild(infoText);

      if (!document.getElementById('infoText')) {
        const infoText = document.createElement('div');
        infoText.id = 'infoText';
        infoText.textContent = `Loaded: ${result.display_name}`;
        infoText.style.marginTop = '10px';
        uiContainer.appendChild(infoText);
      }
      else {
        let infoText = document.getElementById('infoText');
        infoText.textContent = `Loaded: ${result.display_name}`;
      }
    } else {
      alert('Location not found. Please try a different search term.');
    }
  } catch (error) {
    console.error('Error loading OSM data:', error);
    alert('Error loading data. Please try again.');
  } finally {
    loadingElement.style.display = 'none';
  }

}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});




// Start animation loop
animate();

// Load a default area on startup
// loadOSMData('Times Square, New York');



// Signal propagation and visualization code
// Add these imports at the top of your file if not already present
// import * as THREE from 'three';

// Constants for signal propagation model
let SIGNAL_CONSTANTS = {
  frequency: 2.6, // GHz (can be adjusted for different bands)
  transmitterPower: 43, // dBm (typical macro cell)
  transmitterGain: 15, // dBi
  receiverGain: 0, // dBi (mobile device)
  shadowingStdDevLOS: 4, // dB
  shadowingStdDevNLOS: 6, // dB
  minSignalStrength: -110, // dBm (minimum detectable signal)
  maxSignalStrength: -40, // dBm (very strong signal)
};

// Color mapping for signal strength
let gradientColors = [
  new THREE.Color(1, 0, 0),   // Red (strongest)
  new THREE.Color(1, 0.5, 0), // Orange
  new THREE.Color(1, 1, 0),   // Yellow
  new THREE.Color(0, 1, 0),   // Green
  new THREE.Color(0, 1, 1),   // Cyan
  new THREE.Color(0, 0, 1),   // Blue
  new THREE.Color(0.5, 0, 1), // Violet (weakest)
];

// Generate signal color levels based on min/max strength
let signalColors = gradientColors.map((color, index, arr) => {
  const level = SIGNAL_CONSTANTS.maxSignalStrength -
    ((SIGNAL_CONSTANTS.maxSignalStrength - SIGNAL_CONSTANTS.minSignalStrength) / (arr.length - 1)) * index;
  return { level, color };
});

// Create a class to manage the transmitter and signal visualization
class SignalPropagation {
  constructor(scene) {
    this.scene = scene;
    this.transmitter = null;
    this.gridVisualizer = null;
    this.transmitterHeight = 25; // meters
    this.gridResolution = 5; // meters between grid points
    this.gridSize = 1000; // meters (total coverage area)
    this.signalGrid = [];
    this.raycaster = new THREE.Raycaster();

    // Add new properties for 3D visualization
    this.volumeVisualizer = null;
    this.is3DVisualizationActive = false;
    this.verticalResolution = 15; // meters between vertical layers
    this.maxVisualizationHeight = 30; // maximum height for 3D visualization
    this.volumeOpacity = 0.15; // default opacity for volume cubes
    this.volumeCubes = []; // store references to cubes for updates

    // Create materials for the transmitter
    this.transmitterMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0x000000,
      emissiveIntensity: 0.5
    });

    // Create transparent material for grid visualization
    this.gridMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });

    this.antennaDirection = 0; // Direction in degrees (0 = North/+Z, 90 = East/+X)
    this.antennaBeamwidth = 120; // Horizontal beamwidth in degrees
    this.antennaGainPattern = 'parabolic'; // Options: 'omnidirectional', 'cardioid', 'parabolic'
    this.antennaMaxGain = 15; // Maximum gain in dBi along main direction
    this.directionArrow = null; // Visual indicator for direction
  }

  // Place transmitter at specified position
  placeTransmitter(x, y, z) {
    // Remove existing transmitter if any
    if (this.transmitter) {
      this.scene.remove(this.transmitter);
    }

    // Create transmitter mesh (antenna tower)
    const baseGeometry = new THREE.CylinderGeometry(2, 2, z || this.transmitterHeight, 8);
    const transmitterMesh = new THREE.Mesh(baseGeometry, this.transmitterMaterial);

    // Add antenna elements
    const antennaGeometry = new THREE.CylinderGeometry(0.5, 0.5, 3, 8);
    const antenna1 = new THREE.Mesh(antennaGeometry, this.transmitterMaterial);
    antenna1.position.set(1.5, z / 2 || this.transmitterHeight / 2, 0);
    antenna1.rotation.z = Math.PI / 2;

    const antenna2 = new THREE.Mesh(antennaGeometry, this.transmitterMaterial);
    antenna2.position.set(-1.5, z / 2 || this.transmitterHeight / 2, 0);
    antenna2.rotation.z = Math.PI / 2;

    const antenna3 = new THREE.Mesh(antennaGeometry, this.transmitterMaterial);
    antenna3.position.set(0, z / 2 || this.transmitterHeight / 2, 1.5);
    antenna3.rotation.x = Math.PI / 2;

    // Create transmitter group
    this.transmitter = new THREE.Group();
    this.transmitter.add(transmitterMesh);
    this.transmitter.add(antenna1);
    this.transmitter.add(antenna2);
    this.transmitter.add(antenna3);

    // Position transmitter
    this.transmitter.position.set(x || 0, z / 2, y || 0);

    // Add to scene
    this.scene.add(this.transmitter);



    // Store transmitter position
    this.transmitterPosition = new THREE.Vector3(x || 0, z || this.transmitterHeight, y || 0);
    // this.updateDirectionIndicator();
    // Calculate and visualize signal propagation
    // this.calculateSignalPropagation();

    if (this.is3DVisualizationActive) {
      // this.calculate3DSignalPropagation();
    }
  }

  // Calculate path loss using 3GPP Urban Macro Model
  calculatePathLoss(distance3D, isLOS) {
    const fc = SIGNAL_CONSTANTS.frequency; // Center frequency in GHz
    const d2D = Math.sqrt(
      Math.pow(distance3D, 2) -
      Math.pow(this.transmitterPosition.y - 1.5, 2)
    );

    let pathLoss;
    let shadowing;

    if (isLOS) {
      // LOS path loss model (3GPP UMa LOS)
      const breakpointDistance = 4 * this.transmitterPosition.y * 1.5 / 0.2; // Approx. breakpoint distance

      if (d2D <= breakpointDistance) {
        // Before breakpoint
        pathLoss = 28.0 + 22 * Math.log10(distance3D) + 20 * Math.log10(fc);
      } else {
        // After breakpoint assuming h_UT = 1.5m
        pathLoss = 28.0 + 40 * Math.log10(distance3D) + 20 * Math.log10(fc) - 9 * Math.log10(Math.pow(breakpointDistance, 2) + Math.pow((this.transmitterHeight - 1.5), 2));
      }

      // Add LOS shadowing
      shadowing = this.getNormalDistribution(0, SIGNAL_CONSTANTS.shadowingStdDevLOS);

    } else {
      // NLOS path loss model (3GPP UMa NLOS)
      // h_UT = 1.5
      pathLoss = 13.54 + 39.08 * Math.log10(distance3D) + 20 * Math.log10(fc) - 0.6 * (1.5 - 1.5);

      // Add NLOS shadowing (generally higher variance than LOS)
      shadowing = this.getNormalDistribution(0, SIGNAL_CONSTANTS.shadowingStdDevNLOS);
    }

    return pathLoss + shadowing;
  }

  // Helper function to generate normal distribution values
  getNormalDistribution(mean, stdDev) {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  // Calculate signal strength based on path loss
  // Calculate signal strength based on path loss
  calculateSignalStrength(pathLoss, pointPosition) {
    // Make sure pointPosition is defined before using it
    const directionalGain = pointPosition ?
      this.calculateDirectionalGain(pointPosition) :
      SIGNAL_CONSTANTS.transmitterGain; // Fall back to constant if no position provided

    return SIGNAL_CONSTANTS.transmitterPower +
      directionalGain + // Use directional gain instead of fixed gain
      SIGNAL_CONSTANTS.receiverGain -
      pathLoss;
  }

  // Get color for a given signal strength using VIBGYOR spectrum
  getColorForSignalStrength(signalStrength) {
    // Clamp signal strength to our defined range
    const clampedSignal = Math.max(
      SIGNAL_CONSTANTS.minSignalStrength,
      Math.min(SIGNAL_CONSTANTS.maxSignalStrength, signalStrength)
    );

    // Find the color range this signal strength falls into
    for (let i = 0; i < signalColors.length - 1; i++) {
      if (clampedSignal <= signalColors[i].level && clampedSignal > signalColors[i + 1].level) {
        // Interpolate between the two colors
        const ratio = (clampedSignal - signalColors[i + 1].level) /
          (signalColors[i].level - signalColors[i + 1].level);

        const color = new THREE.Color();
        color.r = signalColors[i + 1].color.r + ratio * (signalColors[i].color.r - signalColors[i + 1].color.r);
        color.g = signalColors[i + 1].color.g + ratio * (signalColors[i].color.g - signalColors[i + 1].color.g);
        color.b = signalColors[i + 1].color.b + ratio * (signalColors[i].color.b - signalColors[i + 1].color.b);

        return color;
      }
    }

    // Default for very low signal strength
    if (clampedSignal <= signalColors[signalColors.length - 1].level) {
      return signalColors[signalColors.length - 1].color.clone();
    }

    // Default for very high signal strength
    return signalColors[0].color.clone();
  }

  // Check if a point has line-of-sight to the transmitter
  checkLineOfSight(point) {
    // Direction from point to transmitter
    const direction = new THREE.Vector3().subVectors(this.transmitterPosition, point).normalize();

    this.raycaster.layers.set(0);
    // Set up raycaster
    this.raycaster.set(point, direction);

    // Distance to transmitter
    const distanceToTransmitter = point.distanceTo(this.transmitterPosition);

    // // Find intersections with buildings
    // const intersects = this.raycaster.intersectObjects(this.getBuildingObjects(), true);

    const intersects = this.raycaster.intersectObjects(this.getBuildingObjects(), true);


    try {
      // Code that might throw an error4
      // console.log( `intersectDistance: ${intersects[0].distance}, transmitterDistance: ${distanceToTransmitter}`);
      return [!(intersects.length > 0 && intersects[0].distance < distanceToTransmitter), intersects];
    } catch (error) {
      // console.log("Somethings fishy.");
      return [true, intersects]
    }
    // return !(intersects.length > 0 && intersects[0].distance < distanceToTransmitter); 
  }

  // Get all building objects in the scene for ray casting
  getBuildingObjects() {
    const buildings = [];
    this.scene.traverse(object => {
      // Only include meshes that are buildings (excluding ground, transmitter, etc.)
      if (object instanceof THREE.Mesh &&
        object !== ground &&
        (!this.transmitter || !this.transmitter.children.includes(object)) &&
        (!this.gridVisualizer || object !== this.gridVisualizer) &&
        object.material !== roadMaterial && object.name != 'cube') {
        buildings.push(object);
      }
    });
    // console.log(buildings[0]);
    return buildings;
  }

  // Calculate signal propagation across the grid
  calculateSignalPropagation() {
    // Clear previous visualization if it exists
    this.updateValues();
    if (this.gridVisualizer) {
      this.scene.remove(this.gridVisualizer);
      if (this.gridVisualizer.geometry) this.gridVisualizer.geometry.dispose();
      if (this.gridVisualizer.material) this.gridVisualizer.material.dispose();
    }

    if (!this.transmitterPosition) return;

    // Get ground plane dimensions
    let groundSize = 400; // Default size
    if (ground.geometry && ground.geometry.parameters) {
      groundSize = Math.max(
        ground.geometry.parameters.width,
        ground.geometry.parameters.height
      );
    }

    // Update grid size to match ground plane
    this.gridSize = groundSize;

    // Calculate grid boundaries based on ground plane dimensions
    const halfGrid = this.gridSize / 2;
    const startX = -halfGrid;
    const startZ = -halfGrid;
    const endX = halfGrid;
    const endZ = halfGrid;

    // Create geometry for the grid
    const gridGeometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const indices = [];

    // Track signal strength for heatmap calculations
    this.signalGrid = [];

    // Number of grid points in each direction
    const xPointCount = Math.ceil(this.gridSize / this.gridResolution);
    const zPointCount = Math.ceil(this.gridSize / this.gridResolution);

    console.log(`Calculating signal propagation on a ${xPointCount}x${zPointCount} grid...`);

    // For each grid point
    let vertexIndex = 0;
    const lines = [];

    for (let zIndex = 0; zIndex < zPointCount; zIndex++) {
      const zVal = startZ + zIndex * this.gridResolution;
      const row = [];

      for (let xIndex = 0; xIndex < xPointCount; xIndex++) {
        const xVal = startX + xIndex * this.gridResolution;

        // Create grid point 1.5m above ground (typical mobile height)
        const gridPoint = new THREE.Vector3(xVal, 0, zVal);

        // Check if point has line-of-sight to transmitter
        let hasLOS = NaN;
        let intersects = NaN;

        [hasLOS, intersects] = this.checkLineOfSight(gridPoint);

        // Calculate 3D distance from point to transmitter
        const distance = gridPoint.distanceTo(this.transmitterPosition);

        // Calculate path loss based on distance and LOS/NLOS status
        const pathLoss = this.calculatePathLoss(distance, hasLOS);

        // Calculate signal strength in dBm - Pass gridPoint to include directivity
        const signalStrength = this.calculateSignalStrength(pathLoss, gridPoint);
        if (intersects[0]) {
          lines.push(`${gridPoint.x}, ${gridPoint.y}, ${gridPoint.z}: ${signalStrength}, ${hasLOS}, ${distance}, ${pathLoss},${intersects[0].distance}, ${intersects[0].point}, ${intersects[0].instanceId}`);
        }
        else {
          lines.push(`${gridPoint.x}, ${gridPoint.y}, ${gridPoint.z}: ${signalStrength}, ${hasLOS}, ${distance}, ${pathLoss},${intersects.distance}, ${intersects.point}, ${intersects.instanceId}`);
        }


        // Store signal strength for this point
        row.push({
          x: xVal,
          z: zVal,
          isLOS: hasLOS,
          distance: distance,
          pathLoss: pathLoss,
          signalStrength: signalStrength
        });

        // Get color for this signal strength
        const color = this.getColorForSignalStrength(signalStrength);

        // Skip if this is not the last row/column
        if (zIndex < zPointCount - 1 && xIndex < xPointCount - 1) {
          // Each grid cell consists of 2 triangles
          const topLeft = vertexIndex;
          const topRight = vertexIndex + 1;
          const bottomLeft = vertexIndex + xPointCount;
          const bottomRight = bottomLeft + 1;

          // First triangle (top-left, bottom-left, bottom-right)
          indices.push(topLeft, bottomLeft, bottomRight);

          // Second triangle (top-left, bottom-right, top-right)
          indices.push(topLeft, bottomRight, topRight);
        }

        // Add vertex position
        positions.push(xVal, 0.1, zVal); // Slightly above ground to prevent z-fighting

        // Add vertex color
        colors.push(color.r, color.g, color.b);

        vertexIndex++;
      }

      this.signalGrid.push(row);
    }



    // Create the grid mesh
    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    gridGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    gridGeometry.setIndex(indices);
    gridGeometry.computeVertexNormals();

    this.gridVisualizer = new THREE.Mesh(gridGeometry, this.gridMaterial);
    this.scene.add(this.gridVisualizer);

    const textContent = lines.join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'vectors2d.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('Signal propagation calculation complete');

    // Add legend for signal strength colors
    this.createSignalLegend();

    // After completing 2D visualization, also update 3D if active
    if (this.is3DVisualizationActive) {
      this.calculate3DSignalPropagation();
    }

    // Show the correct visualization based on current mode
    this.toggleVisualizationMode(this.is3DVisualizationActive);
  }

  // Create a legend to show signal strength color mapping
  createSignalLegend() {
    // Remove existing legend if any
    const existingLegend = document.getElementById('signal-legend');
    if (existingLegend) {
      existingLegend.remove();
    }

    // Create legend container
    const legend = document.createElement('div');
    legend.id = 'signal-legend';
    legend.style.position = 'absolute';
    legend.style.bottom = '10px';
    legend.style.left = '10px';
    legend.style.background = 'rgba(255, 255, 255, 0.8)';
    legend.style.padding = '10px';
    legend.style.borderRadius = '5px';
    legend.style.fontFamily = 'Arial, sans-serif';
    legend.style.fontSize = '12px';

    // Add title
    const title = document.createElement('div');
    title.textContent = 'Signal Strength (dBm)';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '5px';
    legend.appendChild(title);

    // Add color gradient
    for (let i = 0; i < signalColors.length; i++) {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.marginBottom = '3px';

      const colorBox = document.createElement('div');
      colorBox.style.width = '20px';
      colorBox.style.height = '15px';
      colorBox.style.backgroundColor = `rgb(${Math.round(signalColors[i].color.r * 255)}, ${Math.round(signalColors[i].color.g * 255)}, ${Math.round(signalColors[i].color.b * 255)})`;
      colorBox.style.marginRight = '5px';

      const label = document.createElement('span');
      label.textContent = `${signalColors[i].level.toFixed(2)} dBm`;

      item.appendChild(colorBox);
      item.appendChild(label);
      legend.appendChild(item);
    }

    // Add transmitter info
    const txInfo = document.createElement('div');
    txInfo.style.marginTop = '10px';
    txInfo.style.fontStyle = 'italic';
    txInfo.textContent = `Tx Power: ${SIGNAL_CONSTANTS.transmitterPower} dBm, Height: ${this.transmitterHeight}m`;
    legend.appendChild(txInfo);

    // Add to document
    document.body.appendChild(legend);
  }

  calculateDirectionalGain(pointPosition) {
    // Calculate angle between transmitter-to-point vector and antenna direction
    const txToPoint = new THREE.Vector2(
      pointPosition.x - this.transmitterPosition.x,
      pointPosition.z - this.transmitterPosition.z
    );

    // Skip if point is at the same position as transmitter
    if (txToPoint.length() < 0.001) return this.antennaMaxGain;

    // Convert antenna direction from degrees to radians
    const directionRad = (this.antennaDirection * Math.PI) / 180;

    // Create a unit vector pointing in the antenna direction
    const antennaVector = new THREE.Vector2(
      Math.sin(directionRad), // X component
      Math.cos(directionRad)  // Z component
    );

    // Normalize the txToPoint vector
    txToPoint.normalize();

    // Calculate the dot product (cosine of angle between vectors)
    const dotProduct = antennaVector.dot(txToPoint);

    // Calculate the angle in radians between the two vectors
    const angleRad = Math.acos(Math.min(Math.max(dotProduct, -1), 1));

    // Convert angle to degrees
    const angleDeg = (angleRad * 180) / Math.PI;

    // Apply different gain patterns
    let gain;

    switch (this.antennaGainPattern) {
      case 'omnidirectional':
        // No directivity, return maximum gain
        gain = this.antennaMaxGain;
        break;

      case 'cardioid':
        // Cardioid pattern: gain = max_gain * (1 + cos(angle)) / 2
        gain = this.antennaMaxGain * (1 + Math.cos(angleRad)) / 2;
        break;

      case 'parabolic':
        // Parabolic/sectoral pattern: sharp drop outside beamwidth
        if (angleDeg <= this.antennaBeamwidth / 2) {
          // Within main lobe: cosine-squared pattern
          const normalizedAngle = (angleDeg / (this.antennaBeamwidth / 2)) * (Math.PI / 2);
          gain = this.antennaMaxGain * Math.pow(Math.cos(normalizedAngle), 2);
        } else {
          // Side lobes: much lower gain (typically 20-30 dB down)
          gain = this.antennaMaxGain * 0.01; // -20dB from max
        }
        break;

      default:
        gain = this.antennaMaxGain;
    }

    return gain;
  }

  updateDirectionIndicator() {
    // Remove existing arrow if it exists
    if (this.directionArrow) {
      this.scene.remove(this.directionArrow);
      if (this.directionArrow.geometry) this.directionArrow.geometry.dispose();
      if (this.directionArrow.material) this.directionArrow.material.dispose();
    }

    if (!this.transmitter) return;

    // Create arrow geometry
    const dirRad = (this.antennaDirection * Math.PI) / 180;
    const arrowLength = 30;
    const dirX = Math.sin(dirRad) * arrowLength;
    const dirZ = Math.cos(dirRad) * arrowLength;

    // Create arrow
    const arrowDir = new THREE.Vector3(dirX, 0, dirZ).normalize();
    const arrowOrigin = new THREE.Vector3(
      this.transmitterPosition.x,
      this.transmitterPosition.y,
      this.transmitterPosition.z
    );

    const arrowHelper = new THREE.ArrowHelper(
      arrowDir,
      arrowOrigin,
      arrowLength,
      0xff0000, // Red color
      arrowLength * 0.2, // Head length
      arrowLength * 0.1  // Head width
    );

    this.directionArrow = arrowHelper;
    this.scene.add(this.directionArrow);

    // Visualize beam width
    this.updateBeamWidthVisualization();
  }

  // Add method to visualize beam width
  updateBeamWidthVisualization() {
    // Remove existing visualization if it exists
    if (this.beamWidthVisualizer) {
      this.scene.remove(this.beamWidthVisualizer);
      if (this.beamWidthVisualizer.geometry) this.beamWidthVisualizer.geometry.dispose();
      if (this.beamWidthVisualizer.material) this.beamWidthVisualizer.material.dispose();
    }

    // Create a cone to represent the beam width
    const halfBeamWidth = (this.antennaBeamwidth / 2) * (Math.PI / 180);
    const radius = 30 * Math.sin(halfBeamWidth);
    const height = 30 * Math.cos(halfBeamWidth);

    const geometry = new THREE.CylinderGeometry(0, radius, height, 32, 1, true);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });

    const cone = new THREE.Mesh(geometry, material);

    // Position the cone at the transmitter and orient it along the direction
    cone.position.set(
      this.transmitterPosition.x,
      this.transmitterPosition.y,
      this.transmitterPosition.z
    );

    // Rotate the cone to match the antenna direction
    cone.rotation.y = -(this.antennaDirection * Math.PI / 180) + Math.PI / 2;

    this.beamWidthVisualizer = cone;
    this.scene.add(this.beamWidthVisualizer);
  }

  // Method to set antenna direction
  setAntennaDirection(direction) {
    this.antennaDirection = direction % 360;
    this.updateDirectionIndicator();
  }

  // Method to set antenna beamwidth
  setAntennaBeamwidth(beamwidth) {
    this.antennaBeamwidth = Math.max(1, Math.min(360, beamwidth));
    this.updateDirectionIndicator();
  }

  // Method to set antenna gain pattern
  setAntennaGainPattern(pattern) {
    this.antennaGainPattern = pattern;
  }

  updateValues() {
    // this.transmitterHeight = heightSlider.value;
    // this.gridResolution = resolutionSlider.value;
    // this.verticalResolution = vResSlider.value;
    // this.maxVisualizationHeight = maxHeightSlider.value;
  }

  // ----------------------------------- 3D methods -----------------------------------------------

  calculate3DSignalPropagation() {
    console.log('Calculating 3D signal propagation...');
    this.updateValues();
    // Clear previous 3D visualization if it exists
    this.clear3DVisualization();

    if (!this.transmitterPosition) return;

    // Get ground plane dimensions
    let groundSize = 400; // Default size
    if (ground.geometry && ground.geometry.parameters) {
      groundSize = Math.max(
        ground.geometry.parameters.width,
        ground.geometry.parameters.height
      );
    }

    // Update grid size to match ground plane
    this.gridSize = groundSize;

    // Calculate grid boundaries based on ground plane dimensions
    const halfGrid = this.gridSize / 2;
    const startX = -halfGrid;
    const startZ = -halfGrid;
    const endX = halfGrid;
    const endZ = halfGrid;



    // Find maximum building height in the scene to determine visualization height
    let maxBuildingHeight = 0;
    const buildings = this.getBuildingObjects();
    buildings.forEach(building => {
      // Get building bounds
      const boundingBox = new THREE.Box3().setFromObject(building);
      const height = boundingBox.max.y;
      maxBuildingHeight = Math.max(maxBuildingHeight, height);
    });

    // Set max visualization height based on buildings or use default if no buildings
    // this.maxVisualizationHeight = Math.max(maxBuildingHeight, this.maxVisualizationHeight);
    // console.log(`Maximum visualization height: ${this.maxVisualizationHeight}m`);

    // Determine number of points in each dimension based on resolution
    const xPointCount = Math.ceil(this.gridSize / this.gridResolution);
    const zPointCount = Math.ceil(this.gridSize / this.gridResolution);
    const yPointCount = Math.ceil(this.maxVisualizationHeight / this.verticalResolution);

    console.log(`Calculating 3D signal propagation on a ${xPointCount}x${yPointCount}x${zPointCount} grid...`);
    console.log(`This will create ${xPointCount * yPointCount * zPointCount} cubes - high resolution may impact performance.`);


    // Counter for number of cubes created
    let cubeCount = 0;
    const lines = []; // To collect each line
    const lis_colors = [];
    const lis_opacity = [];
    const xVals = [];
    const yVals = [];
    const zVals = [];
    const isLos = [];
    const lis_signalStrength = [];
    const lis_pathLoss = [];
    const lis_distance = [];
    const lis_intersects = [];
    // For each grid point in 3D space

    let tempBtn = document.getElementById('calcBtn');

    let creatNum = 1;
    for (let yIndex = 0; yIndex < yPointCount; yIndex++) {
      const yVal = yIndex * this.verticalResolution

      // Skip points below ground level
      if (yVal < 0) continue;

      for (let zIndex = 0; zIndex < zPointCount; zIndex++) {
        const zVal = startZ + zIndex * this.gridResolution;

        for (let xIndex = 0; xIndex < xPointCount; xIndex++) {

          tempBtn.textContent = `Calculating... ${creatNum}/${xPointCount * yPointCount * zPointCount}`;
          const xVal = startX + xIndex * this.gridResolution;

          // Create 3D point
          const gridPoint = new THREE.Vector3(xVal, yVal, zVal);

          // Skip points inside buildings
          if (this.isPointInsideBuilding(gridPoint)) continue;

          // Check if point has line-of-sight to transmitter
          let hasLOS = NaN;
          let intersects = NaN;
          [hasLOS, intersects] = this.checkLineOfSight(gridPoint);

          // Calculate 3D distance from point to transmitter
          const distance = gridPoint.distanceTo(this.transmitterPosition);

          // Calculate path loss based on distance and LOS/NLOS status
          const pathLoss = this.calculatePathLoss(distance, hasLOS);

          // Calculate signal strength in dBm including directivity
          const signalStrength = this.calculateSignalStrength(pathLoss, gridPoint);

          if (intersects[0]) {
            lines.push(`${gridPoint.x}, ${gridPoint.y}, ${gridPoint.z}: ${signalStrength}, ${hasLOS}, ${distance}, ${pathLoss},${intersects[0].distance}, ${intersects[0].point}, ${intersects[0].instanceId}`);
          }
          else {
            lines.push(`${gridPoint.x}, ${gridPoint.y}, ${gridPoint.z}: ${signalStrength}, ${hasLOS}, ${distance}, ${pathLoss},${intersects.distance}, ${intersects.point}, ${intersects.instanceId}`);
          }


          // Get color for this signal strength
          const color = this.getColorForSignalStrength(signalStrength);

          // Set opacity based on signal strength (stronger signals more visible)
          const normalizedStrength = (signalStrength - SIGNAL_CONSTANTS.minSignalStrength) /
            (SIGNAL_CONSTANTS.maxSignalStrength - SIGNAL_CONSTANTS.minSignalStrength);
          let opacity = this.volumeOpacity * (0.5 + normalizedStrength * 0.5);

          lis_opacity.push(opacity);
          isLos.push(hasLOS);
          xVals.push(xVal);
          yVals.push(yVal);
          zVals.push(zVal);
          lis_distance.push(distance);
          lis_pathLoss.push(pathLoss);
          lis_signalStrength.push(signalStrength);
          lis_colors.push(color);
          lis_intersects.push(intersects);
          creatNum += 1;
        }
      }
    }

    cubeCount = 1;


    // Create group for all volume cubes
    if (this.volumeVisualizer == null) {
      this.volumeVisualizer = new THREE.Group();
      this.scene.add(this.volumeVisualizer);
    }

    // Optimize: create a single geometry for the cube
    const cubeGeometry = new THREE.BoxGeometry(
      this.gridResolution * 0.9, // Slightly smaller than grid size
      this.verticalResolution * 0.9,
      this.gridResolution * 0.9
    );

    for (let i = 0; i < lis_colors.length; i++) {
      // Create cube material

      tempBtn.textContent = `Creating.. ${cubeCount}/${xPointCount * yPointCount * zPointCount}`;
      const cubeMaterial = new THREE.MeshBasicMaterial({
        color: lis_colors[i],
        transparent: true,
        opacity: lis_opacity[i],
        depthWrite: false // Important for transparent objects
      });

      // Create mesh with shared geometry and unique material
      const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

      cube.userData.ignoreRaycast = true;
      // Position cube
      cube.position.set(xVals[i], yVals[i], zVals[i]);

      cube.name = 'cube';

      // Store signal strength as a property for interaction
      cube.userData = {
        signalStrength: lis_signalStrength[i],
        hasLOS: isLos[i],
        distance: lis_distance[i],
        pathLoss: lis_pathLoss[i]
      };

      // Store reference to cube for updates
      this.volumeCubes.push(cube);

      // Add to group
      this.volumeVisualizer.add(cube);

      // Increment counter
      cubeCount++;

      // Display progress periodically to keep UI responsive for large grids
      // if (cubeCount % 1000 === 0) {
      // console.log(`Created ${cubeCount} cubes...`);
      // }
    }

    const textContent = lines.join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'vectors.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`3D signal propagation visualization complete. Created ${cubeCount} cubes.`);

    // const buildings2 = this.getBuildingObjects();
    // const buildingMeshes = buildings2.filter(obj => obj instanceof THREE.Mesh);
    // this.addIndoorSignalCubes(buildingMeshes);

    // Initially hide the 3D visualization
    // this.toggleVisualizationMode(false);
  }

  addIndoorSignalCubes(buildingMeshes, cubeSize = 5) {
    this.clear3DVisualization();
    this.updateValues();
    const signalSource = this.transmitterPosition;

    console.log(`Total no.of buildings: ${buildingMeshes.length}`);
    let temp__ = 1;
    
    let tempBtn = document.getElementById('oti_bt');
    buildingMeshes.forEach(building => {
      tempBtn.textContent = `Calculating... ${temp__}/${buildingMeshes.length}`;
      const bbox = new THREE.Box3().setFromObject(building);
      const min = bbox.min;
      const max = bbox.max;

      for (let x = min.x; x < max.x; x += cubeSize) {
        for (let y = min.y; y < max.y; y += cubeSize) {
          for (let z = min.z; z < max.z; z += cubeSize) {
            const point = new THREE.Vector3(
              x + cubeSize / 2,
              y + cubeSize / 2,
              z + cubeSize / 2
            );

            if (this.isPointInsideMesh(point, building)) {
              const distance = point.distanceTo(signalSource);
              let strength = NaN;
              let pl_b = NaN;
              let pl_in = NaN;
              let pl_tw = NaN;
              let d2d_in = NaN;
              let pl = NaN;

              [strength, d2d_in, pl, pl_in, pl_b, pl_tw] = this.computeSignalStrength(distance, point);
              const color = this.getColorForSignalStrength(strength);

              const cubeGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
              const cubeMat = new THREE.MeshLambertMaterial({
                color,
                transparent: true,
                opacity: 0.15,
              });

              const cube = new THREE.Mesh(cubeGeo, cubeMat);
              cube.position.copy(point);
              cube.userData = {
                signalStrength: strength,
                distance_2D: d2d_in,
                distance: distance,
                pathLoss: pl,
                pl_b: pl_b,
                pl_in: pl_in,
                pl_tw: pl_tw,
                build_name: building.parent.name
              }
              cube.name = 'cube';

              // scene.add(cube);
              if (this.volumeVisualizer == null) {
                this.volumeVisualizer = new THREE.Group();
                this.scene.add(this.volumeVisualizer);
              }
              this.volumeCubes.push(cube);

              // Add to group
              this.volumeVisualizer.add(cube);
              this.volumeVisualizer.visible = this.is3DVisualizationActive;
            }
          }
        }
      }
      // console.log(`Buildings done: ${temp__}`);
      temp__ = temp__ + 1;
    });
    this.createSignalLegend();
  }


  // Utility to check if a point is inside a mesh using raycasting
  isPointInsideMesh(point, mesh) {
    const direction = new THREE.Vector3(1, 0, 0); // Arbitrary
    const raycaster = new THREE.Raycaster(point, direction, 0, 10000);
    const intersects = raycaster.intersectObject(mesh, true);
    return intersects.length % 2 === 1;
  }

  // Dummy signal strength computation
  computeSignalStrength(distance, point) {

    const pl_b = this.calculatePathLoss(distance, false);

    const pl_tw = 5 - (10 * Math.log10((0.3 * Math.pow(10, -(2 + 0.2 * SIGNAL_CONSTANTS.frequency) / 10)) + (0.7 * Math.pow(10, -(5 + 4 * SIGNAL_CONSTANTS.frequency) / 10))));
    // console.dir(point);
    // console.dir(this.transmitterPosition);
    const ground_point = new THREE.Vector3(
      point.x,
      0,
      point.z
    );
    const ground_trans = new THREE.Vector3(
      this.transmitterPosition.x,
      0,
      this.transmitterPosition.z
    );

    const total_2d = ground_point.distanceTo(ground_trans);
    const total_3d = distance;

    const direction = new THREE.Vector3().subVectors(this.transmitterPosition, point).normalize();

    this.raycaster.layers.set(0);
    // Set up raycaster
    this.raycaster.set(point, direction);



    // // Find intersections with buildings
    // const intersects = this.raycaster.intersectObjects(this.getBuildingObjects(), true);

    const intersects = this.raycaster.intersectObjects(this.getBuildingObjects(), true);
    // console.dir(intersects)

    let d3d_in = 0;
    try {
      d3d_in = intersects[0].distance;
    } catch (error) {
      d3d_in = 0;
    }

    const ratio = total_2d / total_3d;

    const d2d_in = ratio * d3d_in;

    const pl_in = 0.5 * d2d_in;

    const path_loss_total = pl_b + pl_in + pl_tw;

    const strength = this.calculateSignalStrength(path_loss_total, point);


    return [strength, d2d_in, path_loss_total, pl_in, pl_b, pl_tw];
  }

  // Convert signal strength to color
  getColorFromSignal(strength) {
    const minStrength = -90;
    const maxStrength = -30;
    const t = (strength - minStrength) / (maxStrength - minStrength);
    const r = Math.max(0, 1.5 * (1 - t));
    const g = Math.max(0, 1.5 * t);
    return new THREE.Color(r, g, 0);
  }




  // Method to update opacity settings for volume visualization
  updateVolumeOpacity(opacity) {
    this.volumeOpacity = opacity;

    // Update all existing cubes
    this.volumeCubes.forEach(cube => {
      if (cube.material) {
        // Get normalized signal strength from the cube's userData
        const signalStrength = cube.userData.signalStrength;
        const normalizedStrength = (signalStrength - SIGNAL_CONSTANTS.minSignalStrength) /
          (SIGNAL_CONSTANTS.maxSignalStrength - SIGNAL_CONSTANTS.minSignalStrength);

        // Update opacity based on signal strength
        cube.material.opacity = this.volumeOpacity * (0.5 + normalizedStrength * 0.5);
        cube.material.needsUpdate = true;
      }
    });
  }

  // Method to update vertical resolution for 3D grid
  updateVerticalResolution(resolution) {
    if (resolution !== this.verticalResolution) {
      this.verticalResolution = resolution;

      // If 3D visualization is active, recalculate it
      if (this.is3DVisualizationActive && this.volumeVisualizer) {
        this.calculate3DSignalPropagation();
      }
    }
  }

  // Helper method to check if a point is inside a building
  isPointInsideBuilding(point) {
    const buildings = this.getBuildingObjects();

    // Convert buildings array to ensure we have the structure expected
    const buildingMeshes = buildings.filter(obj => obj instanceof THREE.Mesh);

    // Use raycasting technique to check if point is inside
    // Cast rays in 6 principal directions (±X, ±Y, ±Z)
    const directions = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ];

    // Simple optimization - only fully check if we're above ground level
    if (point.y <= 0.1) return false;

    // Performance optimization for large scenes: First do a bounding box check
    for (const building of buildingMeshes) {
      // Get building bounding box
      const boundingBox = new THREE.Box3().setFromObject(building);

      // Check if point is inside the bounding box
      if (boundingBox.containsPoint(point)) {
        // For curved buildings, we'd need more precise checking here
        // But for simple buildings, this is sufficient
        return true;
      }
    }

    return false;
  }

  // Clear 3D visualization
  clear3DVisualization() {
    if (this.volumeVisualizer) {
      // Remove from scene
      this.scene.remove(this.volumeVisualizer);

      // Dispose of geometries and materials to free memory
      this.volumeVisualizer.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          if (node.geometry) node.geometry.dispose();
          if (node.material) {
            if (Array.isArray(node.material)) {
              node.material.forEach(material => material.dispose());
            } else {
              node.material.dispose();
            }
          }
        }
      });

      this.volumeVisualizer = null;
      this.volumeCubes = [];
    }
  }

  // Toggle between 2D and 3D visualization modes
  toggleVisualizationMode(use3D) {
    this.is3DVisualizationActive = use3D;

    // Show/hide the appropriate visualization
    if (this.gridVisualizer) {
      this.gridVisualizer.visible = !use3D;
    }

    if (this.volumeVisualizer) {
      this.volumeVisualizer.visible = use3D;
    } else if (use3D) {
      // Calculate 3D visualization if it doesn't exist yet
      // this.calculate3DSignalPropagation();
    }
  }

}

// Create UI controls for signal propagation
function createSignalControls(signalPropagation) {
  // Create signal container
  const signalContainer = document.createElement('div');
  signalContainer.style.position = 'absolute';
  signalContainer.style.top = '10px';
  signalContainer.style.right = '10px';
  signalContainer.style.background = 'rgba(255, 255, 255, 0.8)';
  signalContainer.style.padding = '10px';
  signalContainer.style.borderRadius = '5px';
  signalContainer.style.fontFamily = 'Arial, sans-serif';
  signalContainer.style.width = '250px';
  document.body.appendChild(signalContainer);

  // Add title
  const title = document.createElement('div');
  title.textContent = 'Signal Propagation Controls ▾'; // dropdown arrow
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '10px';
  title.style.cursor = 'pointer';
  signalContainer.appendChild(title);

  // Content wrapper for all other controls
  const contentWrapper = document.createElement('div');
  contentWrapper.id = 'signal-content';
  signalContainer.appendChild(contentWrapper);

  // Initially show content (or set to 'none' to start minimized)
  let isExpanded = true;

  // Toggle dropdown on title click
  title.addEventListener('click', () => {
    isExpanded = !isExpanded;
    contentWrapper.style.display = isExpanded ? 'block' : 'none';
    title.textContent = isExpanded ? 'Signal Propagation Controls ▾' : 'Signal Propagation Controls ▸';
  });

  // 1. Create Settings button
  const settingsButton = document.createElement('button');
  settingsButton.style.width = '100%';
  settingsButton.style.padding = '5px';
  settingsButton.style.marginTop = '5px';
  settingsButton.style.marginBottom = '10px';
  settingsButton.textContent = 'Transmitter Settings';
  contentWrapper.appendChild(settingsButton);

  // 2. Create modal popup container (hidden by default)
  const popupOverlay = document.createElement('div');
  popupOverlay.style.position = 'fixed';
  popupOverlay.style.top = 0;
  popupOverlay.style.left = 0;
  popupOverlay.style.width = '100vw';
  popupOverlay.style.height = '100vh';
  popupOverlay.style.background = 'rgba(0, 0, 0, 0.5)';
  popupOverlay.style.display = 'none'; // hidden by default
  popupOverlay.style.justifyContent = 'center';
  popupOverlay.style.alignItems = 'center';
  popupOverlay.style.zIndex = '999';

  const popup = document.createElement('div');
  popup.style.background = '#fff';
  popup.style.padding = '20px';
  popup.style.borderRadius = '8px';
  popup.style.minWidth = '300px';
  popup.style.fontFamily = 'Arial, sans-serif';

  // Heading
  const heading = document.createElement('h3');
  heading.textContent = 'Transmitter Settings';
  popup.appendChild(heading);

  // Transmitter height slider
  const heightLabel = document.createElement('label');
  heightLabel.textContent = 'Height (m): ';
  popup.appendChild(heightLabel);

  const heightSlider = document.createElement('input');
  heightSlider.type = 'range';
  heightSlider.min = '5';
  heightSlider.max = '50';
  heightSlider.step = '1';
  heightSlider.value = signalPropagation.transmitterHeight;
  heightSlider.style.width = '100%';
  heightSlider.style.margin = '5px 0';

  const heightValue = document.createElement('span');
  heightValue.textContent = heightSlider.value + ' m';

  heightSlider.addEventListener('input', () => {
    signalPropagation.transmitterHeight = parseInt(heightSlider.value);
    heightValue.textContent = heightSlider.value + ' m';

    // Update transmitter if already placed
    if (signalPropagation.transmitter) {
      const position = signalPropagation.transmitter.position;
      signalPropagation.placeTransmitter(position.x, position.z, signalPropagation.transmitterHeight);
      signalPropagation.placementModeEnabled = false;

      let tempBox = document.getElementById('placement-mode')
      tempBox.checked = false;
    }
  });

  popup.appendChild(heightValue);
  popup.appendChild(heightSlider);
  popup.appendChild(document.createElement('br'));

  // Frequency input

  const freqWrapper = document.createElement('div');
  freqWrapper.style.display = 'flex';
  freqWrapper.style.alignItems = 'center';
  freqWrapper.style.marginBottom = '10px';

  const freqLabel = document.createElement('label');
  freqLabel.textContent = 'Frequency (GHz): ';
  freqWrapper.appendChild(freqLabel);

  const frequencyInput = document.createElement('input');
  frequencyInput.type = 'number';
  frequencyInput.min = '0.5';
  frequencyInput.max = '100';
  frequencyInput.step = '0.1';
  frequencyInput.value = SIGNAL_CONSTANTS.frequency;
  frequencyInput.style.width = '25%';
  frequencyInput.style.marginLeft = '10px';

  frequencyInput.addEventListener('input', () => {
    SIGNAL_CONSTANTS.frequency = parseInt(frequencyInput.value);
  });
  freqWrapper.appendChild(frequencyInput);

  popup.appendChild(freqWrapper);

  // Transmitter Power input
  const powWrapper = document.createElement('div');
  powWrapper.style.display = 'flex';
  powWrapper.style.alignItems = 'center';
  powWrapper.style.marginBottom = '10px';

  const powLabel = document.createElement('label');
  powLabel.textContent = 'Power (dBm): ';
  powWrapper.appendChild(powLabel);

  const powInput = document.createElement('input');
  powInput.type = 'number';
  powInput.min = '0.5';
  powInput.max = '100';
  powInput.step = '0.1';
  powInput.value = SIGNAL_CONSTANTS.transmitterPower;
  powInput.style.width = '25%';
  powInput.style.marginLeft = '10px';

  powInput.addEventListener('input', () => {
    SIGNAL_CONSTANTS.transmitterPower = parseInt(powInput.value);
  });
  powWrapper.appendChild(powInput);

  popup.appendChild(powWrapper);

  // Dropdown input
const dropdownWrapper = document.createElement('div');
dropdownWrapper.style.display = 'flex';
dropdownWrapper.style.alignItems = 'center';
dropdownWrapper.style.marginBottom = '10px';

const dropdownLabel = document.createElement('label');
dropdownLabel.textContent = 'Select Directivity Function: ';
dropdownWrapper.appendChild(dropdownLabel);

const dropdown = document.createElement('select');
dropdown.style.width = '25%';
dropdown.style.marginLeft = '10px';

['omnidirectional', 'cardioid', 'parabolic'].forEach(value => {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = value.charAt(0).toUpperCase() + value.slice(1); // Capitalize first letter
  dropdown.appendChild(option);
});

dropdown.value = signalPropagation.antennaGainPattern;

dropdown.addEventListener('change', () => {
  signalPropagation.antennaGainPattern = dropdown.value;
  // Optionally update a constant or trigger a UI update
});

dropdownWrapper.appendChild(dropdown);
popup.appendChild(dropdownWrapper);


  // Gain input
  const gainWrapper = document.createElement('div');
  gainWrapper.style.display = 'flex';
  gainWrapper.style.alignItems = 'center';
  gainWrapper.style.marginBottom = '10px';

  const gainLabel = document.createElement('label');
  gainLabel.textContent = 'Tx Gain (dBi): ';
  gainWrapper.appendChild(gainLabel);

  const gainInput = document.createElement('input');
  gainInput.type = 'number';
  gainInput.min = '0.5';
  gainInput.max = '100';
  gainInput.step = '0.1';
  gainInput.value = SIGNAL_CONSTANTS.transmitterGain;
  gainInput.style.width = '25%';
  gainInput.style.marginLeft = '10px';

  gainInput.addEventListener('input', () => {
    SIGNAL_CONSTANTS.transmitterGain = parseInt(gainInput.value);
  });
  gainWrapper.appendChild(gainInput);

  const rgainLabel = document.createElement('label');
  rgainLabel.textContent = 'Rx Gain (dBi): ';
  rgainLabel.style.marginLeft = '30px';
  gainWrapper.appendChild(rgainLabel);

  const rgainInput = document.createElement('input');
  rgainInput.type = 'number';
  rgainInput.min = '0.5';
  rgainInput.max = '100';
  rgainInput.step = '0.1';
  rgainInput.value = SIGNAL_CONSTANTS.receiverGain;
  rgainInput.style.width = '25%';
  rgainInput.style.marginLeft = '10px';

  rgainInput.addEventListener('input', () => {
    SIGNAL_CONSTANTS.receiverGain = parseInt(rgainInput.value);
  });
  gainWrapper.appendChild(rgainInput);

  popup.appendChild(gainWrapper);

  // StdDev input
  const devWrapper = document.createElement('div');
  devWrapper.style.display = 'flex';
  devWrapper.style.alignItems = 'center';
  devWrapper.style.marginBottom = '10px';

  const losLabel = document.createElement('label');
  losLabel.textContent = 'Std Dev LOS: ';
  devWrapper.appendChild(losLabel);

  const losInput = document.createElement('input');
  losInput.type = 'number';
  losInput.min = '0.5';
  losInput.max = '100';
  losInput.step = '0.1';
  losInput.value = SIGNAL_CONSTANTS.shadowingStdDevLOS;
  losInput.style.width = '25%';
  losInput.style.marginLeft = '10px';

  losInput.addEventListener('input', () => {
    SIGNAL_CONSTANTS.shadowingStdDevLOS = parseInt(losInput.value);
  });
  devWrapper.appendChild(losInput);

  const nlosLabel = document.createElement('label');
  nlosLabel.textContent = 'Std Dev NLOS: ';
  nlosLabel.style.marginLeft = '30px';
  devWrapper.appendChild(nlosLabel);

  const nlosInput = document.createElement('input');
  nlosInput.type = 'number';
  nlosInput.min = '0.5';
  nlosInput.max = '100';
  nlosInput.step = '0.1';
  nlosInput.value = SIGNAL_CONSTANTS.shadowingStdDevNLOS;
  nlosInput.style.width = '25%';
  nlosInput.style.marginLeft = '10px';

  nlosInput.addEventListener('input', () => {
    SIGNAL_CONSTANTS.shadowingStdDevNLOS = parseInt(nlosInput.value);
  });
  devWrapper.appendChild(nlosInput);

  popup.appendChild(devWrapper);

  // Legend input
  const legWrapper = document.createElement('div');
  legWrapper.style.display = 'flex';
  legWrapper.style.alignItems = 'center';
  legWrapper.style.marginBottom = '10px';

  const minLabel = document.createElement('label');
  minLabel.textContent = 'Min Sig Strength (dBm): ';
  legWrapper.appendChild(minLabel);

  const minInput = document.createElement('input');
  minInput.type = 'number';
  minInput.min = '0.5';
  minInput.max = '100';
  minInput.step = '0.1';
  minInput.value = SIGNAL_CONSTANTS.minSignalStrength;
  minInput.style.width = '25%';
  minInput.style.marginLeft = '10px';

  minInput.addEventListener('input', () => {
    SIGNAL_CONSTANTS.minSignalStrength = parseInt(minInput.value);
    signalColors = gradientColors.map((color, index, arr) => {
      const level = SIGNAL_CONSTANTS.maxSignalStrength -
        ((SIGNAL_CONSTANTS.maxSignalStrength - SIGNAL_CONSTANTS.minSignalStrength) / (arr.length - 1)) * index;
      return { level, color };
    });
  });
  legWrapper.appendChild(minInput);

  const maxLabel = document.createElement('label');
  maxLabel.textContent = 'Max Sig Strength (dBm): ';
  maxLabel.style.marginLeft = '30px';
  legWrapper.appendChild(maxLabel);

  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.min = '0.5';
  maxInput.max = '100';
  maxInput.step = '0.1';
  maxInput.value = SIGNAL_CONSTANTS.maxSignalStrength;
  maxInput.style.width = '25%';
  maxInput.style.marginLeft = '10px';

  maxInput.addEventListener('input', () => {
    SIGNAL_CONSTANTS.maxSignalStrength = parseInt(maxInput.value);
    signalColors = gradientColors.map((color, index, arr) => {
      const level = SIGNAL_CONSTANTS.maxSignalStrength -
        ((SIGNAL_CONSTANTS.maxSignalStrength - SIGNAL_CONSTANTS.minSignalStrength) / (arr.length - 1)) * index;
      return { level, color };
    });
  });
  legWrapper.appendChild(maxInput);

  popup.appendChild(legWrapper);

  // Apply button
  // const applyButton = document.createElement('button');
  // applyButton.textContent = 'Apply';
  // applyButton.style.marginTop = '10px';
  // popup.appendChild(applyButton);

  // Close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.marginTop = '10px';
  closeButton.style.marginLeft = '170px';
  popup.appendChild(closeButton);

  // Append popup to overlay
  popupOverlay.appendChild(popup);
  document.body.appendChild(popupOverlay);

  // 3. Add event listeners
  settingsButton.addEventListener('click', () => {
    popupOverlay.style.display = 'flex';
  });

  closeButton.addEventListener('click', () => {
    popupOverlay.style.display = 'none';
  });

  // applyButton.addEventListener('click', () => {
  //   signalPropagation.transmitterHeight = parseInt(heightSlider.value);
  //   signalPropagation.frequency = parseFloat(frequencyInput.value);
  //   heightValue.textContent = heightSlider.value + ' m';

  //   // Update transmitter if placed
  //   if (signalPropagation.transmitter) {
  //     const position = signalPropagation.transmitter.position;
  //     signalPropagation.placeTransmitter(position.x, position.z, signalPropagation.transmitterHeight);
  //   }

  //   popupOverlay.style.display = 'none';
  // });


  // const heightSlider = document.createElement('input');
  // heightSlider.type = 'range';
  // heightSlider.id = 'tx-height';
  // heightSlider.min = '5';
  // heightSlider.max = '50';
  // heightSlider.step = '1';
  // heightSlider.value = signalPropagation.transmitterHeight;
  // heightSlider.style.width = '100%';
  // heightSlider.style.marginTop = '5px';
  // heightSlider.addEventListener('input', () => {
  //   signalPropagation.transmitterHeight = parseInt(heightSlider.value);
  //   heightValue.textContent = heightSlider.value;

  //   // Update transmitter if already placed
  //   if (signalPropagation.transmitter) {
  //     const position = signalPropagation.transmitter.position;
  //     signalPropagation.placeTransmitter(position.x, position.z, signalPropagation.transmitterHeight);
  //   }
  // });
  // heightContainer.appendChild(heightSlider);
  // signalContainer.appendChild(heightContainer);

  // Add grid resolution control
  const resolutionContainer = document.createElement('div');
  resolutionContainer.style.marginBottom = '10px';

  const resolutionLabel = document.createElement('label');
  resolutionLabel.textContent = 'Grid Resolution (m): ';
  resolutionLabel.setAttribute('for', 'grid-resolution');
  resolutionContainer.appendChild(resolutionLabel);

  const resolutionValue = document.createElement('span');
  resolutionValue.id = 'grid-resolution-value';
  resolutionValue.textContent = signalPropagation.gridResolution;
  resolutionValue.style.marginLeft = '5px';
  resolutionContainer.appendChild(resolutionValue);

  const resolutionSlider = document.createElement('input');
  resolutionSlider.type = 'range';
  resolutionSlider.id = 'grid-resolution';
  resolutionSlider.min = '1';
  resolutionSlider.max = '20';
  resolutionSlider.step = '1';
  resolutionSlider.value = signalPropagation.gridResolution;
  resolutionSlider.style.width = '100%';
  resolutionSlider.style.marginTop = '5px';
  resolutionSlider.addEventListener('input', () => {
    signalPropagation.gridResolution = parseInt(resolutionSlider.value);
    resolutionValue.textContent = resolutionSlider.value;

    // No need to recalculate immediately as this could be expensive
  });
  resolutionContainer.appendChild(resolutionSlider);
  contentWrapper.appendChild(resolutionContainer);

  // Add transmitter placement instructions
  const instructions = document.createElement('div');
  instructions.style.marginBottom = '10px';
  instructions.style.fontSize = '12px';
  instructions.style.fontStyle = 'italic';
  instructions.textContent = 'Click on the ground to place the transmitter. Click "Calculate" to update signal propagation.';
  contentWrapper.appendChild(instructions);

  // Add calculate button
  const calculateButton = document.createElement('button');
  calculateButton.textContent = 'Calculate Signal Propagation';
  calculateButton.style.width = '100%';
  calculateButton.style.padding = '5px';
  calculateButton.style.marginTop = '5px';
  calculateButton.addEventListener('click', () => {
    if (signalPropagation.transmitter) {
      calculateButton.textContent = 'Calculating...';
      calculateButton.disabled = true;

      // Use setTimeout to allow UI to update before heavy calculation
      setTimeout(() => {
        signalPropagation.calculateSignalPropagation();
        calculateButton.textContent = 'Calculate Signal Propagation';
        calculateButton.disabled = false;
      }, 100);
    } else {
      alert('Please place a transmitter first by clicking on the ground.');
    }
  });
  contentWrapper.appendChild(calculateButton);

  // Add toggle visibility button
  const toggleButton = document.createElement('button');
  toggleButton.textContent = 'Hide Signal Overlay';
  toggleButton.style.width = '100%';
  toggleButton.style.padding = '5px';
  toggleButton.style.marginTop = '10px';
  toggleButton.addEventListener('click', () => {
    if (signalPropagation.gridVisualizer) {
      if (signalPropagation.gridVisualizer.visible) {
        signalPropagation.gridVisualizer.visible = false;
        toggleButton.textContent = 'Show Signal Overlay';
      } else {
        signalPropagation.gridVisualizer.visible = true;
        toggleButton.textContent = 'Hide Signal Overlay';
      }
    }
  });
  contentWrapper.appendChild(toggleButton);

  // Add placement mode toggle
  const placementModeContainer = document.createElement('div');
  placementModeContainer.style.marginTop = '10px';

  const placementModeCheckbox = document.createElement('input');
  placementModeCheckbox.type = 'checkbox';
  placementModeCheckbox.id = 'placement-mode';
  placementModeCheckbox.checked = false; // Default to disabled

  // Store the placement mode state in the signalPropagation object
  signalPropagation.placementModeEnabled = false;

  placementModeCheckbox.addEventListener('change', () => {
    signalPropagation.placementModeEnabled = placementModeCheckbox.checked;
  });



  const placementModeLabel = document.createElement('label');
  placementModeLabel.htmlFor = 'placement-mode';
  placementModeLabel.textContent = 'Enable Transmitter Placement Mode';
  placementModeLabel.style.marginLeft = '5px';

  placementModeContainer.appendChild(placementModeCheckbox);
  placementModeContainer.appendChild(placementModeLabel);
  contentWrapper.appendChild(placementModeContainer);

  // ... rest of existing code ...

  // --------------------------------- 3D visualization UI --------------------------------

  const divider = document.createElement('hr');
  divider.style.margin = '15px 0';
  contentWrapper.appendChild(divider);

  // Add 3D Visualization section title
  const viz3DTitle = document.createElement('div');
  viz3DTitle.textContent = '3D Visualization Settings';
  viz3DTitle.style.fontWeight = 'bold';
  viz3DTitle.style.marginBottom = '10px';
  contentWrapper.appendChild(viz3DTitle);

  // Add toggle between 2D and 3D visualization
  const vizModeContainer = document.createElement('div');
  vizModeContainer.style.marginBottom = '10px';

  const vizModeCheckbox = document.createElement('input');
  vizModeCheckbox.type = 'checkbox';
  vizModeCheckbox.id = 'viz-3d-mode';
  vizModeCheckbox.checked = signalPropagation.is3DVisualizationActive;

  vizModeCheckbox.addEventListener('change', () => {
    // Show loading indicator for large grids
    // const loadingMsg = document.createElement('div');
    // loadingMsg.textContent = 'Calculating 3D visualization...';
    // loadingMsg.style.position = 'absolute';
    // loadingMsg.style.top = '50%';
    // loadingMsg.style.left = '50%';
    // loadingMsg.style.transform = 'translate(-50%, -50%)';
    // loadingMsg.style.background = 'rgba(0,0,0,0.7)';
    // loadingMsg.style.color = 'white';
    // loadingMsg.style.padding = '20px';
    // loadingMsg.style.borderRadius = '5px';
    // loadingMsg.style.zIndex = '1000';
    // document.body.appendChild(loadingMsg);

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      signalPropagation.toggleVisualizationMode(vizModeCheckbox.checked);
      // document.body.removeChild(loadingMsg);
    }, 10);
  });

  const vizModeLabel = document.createElement('label');
  vizModeLabel.htmlFor = 'viz-3d-mode';
  vizModeLabel.textContent = 'Use 3D Volumetric Visualization';
  vizModeLabel.style.marginLeft = '5px';

  vizModeContainer.appendChild(vizModeCheckbox);
  vizModeContainer.appendChild(vizModeLabel);
  contentWrapper.appendChild(vizModeContainer);

  // Add vertical resolution control
  const vResContainer = document.createElement('div');
  vResContainer.style.marginBottom = '10px';

  const vResLabel = document.createElement('label');
  vResLabel.textContent = 'Vertical Resolution (m): ';
  vResLabel.setAttribute('for', 'vertical-resolution');
  vResContainer.appendChild(vResLabel);

  const vResValue = document.createElement('span');
  vResValue.id = 'vertical-resolution-value';
  vResValue.textContent = signalPropagation.verticalResolution;
  vResValue.style.marginLeft = '5px';
  vResContainer.appendChild(vResValue);

  const vResSlider = document.createElement('input');
  vResSlider.type = 'range';
  vResSlider.id = 'vertical-resolution';
  vResSlider.min = '2';
  vResSlider.max = '20';
  vResSlider.step = '1';
  vResSlider.value = signalPropagation.verticalResolution;
  vResSlider.style.width = '100%';
  vResSlider.style.marginTop = '5px';
  vResSlider.addEventListener('input', () => {
    signalPropagation.verticalResolution = parseInt(vResSlider.value);
    vResValue.textContent = vResSlider.value;

    // No need to recalculate immediately as this could be expensive
  });
  vResContainer.appendChild(vResSlider);
  contentWrapper.appendChild(vResContainer);

  // Add opacity control for 3D visualization
  const opacityContainer = document.createElement('div');
  opacityContainer.style.marginBottom = '10px';

  const opacityLabel = document.createElement('label');
  opacityLabel.textContent = 'Volume Opacity: ';
  opacityLabel.setAttribute('for', 'volume-opacity');
  opacityContainer.appendChild(opacityLabel);

  const opacityValue = document.createElement('span');
  opacityValue.id = 'volume-opacity-value';
  opacityValue.textContent = signalPropagation.volumeOpacity.toFixed(2);
  opacityValue.style.marginLeft = '5px';
  opacityContainer.appendChild(opacityValue);

  const opacitySlider = document.createElement('input');
  opacitySlider.type = 'range';
  opacitySlider.id = 'volume-opacity';
  opacitySlider.min = '0.05';
  opacitySlider.max = '0.5';
  opacitySlider.step = '0.01';
  opacitySlider.value = signalPropagation.volumeOpacity;
  opacitySlider.style.width = '100%';
  opacitySlider.style.marginTop = '5px';
  opacitySlider.addEventListener('input', () => {
    const opacity = parseFloat(opacitySlider.value);
    signalPropagation.volumeOpacity = opacity;
    opacityValue.textContent = opacity.toFixed(2);
    signalPropagation.updateVolumeOpacity(opacity);
  });
  opacityContainer.appendChild(opacitySlider);
  contentWrapper.appendChild(opacityContainer);

  // Add max height control for 3D visualization
  const maxHeightContainer = document.createElement('div');
  maxHeightContainer.style.marginBottom = '10px';

  const maxHeightLabel = document.createElement('label');
  maxHeightLabel.textContent = 'Max Visualization Height (m): ';
  maxHeightLabel.setAttribute('for', 'max-viz-height');
  maxHeightContainer.appendChild(maxHeightLabel);

  const maxHeightValue = document.createElement('span');
  maxHeightValue.id = 'max-viz-height-value';
  maxHeightValue.textContent = signalPropagation.maxVisualizationHeight;
  maxHeightValue.style.marginLeft = '5px';
  maxHeightContainer.appendChild(maxHeightValue);

  const maxHeightSlider = document.createElement('input');
  maxHeightSlider.type = 'range';
  maxHeightSlider.id = 'max-viz-height';
  maxHeightSlider.min = '10';
  maxHeightSlider.max = '200';
  maxHeightSlider.step = '10';
  maxHeightSlider.value = signalPropagation.maxVisualizationHeight;
  maxHeightSlider.style.width = '100%';
  maxHeightSlider.style.marginTop = '5px';
  maxHeightSlider.addEventListener('input', () => {
    signalPropagation.maxVisualizationHeight = parseInt(maxHeightSlider.value);
    maxHeightValue.textContent = maxHeightSlider.value;

    // No need to recalculate immediately
  });
  maxHeightContainer.appendChild(maxHeightSlider);
  contentWrapper.appendChild(maxHeightContainer);

  // Add button to apply 3D visualization settings
  const apply3DSettingsButton = document.createElement('button');
  apply3DSettingsButton.id = 'calcBtn';
  apply3DSettingsButton.textContent = 'Calculate 3D Singnal Strength';
  apply3DSettingsButton.style.width = '100%';
  apply3DSettingsButton.style.padding = '5px';
  apply3DSettingsButton.style.marginTop = '10px';
  apply3DSettingsButton.addEventListener('click', () => {
    if (signalPropagation.is3DVisualizationActive) {

      // Show loading indicator for large grids
      const loadingMsg = document.createElement('div');
      loadingMsg.textContent = 'Calculating 3D Outdoor Visualization...';
      loadingMsg.style.position = 'absolute';
      loadingMsg.style.top = '50%';
      loadingMsg.style.left = '50%';
      loadingMsg.style.transform = 'translate(-50%, -50%)';
      loadingMsg.style.background = 'rgba(0,0,0,0.7)';
      loadingMsg.style.color = 'white';
      loadingMsg.style.padding = '20px';
      loadingMsg.style.borderRadius = '5px';
      loadingMsg.style.zIndex = '1000';
      document.body.appendChild(loadingMsg);

      apply3DSettingsButton.textContent = 'Calculating...';
      apply3DSettingsButton.disabled = true;

      // Use setTimeout to allow UI to update before heavy calculation
      setTimeout(() => {
        signalPropagation.calculate3DSignalPropagation();
        apply3DSettingsButton.textContent = 'Calculate 3D Singnal Strength';
        apply3DSettingsButton.disabled = false;
        document.body.removeChild(loadingMsg);
      }, 100);
    } else {
      alert('Please enable 3D visualization first.');
    }
  });
  contentWrapper.appendChild(apply3DSettingsButton);

  const oti = document.createElement('button');
  oti.textContent = 'Calculate OTI';
  oti.id = 'oti_bt';
  oti.style.width = '100%';
  oti.style.padding = '5px';
  oti.style.marginTop = '10px';
  oti.addEventListener('click', () => {
    if (!signalPropagation.is3DVisualizationActive) {
      alert('Please enable 3D visualization first.');
      return;
    }
    if (signalPropagation.transmitter) {
      const loadingMsg = document.createElement('div');
      loadingMsg.textContent = 'Calculating 3D Indoor Visualization...';
      loadingMsg.style.position = 'absolute';
      loadingMsg.style.top = '50%';
      loadingMsg.style.left = '50%';
      loadingMsg.style.transform = 'translate(-50%, -50%)';
      loadingMsg.style.background = 'rgba(0,0,0,0.7)';
      loadingMsg.style.color = 'white';
      loadingMsg.style.padding = '20px';
      loadingMsg.style.borderRadius = '5px';
      loadingMsg.style.zIndex = '1000';
      document.body.appendChild(loadingMsg);
      oti.textContent = 'Calculating...';
      oti.disabled = true;

      // Use setTimeout to allow UI to update before heavy calculation
      setTimeout(() => {
        const buildings2 = signalPropagation.getBuildingObjects();
        const buildingMeshes = buildings2.filter(obj => obj instanceof THREE.Mesh);
        signalPropagation.addIndoorSignalCubes(buildingMeshes, 5);
        oti.textContent = 'Calculate OTI';
        oti.disabled = false;
        document.body.removeChild(loadingMsg);
      }, 100);
    }
    else {
      alert('Please place a transmitter first by clicking on the ground.');
    }
  });
  contentWrapper.appendChild(oti);

  // Add explanatory note about performance
  const perfNote = document.createElement('div');
  perfNote.style.fontSize = '11px';
  perfNote.style.fontStyle = 'italic';
  perfNote.style.marginTop = '10px';
  perfNote.textContent = 'Note: Lower resolutions and smaller visualization heights will improve performance.';
  contentWrapper.appendChild(perfNote);

  return signalContainer;
}

// Initialize signal propagation system
let signalPropagation;
let raycaster;
let mouse;

// Function to initialize signal propagation
function initSignalPropagation() {
  console.log("Initializing signal propagation system");

  // Initialize the signal propagation system
  signalPropagation = new SignalPropagation(scene);

  // Create UI controls
  createSignalControls(signalPropagation);

  // Initialize raycaster for ground clicks
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Add click event listener for transmitter placement
  window.addEventListener('click', onMouseClick, false);

  // Add hover event listener for signal strength information
  window.addEventListener('mousemove', onmousemove, false);

  // Create hover info box
  createHoverInfoBox();

  console.log("Signal propagation system initialized");
}

// -------------- 3D -- Create hover info box -----------------
function createHoverInfoBox() {
  const infoBox = document.createElement('div');
  infoBox.id = 'signal-info-box';
  infoBox.style.position = 'absolute';
  infoBox.style.display = 'none';
  infoBox.style.background = 'rgba(0, 0, 0, 0.7)';
  infoBox.style.color = 'white';
  infoBox.style.padding = '10px';
  infoBox.style.borderRadius = '5px';
  infoBox.style.fontFamily = 'Arial, sans-serif';
  infoBox.style.fontSize = '12px';
  infoBox.style.pointerEvents = 'none'; // Don't block mouse events
  infoBox.style.zIndex = '1000';
  document.body.appendChild(infoBox);
}

// Handle mouse clicks for transmitter placement


// Handle mouse clicks for transmitter placement
function onMouseClick(event) {
  // Only handle left clicks (button 0) and only if placement mode is enabled
  if (event.button !== 0 || !signalPropagation.placementModeEnabled) return;


  // Rest of the existing code...
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(ground);

  if (intersects.length > 0) {
    const point = intersects[0].point;
    signalPropagation.placeTransmitter(point.x, point.z, signalPropagation.transmitterHeight);
    signalPropagation.placementModeEnabled = false;
    console.log(`Placed transmitter at (${point.x.toFixed(2)}, ${point.z.toFixed(2)}) with height ${signalPropagation.transmitterHeight}m`);
    let tempBox = document.getElementById('placement-mode');
    tempBox.checked = false;
  }


}

function onmousemove(event) {
  // Only show info if 3D visualization is active
  if (!signalPropagation || !signalPropagation.is3DVisualizationActive) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(ground);


  // ------------------------------ 3D --------------------------------------

  if (signalPropagation.volumeVisualizer) {
    const intersects = raycaster.intersectObjects(signalPropagation.volumeCubes, false);

    // Get info box element
    const infoBox = document.getElementById('signal-info-box');

    if (intersects.length > 0) {
      // Get the first intersected cube
      const cube = intersects[0].object;

      // Position info box near mouse
      infoBox.style.left = `${event.clientX + 15}px`;
      infoBox.style.top = `${event.clientY + 15}px`;

      // Get signal data from cube
      const signalData = cube.userData;
      // Format and display signal information
      if (signalData.distance_2D) {
        infoBox.innerHTML = `
        <div><strong> ${signalData.build_name}</strong></div>
        <div><strong>Position:</strong> (${cube.position.x.toFixed(1)}, ${cube.position.y.toFixed(1)}, ${cube.position.z.toFixed(1)})</div>
        <div><strong>Signal Strength:</strong> ${signalData.signalStrength.toFixed(2)} dBm</div>
        <div><strong>Distance 2D:</strong> ${signalData.distance_2D.toFixed(2)} m</div>
        <div><strong>Distance:</strong> ${signalData.distance.toFixed(2)} m</div>
        <div><strong>Path Loss</strong> ${signalData.pathLoss.toFixed(2)} dB</div>
        <div><strong>PL_b</strong> ${signalData.pl_b.toFixed(2)} dB</div>
        <div><strong>PL_in</strong> ${signalData.pl_in.toFixed(2)} dB</div>
        <div><strong>PL_tw</strong> ${signalData.pl_tw.toFixed(2)} dB</div>
      `;
      }
      else {
        infoBox.innerHTML = `
        <div><strong>Position:</strong> (${cube.position.x.toFixed(1)}, ${cube.position.y.toFixed(1)}, ${cube.position.z.toFixed(1)})</div>
        <div><strong>Signal Strength:</strong> ${signalData.signalStrength.toFixed(2)} dBm</div>
        <div><strong>Path Loss:</strong> ${signalData.pathLoss.toFixed(2)} dB</div>
        <div><strong>Distance:</strong> ${signalData.distance.toFixed(2)} m</div>
        <div><strong>Line of Sight:</strong> ${signalData.hasLOS ? 'Yes' : 'No'}</div>
      `;
      }


      // Show info box
      infoBox.style.display = 'block';

      // Highlight the hovered cube
      if (cube.material) {
        // Store original opacity if not already stored
        if (cube.userData._originalOpacity === undefined) {
          cube.userData._originalOpacity = cube.material.opacity;
        }

        // Increase opacity for highlight effect
        cube.material.opacity = Math.min(1.0, cube.userData._originalOpacity * 2);
        cube.material.needsUpdate = true;
      }
    } else {
      // Hide info box when not hovering over a cube
      infoBox.style.display = 'none';

      // Reset all cubes to original opacity
      signalPropagation.volumeCubes.forEach(cube => {
        if (cube.material && cube.userData._originalOpacity !== undefined) {
          cube.material.opacity = cube.userData._originalOpacity;
          cube.material.needsUpdate = true;
          delete cube.userData._originalOpacity;
        }
      });
    }
  }

}

// Initialize signal propagation after scene loads
document.addEventListener('DOMContentLoaded', () => {
  // We'll initialize after a short delay to ensure THREE.js scene is ready
  setTimeout(initSignalPropagation, 1000);
});