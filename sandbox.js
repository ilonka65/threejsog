import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// 🎬 Core WebGL Initializer Engine
const scene = new THREE.Scene();
// Change this line to absolute pitch black so MultiplyBlending can zero out the white paper color!
scene.background = new THREE.Color(0x000000); 

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 40, 60);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// 🕹️ Fluid Navigation Controller (Fixes mouse-sticking lag)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.01; // Block camera from dipping beneath the map floor

// 🗾 Minimalist Geographic Vector Carpet Layer 
const textureLoader = new THREE.TextureLoader();
const floorTexture = textureLoader.load('/big_scrub_floor.png'); // Reads from your public folder

const floorGeometry = new THREE.PlaneGeometry(70, 70);
const floorMaterial = new THREE.MeshBasicMaterial({
    map: floorTexture,
    transparent: true,
    // Lower this value to let the dark grid lines show clearly through the paper fields!
    opacity: 0.45, 
    side: THREE.DoubleSide
    // You can remove or comment out the blending line here to let standard transparency take over
});

const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
floorMesh.rotation.x = -Math.PI / 2; // Position it perfectly flat like a floor carpet
scene.add(floorMesh);

// 💡 Ambient Visual Coordinates Grid Guide
const gridHelper = new THREE.GridHelper(70, 35, 0x44445c, 0x1f1f2e);
gridHelper.position.y = -0.01; // Sink slightly lower than the map to prevent visual flickering
scene.add(gridHelper);

/// 🟢 Leaf Green vs 🔵 Ocean Blue Bio-Matrix Array
const bioMatrixGroup = new THREE.Group();
bioMatrixGroup.position.set(0, 8, 0); // Floats elegantly right above your QGIS blueprint floor
scene.add(bioMatrixGroup);

// Loop parameters matching your active project lineage structures
const sampleSpecimens = [
    { origin: "Gondwana", lineage: "Gondwana" },
    { origin: "Malesian", lineage: "Malesian" },
    { origin: "Gondwana", lineage: "Gondwana" },
    { origin: "Malesian", lineage: "Malesian" }
];

sampleSpecimens.forEach((specimen, index) => {
    const isGondwana = specimen.origin === "Gondwana" || specimen.lineage === "Gondwana";
    let baseTrackColor = new THREE.Color();
    
    if (isGondwana) {
        baseTrackColor.setHSL(0.35 + (index * 0.01), 0.90, 0.45); // Gondwana Green
    } else {
        baseTrackColor.setHSL(0.55 + (index * 0.01), 0.95, 0.50); // Malesian Blue
    }

    const material = new THREE.PointsMaterial({
        size: 0.15,                     
        color: baseTrackColor,
        transparent: true,
        opacity: 0.80,                    
        blending: THREE.NormalBlending,  
        depthWrite: false
    });

    const ringGeometry = new THREE.BufferGeometry();
    const positions = [];
    const pointCount = 250;
    const radius = 4 + (index * 1.8); // Builds tiered concentric structural rings

    for (let i = 0; i < pointCount; i++) {
        const theta = (i / pointCount) * Math.PI * 2;
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        const y = (Math.random() - 0.5) * 3; // Horizontal particle dispersion spread
        
        positions.push(x, y, z);
    }

    ringGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const pointCloudTrack = new THREE.Points(ringGeometry, material);
    bioMatrixGroup.add(pointCloudTrack);
});

// 📍 Dynamic Geo-Bounding Alignment Engine
const remnantsGroup = new THREE.Group();
scene.add(remnantsGroup);

async function loadGeoJsonAnchors() {
    try {
        // 1. Fetch your 75,000-hectare boundary first to calculate scene dimensions
        const boundaryResponse = await fetch('./boundary.geojson');
        const boundaryData = await boundaryResponse.json();
        
        // Find the absolute geographic limits of the Big Scrub
        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;

        // Parse through the boundary polygon coordinates to calculate bounds
        boundaryData.features.forEach(f => {
            const coords = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
            coords.forEach(([lng, lat]) => {
                if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
                if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
            });
        });

        // Compute the mathematically perfect center origin of your landscape
        const geoCenterLng = (minLng + maxLng) / 2;
        const geoCenterLat = (minLat + maxLat) / 2;

        // Compute how much we need to stretch degrees to match your 70x70 PlaneGeometry dimensions
        const lngDelta = maxLng - minLng;
        const latDelta = maxLat - minLat;
        const autoScale = Math.min(70 / lngDelta, 70 / latDelta) * 0.95; // 95% boundary pad buffer

        console.log(`Auto-Calibration Matrix -> Center Lng: ${geoCenterLng.toFixed(4)}, Center Lat: ${geoCenterLat.toFixed(4)}, Scale: ${autoScale.toFixed(2)}`);

        // 📐 Fine-Tuning Calibration Overlay (Corrects for QGIS image export padding)
        const finalScale = autoScale * 0.92; // Shrinks the cluster slightly to snap onto the image features
        const finalOffsetX = -0.8;          // Slides all 79 markers slightly left to account for canvas shifts
        const finalOffsetZ = -1.2;          // Slides all 79 markers slightly forward


        // 2. Fetch your 79 remnants and project them natively inside the computed matrix bounds
        const remnantsResponse = await fetch('./remnants.geojson');
        const remnantsData = await remnantsResponse.json();
        
        remnantsData.features.forEach((feature, index) => {
            const name = feature.properties.name || `Remnant Part ${index + 1}`;
            let lng = null, lat = null;

            if (feature.geometry.type === "Point") {
                [lng, lat] = feature.geometry.coordinates;
            } else if (feature.geometry.type === "Polygon") {
                [lng, lat] = feature.geometry.coordinates[0][0];
            } else if (feature.geometry.type === "MultiPolygon") {
                [lng, lat] = feature.geometry.coordinates[0][0][0];
            }

            if (typeof lng === 'number' && typeof lat === 'number') {
                // Map coordinates using the automated bounding matrix math plus padding corrections
                const localX = ((lng - geoCenterLng) * finalScale) + finalOffsetX;
                const localZ = (-(lat - geoCenterLat) * finalScale) + finalOffsetZ;

                // Drop the high-contrast Gondwana Green pulsing rings natively onto their coordinates
                const markerGeo = new THREE.RingGeometry(0.25, 0.4, 16);
                const markerMat = new THREE.MeshBasicMaterial({
                    color: 0x3ae374, // Unified Gondwana Green 🟢
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.85
                });
                
                const markerMesh = new THREE.Mesh(markerGeo, markerMat);
                markerMesh.rotation.x = -Math.PI / 2;
                markerMesh.position.set(localX, 0.05, localZ);
                
                markerMesh.userData = { name: name };
                remnantsGroup.add(markerMesh);
            }
        });

        console.log(`Successfully mapped ${remnantsGroup.children.length} perfectly aligned anchors onto the landscape!`);
        
    } catch (error) {
        console.error("Geo-Bounding Matrix Alignment error:", error);
    }
}

// Fire the automated network initialization sequence
loadGeoJsonAnchors();

// 🌳 Dynamic "Ghost Tree" Canopy Generator Space
let activeGhostCanopy = null;
let activeHoveredName = null; // 🟢 Add this explicit variable declaration line here!

function spawnLocalGhostCanopy(targetPosition, reserveName) {
    // 1. Clear any previously loaded ghost canopy to protect memory performance
    if (activeGhostCanopy) {
        scene.remove(activeGhostCanopy);
        activeGhostCanopy.geometry.dispose();
        activeGhostCanopy.material.dispose();
        activeGhostCanopy = null;
    }

    const particleCount = 1500;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    // 2. Procedural structural canopy distribution math
    for (let i = 0; i < particleCount; i++) {
        // Generate a random radius circle spread around the anchor point
        const theta = Math.random() * Math.PI * 2;
        const radius = Math.random() * 2.5; // Width radius expansion footprint of the local plot
        
        const x = targetPosition.x + Math.cos(theta) * radius;
        const z = targetPosition.z + Math.sin(theta) * radius;
        
        // 📈 Vertical exponential height spread to form tree shapes
        const baseHeight = Math.pow(Math.random(), 1.5) * 6.5; 
        const y = 0.05 + baseHeight; // Start right on top of the map floor

        positions.push(x, y, z);

        // 🎨 Gondwana Green to Malesian Blue height gradient coloring path
        const color = new THREE.Color();
        if (y > 4.0) {
            color.setHSL(0.55, 0.95, 0.50); // Malesian Blue canopy tips 🔵
        } else {
            color.setHSL(0.35 + (y * 0.01), 0.90, 0.45); // Gondwana Green roots and trunk 🟢
        }
        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // 📐 High-Performance shimmering particle material configuration
    const material = new THREE.PointsMaterial({
        size: 0.12, // Slightly increased size for visibility
        vertexColors: true,
        transparent: true,
        opacity: 0.0, 
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        // 🪄 The Magic Fix: Uses an onBeforeCompile shader trick to round off the square corners!
        onBeforeCompile: (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
                `vec4 diffColor = vec4( diffuse, opacity );`,
                `
                // Calculate distance from the center of the point particle coordinate
                vec2 coord = gl_PointCoord - vec2(0.5);
                if(length(coord) > 0.5) discard; // Cut off the square corners completely!
                vec4 diffColor = vec4( diffuse, opacity );
                `
            );
        }
    });

    activeGhostCanopy = new THREE.Points(geometry, material);
    scene.add(activeGhostCanopy);
    console.log(`Procedural Ghost Forest spawned cleanly over ${reserveName}`);
}


// 🎯 Raycasting & Mouse Hover Tracking Engine
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tooltip = document.getElementById('tooltip');

window.addEventListener('mousemove', (event) => {
    // Convert regular screen mouse coordinates into normalized WebGL -1 to +1 space
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Position the HTML tooltip card right next to the user's cursor tip
    tooltip.style.left = (event.clientX + 15) + 'px';
    tooltip.style.top = (event.clientY + 15) + 'px';
    
    // Fire the raycaster from the camera through the mouse coordinates
    raycaster.setFromCamera(mouse, camera);
    
    // Check if the ray intersects any of our breathing remnant markers
    const intersects = raycaster.intersectObjects(remnantsGroup.children);
    
    if (intersects.length > 0) {
        // We hit a beacon! Extract its metadata name parameter
        const hitObject = intersects[0].object;
        tooltip.innerText = hitObject.userData.name;
        tooltip.style.display = 'block';
        tooltip.style.borderColor = '#' + hitObject.material.color.getHexString();
    } else {
        // No marker is being hovered, hide the card cleanly
        tooltip.style.display = 'none';
    }
});
// 📦 State configuration tracking for focused transitions
let targetCameraPosition = null;
let targetLookAtPosition = null;
let isTransitioning = false;

// 🔊 Eco-Acoustic Immersive Audio Management Space
const ecosystemAudio = new Audio('https://ilonka.io/rainforest_webstream.mp3'); // Replace with your true R2 audio track pointer
ecosystemAudio.loop = true;
ecosystemAudio.volume = 0.15; // Start very soft and non-intrusive at startup

// Audio state tracker to handle standard modern browser security click locks
let isAudioInitialized = false;

function triggerAudioVolumeSwell(targetVolume) {
    if (!isAudioInitialized) return;
    
    // Create a smooth volume fade over 1 second using a native interval loop
    const dynamicFade = setInterval(() => {
        if (ecosystemAudio.volume < targetVolume) {
            ecosystemAudio.volume = Math.min(ecosystemAudio.volume + 0.02, targetVolume);
        } else if (ecosystemAudio.volume > targetVolume) {
            ecosystemAudio.volume = Math.max(ecosystemAudio.volume - 0.02, targetVolume);
        }
        
        if (Math.abs(ecosystemAudio.volume - targetVolume) < 0.01) {
            clearInterval(dynamicFade);
        }
    }, 30);
}


// 🖱️ Click Navigation Router & Smooth View Glider
window.addEventListener('click', () => {
    // 🔊 Bypasses browser security blocks by starting the audio stream on the user's first intentional click
    if (!isAudioInitialized) {
        ecosystemAudio.play().catch(e => console.log("Audio play deferred until next interaction:", e));
        isAudioInitialized = true;
    }

    // Fire the raycaster through the current mouse spot
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(remnantsGroup.children);
    
    if (intersects.length > 0) {
    // 🛑 FIX: Added [0] to grab the absolute closest intersected ring marker object!
    const hitObject = intersects[0].object; 
    const reserveName = hitObject.userData.name;

        
        console.log("Navigating cleanly to: " + reserveName);
        
        // Compute focus coordinates directly over the clicked marker position
        const targetX = hitObject.position.x;
        const targetZ = hitObject.position.z;
        
        // Position camera dynamically slightly back and above the target plot location
        targetCameraPosition = new THREE.Vector3(targetX, 8, targetZ + 12);
        targetLookAtPosition = new THREE.Vector3(targetX, 0, targetZ);
        activeHoveredName = reserveName; // Add this line to pass the name parameters down cleanly!
        
        // Disable temporary user orbit adjustments during the swoop translation
        controls.enabled = false;
    }
});

animate();
    // 🚀 Smooth Real-Time Unified Render Loop
function animate() {
    requestAnimationFrame(animate);
    
    // 1. Rotate the central genomic particle rings smoothly
    if (typeof bioMatrixGroup !== 'undefined' && bioMatrixGroup) {
        bioMatrixGroup.rotation.y += 0.002;
    }
    
    // 2. 💓 Breathing Beacon Scale Animation for Remnant Anchors
    if (typeof remnantsGroup !== 'undefined' && remnantsGroup) {
        const pulseScale = 1.0 + Math.sin(Date.now() * 0.004) * 0.12;
        remnantsGroup.children.forEach((marker) => {
            marker.scale.set(pulseScale, pulseScale, 1.0);
        });
    }
    
            // 3. ✈️ Smooth Camera Glide Interpolation (Lerp Translation Path)
    if (targetCameraPosition && targetLookAtPosition) {
        camera.position.lerp(targetCameraPosition, 0.05);
        controls.target.lerp(targetLookAtPosition, 0.05);
        
        if (camera.position.distanceTo(targetCameraPosition) < 0.1) {
            targetCameraPosition = null;
            targetLookAtPosition = null;
            
            // 🪄 THE MAGIC FIX: Reset the state flags completely so the next click can execute!
            isTransitioning = false; 
            controls.enabled = true; 
            
            console.log("Arrived at target remnant plot view location.");

    if (typeof activeHoveredName !== 'undefined' && activeHoveredName) {
        spawnLocalGhostCanopy(controls.target, activeHoveredName);
    }

    // 🪄 SWELL: Boost the volume smoothly to 75% to surround the user as they stand inside the trees!
    triggerAudioVolumeSwell(0.75);
}

            // 🌊 4. Ghost Tree Shimmer & Opacity Influx Fade Loop
    if (activeGhostCanopy) {
        // Smoothly fade the trees into view over the first few frames
        if (activeGhostCanopy.material.opacity < 0.75) {
            activeGhostCanopy.material.opacity += 0.02;
        }

        // Animate individual particle positions slightly to create a subtle rustling breeze effect
        const positions = activeGhostCanopy.geometry.attributes.position.array;
        const time = Date.now() * 0.002;
        
        for (let i = 1; i < positions.length; i += 3) {
            // Apply a minor sine wave perturbation directly to the Y height positions array
            positions[i] += Math.sin(time + i) * 0.0015;
        }
        activeGhostCanopy.geometry.attributes.position.needsUpdate = true; // Force GPU to re-render points
    }

    }
    
    // 4. Keep camera controls updated and render frame
    if (typeof controls !== 'undefined' && controls) {
        controls.update(); 
    }
    renderer.render(scene, camera);
}

// Start the animation cycle safely
animate();
