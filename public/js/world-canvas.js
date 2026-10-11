/**
 * Prithvi (Planet Earth) 3D Rotating Sphere Globe & 2D Tactical World Simulation Visualizer
 *
 * Real Earth Photorealistic Visualizer:
 * 1. Authentic 3D Spherical Earth Globe (सच्ची 3D गोल पृथ्वी):
 *    - High-resolution photorealistic NASA satellite Earth map (2:1 equirectangular projection).
 *    - 3D Topographic normal relief map for realistic mountain ridges (Himalayas, Andes, Alps, Rockies).
 *    - Specular water reflection map so ocean water gleams in sunlight while continents remain matte.
 *    - Real semi-transparent floating atmospheric cloud layer that drifts over continents.
 *    - Atmospheric Rayleigh-scattering blue halo glow shell.
 *    - Optional real night-time city lights overlay.
 *    - 360° smooth mouse drag rotation and fluid zoom.
 *    - Mathematical analytical Euler alignment: ANY chosen city lands precisely in dead center on LAND, never in water!
 * 2. 3D Architectural Cityscapes & Buildings upon Zoom-In:
 *    - Realistic 3D cities emerge when zooming into any location on Earth:
 *      • 🏙️ Metropolises: Skylines (New Delhi, New York, Tokyo, London, Paris, Dubai, Sydney, Cairo, São Paulo)
 *      • 🚓 Police Station: Heavy security precinct with flashing red & blue emergency beacons
 *      • 🏠 Smart Homes & Residences: Terracotta pitched-roof residential neighborhoods
 *      • 🏥 Emergency Hospital: Pavilion with glowing Red Cross atop
 *      • 🏢 Workplace Tech Hub: Twin cybernetic towers with skybridge
 *      • 📚 Grand Library, 🕊️ Himalayan Sanctuary, 🌳 Amazonia Eco Park, 🛍️ Market & ☕ Cafe
 * 3. ALL Living Citizens Emergence upon Zoom ("zoom krne par all agent jitne hai aur jitne honge"):
 *    - Every single living citizen (all 500+ and all future newborns/arrivals) appears on the globe!
 *    - Stylized 3D character figures with pulsing ground beacon ring, colored character body, glowing orb head, and billboard name tag!
 *    - Dynamically scales up on zoom so citizens stand prominently above the terrain and buildings!
 *    - Floating name and activity billboard labels (e.g. "Marcus 💼", "Evelyn 💤") appear when zooming in!
 *    - Full 3D raycasting inspection on hover & click to open agent details.
 * 4. 2D Tactical Earth Map (2D फ्लैट मैप):
 *    - True 2048x1024 isotropic equirectangular real Earth map.
 *    - Tactical geographic graticule grid (Equator, Tropics of Cancer & Capricorn, Arctic/Antarctic circles, Prime Meridian).
 *    - Major continent labels (एशिया, यूरोप, अफ्रीका, उत्तरी अमेरिका, दक्षिणी अमेरिका, ऑस्ट्रेलिया, अंटार्कटिका).
 *    - Major ocean labels (प्रशांत, अटलांटिक, हिंद, आर्कटिक महासागर).
 */

const EARTH_LOCATIONS = {
  // Key Facilities (घर, पुलिस स्टेशन, अस्पताल, आदि)
  'Police Station & Security HQ': {
    name: 'Police Station & Security HQ',
    icon: '🚓',
    color: '#3b82f6',
    lat: 28.60,
    lng: 77.10,
    region: 'Central Security & Police Precinct (New Delhi, India)',
    type: 'security'
  },
  'Smart Homes & Residences': {
    name: 'Smart Homes & Residences',
    icon: '🏠',
    color: '#ec4899',
    lat: 28.50,
    lng: 77.30,
    region: 'Modern Residential Havens (Ghar / Homes)',
    type: 'residential'
  },
  'Emergency Hospital & Trauma Center': {
    name: 'Emergency Hospital & Trauma Center',
    icon: '🏥',
    color: '#ef4444',
    lat: 28.70,
    lng: 77.20,
    region: 'Advanced Medical Care & Hospital Ward',
    type: 'medical'
  },
  'Residential Complex': {
    name: 'Residential Complex',
    icon: '🏠',
    color: '#f472b6',
    lat: 34.05,
    lng: -118.24,
    region: 'Pacific Coast Residential District (Los Angeles, USA)',
    type: 'residential'
  },
  'Town Square': {
    name: 'Town Square',
    icon: '🏛️',
    color: '#38bdf8',
    lat: 20.59,
    lng: 78.96,
    region: 'Central Metropolis & Governance Forum (Nagpur, Bharat)',
    type: 'civic'
  },
  'Workplace (Tech Hub)': {
    name: 'Workplace (Tech Hub)',
    icon: '🏢',
    color: '#818cf8',
    lat: 31.23,
    lng: 121.47,
    region: 'Cybernetic Tech & Computation Park (Shanghai, Asia)',
    type: 'work'
  },
  'Grand Library': {
    name: 'Grand Library',
    icon: '📚',
    color: '#22d3ee',
    lat: 31.20,
    lng: 29.91,
    region: 'Global Heritage & Knowledge Archive (Alexandria, Egypt)',
    type: 'education'
  },
  'Sanctuary of Reflection': {
    name: 'Sanctuary of Reflection',
    icon: '🕊️',
    color: '#c084fc',
    lat: 30.08,
    lng: 78.26,
    region: 'Himalayan Spiritual Peace Ashram & Shrines (Rishikesh, Bharat)',
    type: 'spiritual'
  },
  'Central Park': {
    name: 'Central Park',
    icon: '🌳',
    color: '#4ade80',
    lat: -3.46,
    lng: -62.21,
    region: 'Amazonia Ecological Biosphere & Botanical Reserve (Brazil)',
    type: 'recreation'
  },
  'Sunny Cafe': {
    name: 'Sunny Cafe',
    icon: '☕',
    color: '#fbbf24',
    lat: 43.71,
    lng: 7.26,
    region: 'Mediterranean Riviera Community Bistro (Nice, France)',
    type: 'dining'
  },
  'Town Market & Bakery': {
    name: 'Town Market & Bakery',
    icon: '🛍️',
    color: '#f59e0b',
    lat: 39.90,
    lng: 116.40,
    region: 'Silk Route Spice & Artisan Bazaar (Beijing, Asia)',
    type: 'commercial'
  },
  'Wellness Clinic': {
    name: 'Wellness Clinic',
    icon: '🏥',
    color: '#2dd4bf',
    lat: 59.33,
    lng: 18.06,
    region: 'Nordic Holistic Health Sanctuary (Stockholm, Europe)',
    type: 'medical'
  },

  // Major World Metropolises (विश्व के प्रमुख शहर - All firmly situated on real land)
  'New Delhi & Mumbai Hub': {
    name: 'New Delhi & Mumbai Hub',
    icon: '🇮🇳',
    color: '#f97316',
    lat: 28.61,
    lng: 77.21,
    region: 'Bharat Capital Metropolis (India / भारत)',
    type: 'metropolis'
  },
  'New York City': {
    name: 'New York City',
    icon: '🇺🇸',
    color: '#38bdf8',
    lat: 40.71,
    lng: -74.01,
    region: 'Manhattan Financial & Atlantic Hub (USA)',
    type: 'metropolis'
  },
  'Tokyo Metropolis': {
    name: 'Tokyo Metropolis',
    icon: '🇯🇵',
    color: '#ec4899',
    lat: 35.68,
    lng: 139.77,
    region: 'Tokyo Robotics & Shinjuku District (Japan / जापान)',
    type: 'metropolis'
  },
  'London District': {
    name: 'London District',
    icon: '🇬🇧',
    color: '#a855f7',
    lat: 51.51,
    lng: -0.13,
    region: 'London Westminster & Thames Nexus (UK / यूनाइटेड किंगडम)',
    type: 'metropolis'
  },
  'Paris Hub': {
    name: 'Paris Hub',
    icon: '🇫🇷',
    color: '#6366f1',
    lat: 48.86,
    lng: 2.35,
    region: 'Paris Art & Culture Center (France / फ्रांस)',
    type: 'metropolis'
  },
  'Dubai Cyber Oasis': {
    name: 'Dubai Cyber Oasis',
    icon: '🇦🇪',
    color: '#fbbf24',
    lat: 25.20,
    lng: 55.27,
    region: 'Dubai Futuristic Gulf Oasis (UAE / संयुक्त अरब अमीरात)',
    type: 'metropolis'
  },
  'Sydney Harbor': {
    name: 'Sydney Harbor',
    icon: '🇦🇺',
    color: '#06b6d4',
    lat: -33.87,
    lng: 151.21,
    region: 'Sydney Pacific Harbor & Opera Bay (Australia / ऑस्ट्रेलिया)',
    type: 'metropolis'
  },
  'Cairo Nile Citadel': {
    name: 'Cairo Nile Citadel',
    icon: '🇪🇬',
    color: '#eab308',
    lat: 30.04,
    lng: 31.24,
    region: 'Cairo Nile Historic Citadel (Egypt / मिस्र)',
    type: 'metropolis'
  },
  'São Paulo Hub': {
    name: 'São Paulo Hub',
    icon: '🇧🇷',
    color: '#10b981',
    lat: -23.55,
    lng: -46.63,
    region: 'São Paulo Metropolis (Brazil / ब्राजील)',
    type: 'metropolis'
  },

  // Continents of Earth (पृथ्वी के महाद्वीप)
  'Asia': {
    name: 'Asia',
    icon: '🌏',
    color: '#f59e0b',
    lat: 34.0,
    lng: 100.0,
    region: 'Asia Continent / एशिया महाद्वीप',
    type: 'continent'
  },
  'Europe': {
    name: 'Europe',
    icon: '🌍',
    color: '#3b82f6',
    lat: 50.0,
    lng: 15.0,
    region: 'Europe Continent / यूरोप महाद्वीप',
    type: 'continent'
  },
  'Africa': {
    name: 'Africa',
    icon: '🌍',
    color: '#10b981',
    lat: 5.0,
    lng: 20.0,
    region: 'Africa Continent / अफ्रीका महाद्वीप',
    type: 'continent'
  },
  'North America': {
    name: 'North America',
    icon: '🌎',
    color: '#ec4899',
    lat: 42.0,
    lng: -100.0,
    region: 'North America Continent / उत्तरी अमेरिका',
    type: 'continent'
  },
  'South America': {
    name: 'South America',
    icon: '🌎',
    color: '#06b6d4',
    lat: -15.0,
    lng: -60.0,
    region: 'South America Continent / दक्षिणी अमेरिका',
    type: 'continent'
  },
  'Australia': {
    name: 'Australia',
    icon: '🌏',
    color: '#8b5cf6',
    lat: -25.0,
    lng: 135.0,
    region: 'Australia Continent / ऑस्ट्रेलिया महाद्वीप',
    type: 'continent'
  },
  'Antarctica': {
    name: 'Antarctica',
    icon: '🧊',
    color: '#e2e8f0',
    lat: -80.0,
    lng: 0.0,
    region: 'Antarctica Continent / अंटार्कटिका महाद्वीप',
    type: 'continent'
  }
};

// Standard 2:1 Equirectangular Dimensions (Plate Carrée Projection)
const EARTH_2D_WIDTH = 2048;
const EARTH_2D_HEIGHT = 1024;

function latLngTo2D(lat, lng) {
  const x = ((lng + 180) / 360) * EARTH_2D_WIDTH;
  const y = ((90 - lat) / 180) * EARTH_2D_HEIGHT;
  return { x, y };
}

function latLngTo3D(lat, lng, radius = 100) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return { x, y, z };
}

/**
 * Exact analytical Euler angles to rotate any (lat, lng) directly to the dead-center facing camera (x=0, y=0, z=+100)
 */
function getFocusEuler(lat, lng) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const r = 100;
  const x = -r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);

  // Exact rotation: Ry rotates x to 0 and z to +z_prime; Rx rotates y to 0 and z_prime to +r
  const ry = Math.atan2(-x, z);
  const z_prime = -x * Math.sin(ry) + z * Math.cos(ry);
  const rx = Math.atan2(y, z_prime);

  return { rx, ry };
}

class SimulationWorldCanvas {
  constructor(canvasElement, onAgentClick) {
    this.canvas = canvasElement;
    this.container = document.getElementById('sim-viewport-container') || canvasElement.parentElement;
    this.onAgentClick = onAgentClick;

    this.agents = [];
    this.locations = EARTH_LOCATIONS;

    this.isGlobeMode = typeof window.THREE !== 'undefined';
    this.autoRotate = true;
    this.isFullscreen = false;
    this.cloudsVisible = true;
    this.nightLightsVisible = false;

    // Precalculate location geometries
    for (const key of Object.keys(this.locations)) {
      const loc = this.locations[key];
      const pt2d = latLngTo2D(loc.lat, loc.lng);
      loc.x = pt2d.x;
      loc.y = pt2d.y;
      loc.pt3d = latLngTo3D(loc.lat, loc.lng, 100.8);
    }

    this.agentPositions = new Map();
    this.hoveredAgent = null;
    this.hoveredLocation = null;
    this.timeTicker = 0;

    // Rotation & Pan Drag state
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.hasMovedDrag = false;

    // Initial globe camera rotation: centered over India (lat 28.6, lng 77.2)
    const initialEuler = getFocusEuler(28.61, 77.21);
    this.targetRotationX = initialEuler.rx;
    this.targetRotationY = initialEuler.ry;
    this.currentRotationX = initialEuler.rx;
    this.currentRotationY = initialEuler.ry;
    this.cameraDistance = 240;
    this.targetCameraDistance = 240;
    this.minCameraDistance = 115;
    this.maxCameraDistance = 420;

    // Solar System Viewing State (Heliocentric Real-World Diagram matching user reference image)
    this.viewMode = 'solar'; // 'solar' | 'earth'
    this.cameraLookAt = new THREE.Vector3(0, 0, 0);
    this.targetLookAt = new THREE.Vector3(0, 0, 0);
    this.solarCameraDist = 1080;
    this.targetSolarCameraDist = 1080;
    this.solarPitch = 0.65;
    this.targetSolarPitch = 0.65;
    this.solarYaw = 0.0;
    this.targetSolarYaw = 0.0;
    this.planets = [];
    this.solarAutoRotate = true; // Auto-rotate Solar System view & planetary orbits
    this.solarSpeedMultiplier = 1.0; // Multiplier for rotation and orbital speed (0.2x - 10.0x)

    // List of 3D city building groups and agent objects for zoom animation
    this.cityBuildingGroups = [];
    this.agent3DObjects = [];
    this.policeBeacons = [];

    // 2D Camera Fallback State
    this.zoom2D = 1.0;
    this.targetZoom2D = 1.0;
    this.pan2D_X = 0;
    this.pan2D_Y = 0;
    this.targetPan2D_X = 0;
    this.targetPan2D_Y = 0;

    // Authentic Real Earth Satellite Texture (NASA Blue Marble)
    this.earthImg = new Image();
    this.earthImg.src = '/assets/earth_real_satellite.jpg';
    this.earthLoaded = false;
    this.earthImg.onload = () => { this.earthLoaded = true; };

    this.stars2D = this.generateStars(180);

    if (this.isGlobeMode) {
      this.initThreeGlobe();
    } else {
      this.init2DCanvas();
    }

    this.initEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.loop();
  }

  generateStars(count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: Math.random(),
        y: Math.random(),
        radius: Math.random() * 1.5 + 0.4,
        alpha: Math.random() * 0.7 + 0.3
      });
    }
    return arr;
  }

  // =========================================================================
  // 1. THREE.JS 3D ROUND EARTH GLOBE INITIALIZATION
  // =========================================================================
  initThreeGlobe() {
    try {
      const THREE = window.THREE;
      const width = this.canvas.clientWidth || 1200;
      const height = this.canvas.clientHeight || 600;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 25000);
      const initCamPitch = 0.65;
      const initCamDist = 1080;
      this.camera.position.set(0, initCamDist * Math.sin(initCamPitch), initCamDist * Math.cos(initCamPitch));
      this.cameraLookAt = new THREE.Vector3(0, 0, 0);
      this.camera.lookAt(this.cameraLookAt);
      this.targetLookAt = new THREE.Vector3(0, 0, 0);

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(width, height, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      // Atmospheric Lighting (Sunlight + Soft Ambient)
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.82);
      this.scene.add(ambientLight);

      const sunLight = new THREE.DirectionalLight(0xfff9ee, 1.25);
      sunLight.position.set(280, 160, 240);
      this.scene.add(sunLight);
      this.sunLight = sunLight;

      // Root 360° Globe Group with default Euler order 'XYZ'
      this.globeGroup = new THREE.Group();
      this.globeGroup.rotation.order = 'XYZ';
      this.scene.add(this.globeGroup);

      // Texture loader
      const textureLoader = new THREE.TextureLoader();

      // 1. Real Earth Photorealistic Satellite Mesh (NASA Blue Marble)
      const earthGeo = new THREE.SphereGeometry(100, 64, 64);
      const earthTex = textureLoader.load('/assets/earth_real_satellite.jpg');
      earthTex.generateMipmaps = true;

      const normalTex = textureLoader.load('/assets/earth_normal.jpg');
      const specularTex = textureLoader.load('/assets/earth_specular.jpg');

      const earthMat = new THREE.MeshPhongMaterial({
        map: earthTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(0.85, 0.85),
        specularMap: specularTex,
        specular: new THREE.Color(0x283848),
        shininess: 22
      });
      this.earthMesh = new THREE.Mesh(earthGeo, earthMat);
      this.globeGroup.add(this.earthMesh);

      // 2. Real Floating Atmospheric Cloud Layer
      const cloudsGeo = new THREE.SphereGeometry(100.8, 64, 64);
      const cloudsTex = textureLoader.load('/assets/earth_clouds.png');
      const cloudsMat = new THREE.MeshLambertMaterial({
        map: cloudsTex,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending
      });
      this.cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
      this.globeGroup.add(this.cloudsMesh);

      // 3. Real Night City Lights Overlay
      const lightsGeo = new THREE.SphereGeometry(100.15, 64, 64);
      const lightsTex = textureLoader.load('/assets/earth_lights.png');
      const lightsMat = new THREE.MeshBasicMaterial({
        map: lightsTex,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        visible: false
      });
      this.lightsMesh = new THREE.Mesh(lightsGeo, lightsMat);
      this.globeGroup.add(this.lightsMesh);

      // 4. Atmospheric Blue Limb Glow Shell
      const atmGeo = new THREE.SphereGeometry(103.5, 64, 64);
      const atmMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending
      });
      this.atmMatureMesh = new THREE.Mesh(atmGeo, atmMat);
      this.globeGroup.add(this.atmMatureMesh);

      // Starfield background for deep space
      this.createThreeStars();

      // Complete 3D Solar System (1 Central Sun + 7 Major Orbiting Planets + Trajectory Paths)
      this.initSolarSystem();

      // Groups for 3D Architecture & Agents
      this.landmarkGroup = new THREE.Group();
      this.globeGroup.add(this.landmarkGroup);

      this.agentGroup = new THREE.Group();
      this.globeGroup.add(this.agentGroup);

      this.raycaster = new THREE.Raycaster();
      this.mouseRay = new THREE.Vector2();

      this.rebuild3DLandmarks();
      this.rebuild3DAgents();
    } catch (err) {
      console.warn('Three.js Globe Init fallback to 2D:', err);
      this.isGlobeMode = false;
      this.init2DCanvas();
    }
  }

  // =========================================================================
  // 1.1 COMPLETE 3D SOLAR SYSTEM DIAGRAM (REAL-WORLD HELIOCENTRIC MODEL)
  // (Central Sun + Glowing Orange Concentric Orbits + 8 Planets revolving by Keplerian physics)
  // =========================================================================
  initSolarSystem() {
    const THREE = window.THREE;
    this.solarSystemGroup = new THREE.Group();
    this.scene.add(this.solarSystemGroup);

    // Heliocentric Center: Radiant Sun at (0, 0, 0)
    this.sunCenter = new THREE.Vector3(0, 0, 0);

    // 1. Central Radiant Sun (with surface flares & corona halo)
    const sunData = this.createSunGroup();
    this.sunGroup = sunData.group;
    this.sunCoronaMesh = sunData.coronaMesh;
    this.sunFlareMesh = sunData.flareMesh;
    this.solarSystemGroup.add(this.sunGroup);

    // 2. Solar light shining from the Sun across all concentric orbits
    const solarLight = new THREE.PointLight(0xfff5dd, 3.2, 16000, 0.45);
    solarLight.position.copy(this.sunCenter);
    this.solarSystemGroup.add(solarLight);

    // 3. The 8 Major Planets arranged by real-world orbital distance & matching reference diagram
    this.planets = [];
    const planetDefs = [
      {
        name: 'Mercury',
        label: 'Mercury',
        hindiName: '☿️ बुध (Mercury)',
        radius: 7.5,
        orbitRadius: 95,
        speed: 0.015,
        angle: 2.45, // front-left quadrant
        color: 0xc2b69d
      },
      {
        name: 'Venus',
        label: 'Venus',
        hindiName: '♀️ शुक्र (Venus)',
        radius: 13,
        orbitRadius: 145,
        speed: 0.010,
        angle: -0.65, // upper-right quadrant
        color: 0xdeb887
      },
      {
        name: 'Earth',
        label: 'Earth',
        hindiName: '🌍 पृथ्वी (Earth - मानव सिमुलेशन)',
        isEarth: true,
        radius: 15,
        orbitRadius: 205,
        speed: 0.0075,
        angle: 0.38 // front-right quadrant
      },
      {
        name: 'Mars',
        label: 'Mars',
        hindiName: '♂️ मंगल (Mars)',
        radius: 10,
        orbitRadius: 275,
        speed: 0.0055,
        angle: 2.65, // lower-left quadrant
        color: 0xc85a3a
      },
      {
        name: 'Jupiter',
        label: 'Jupiter',
        hindiName: '♃ बृहस्पति (Jupiter)',
        isJupiter: true,
        radius: 32,
        orbitRadius: 375,
        speed: 0.0032,
        angle: 0.06, // far right
        color: 0xd8aa68
      },
      {
        name: 'Saturn',
        label: 'Saturn',
        hindiName: '♄ शनि (Saturn - वलय)',
        hasRings: true,
        radius: 26,
        ringInner: 31,
        ringOuter: 58,
        orbitRadius: 490,
        speed: 0.0022,
        angle: 1.08, // lower-right quadrant
        color: 0xedd6ad
      },
      {
        name: 'Uranus',
        label: 'Uranus',
        hindiName: '⛢ अरुण (Uranus)',
        radius: 19,
        orbitRadius: 610,
        speed: 0.0014,
        angle: 3.08, // far left
        color: 0x7be4f0
      },
      {
        name: 'Neptune',
        label: 'Neptune',
        hindiName: '♆ वरुण (Neptune)',
        radius: 18,
        orbitRadius: 735,
        speed: 0.0010,
        angle: 2.05, // bottom-left quadrant
        color: 0x3b66f5
      }
    ];

    for (const def of planetDefs) {
      // 1. Concentric Glowing Orange Orbit Line (encircles central Sun)
      const orbitLine = this.createConcentricOrbit(def.orbitRadius);
      this.solarSystemGroup.add(orbitLine);

      const initX = def.orbitRadius * Math.cos(def.angle);
      const initZ = def.orbitRadius * Math.sin(def.angle);

      if (def.isEarth) {
        // Earth: incorporates our living globeGroup (with satellite map + 3D cities + living agents)
        this.globeGroup.position.set(initX, 0, initZ);
        this.globeGroup.scale.set(0.15, 0.15, 0.15);

        // Diagram Label "Earth" placed below
        const label = this.createDiagramLabel('Earth', 24);
        label.position.set(initX, -16, initZ + 14);
        this.solarSystemGroup.add(label);

        this.planets.push({
          ...def,
          mesh: this.globeGroup,
          label
        });
        continue;
      }

      // Planet Container Pivot
      const planetPivot = new THREE.Group();
      planetPivot.position.set(initX, 0, initZ);
      this.solarSystemGroup.add(planetPivot);

      // Planet Sphere Mesh
      const pGeo = new THREE.SphereGeometry(def.radius, 32, 32);
      let pMat;

      if (def.isJupiter) {
        // Procedural horizontal striped gas giant texture matching image
        const jupTex = this.createJupiterTexture();
        pMat = new THREE.MeshPhongMaterial({
          map: jupTex,
          shininess: 16,
          specular: 0x332211
        });
      } else {
        pMat = new THREE.MeshPhongMaterial({
          color: def.color,
          shininess: 22,
          specular: 0x444444
        });
      }

      const pMesh = new THREE.Mesh(pGeo, pMat);
      planetPivot.add(pMesh);

      // Saturn's Iconic Rings
      if (def.hasRings) {
        const ringMesh = this.createSaturnRingMesh(def.ringInner, def.ringOuter);
        planetPivot.add(ringMesh);
      }

      // Diagram Label matching reference diagram placed beneath the planet
      const label = this.createDiagramLabel(def.label, 24);
      label.position.set(initX, -def.radius - 12, initZ + 12);
      this.solarSystemGroup.add(label);

      this.planets.push({
        ...def,
        group: planetPivot,
        mesh: pMesh,
        label
      });
    }
  }

  createSunGroup() {
    const THREE = window.THREE;
    const group = new THREE.Group();
    group.position.copy(this.sunCenter);

    // Procedural Sun Surface Texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 256, 5 + Math.random() * 18, 0, Math.PI * 2);
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(234, 88, 12, 0.55)' : 'rgba(254, 240, 138, 0.6)';
      ctx.fill();
    }
    const sunTex = new THREE.CanvasTexture(canvas);

    // Core Sphere
    const sunGeo = new THREE.SphereGeometry(44, 40, 40);
    const sunMat = new THREE.MeshBasicMaterial({ map: sunTex });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    group.add(sunMesh);

    // Inner Glowing Corona
    const coronaGeo = new THREE.SphereGeometry(52, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    group.add(coronaMesh);

    // Outer Flare Halo
    const flareGeo = new THREE.SphereGeometry(68, 32, 32);
    const flareMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending
    });
    const flareMesh = new THREE.Mesh(flareGeo, flareMat);
    group.add(flareMesh);

    return { group, sunMesh, coronaMesh, flareMesh };
  }

  createConcentricOrbit(radius) {
    const THREE = window.THREE;
    const points = [];
    const segments = 180;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        radius * Math.cos(theta),
        0,
        radius * Math.sin(theta)
      ));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0xff6a22, // Glowing orange/copper matching user reference diagram
      transparent: true,
      opacity: 0.85
    });
    return new THREE.Line(geometry, material);
  }

  createJupiterTexture() {
    const THREE = window.THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.00, '#d8aa68');
    grad.addColorStop(0.12, '#eeddbb');
    grad.addColorStop(0.25, '#c88d52');
    grad.addColorStop(0.38, '#eed8b0');
    grad.addColorStop(0.50, '#b8753a');
    grad.addColorStop(0.62, '#e8cf9c');
    grad.addColorStop(0.75, '#c58a50');
    grad.addColorStop(0.88, '#e6d0a2');
    grad.addColorStop(1.00, '#c89658');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let y = 15; y < 240; y += 22) {
      ctx.fillRect(0, y, 512, 6);
    }

    ctx.beginPath();
    ctx.ellipse(330, 165, 26, 15, -0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#b94d28';
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  createSaturnRingMesh(innerR, outerR) {
    const THREE = window.THREE;
    const ringGeo = new THREE.RingGeometry(innerR, outerR, 64);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0.0, 'rgba(180, 140, 90, 0.2)');
    grad.addColorStop(0.2, 'rgba(225, 195, 145, 0.95)');
    grad.addColorStop(0.5, 'rgba(170, 130, 85, 0.9)');
    grad.addColorStop(0.68, 'rgba(80, 60, 40, 0.2)');
    grad.addColorStop(0.78, 'rgba(210, 180, 135, 0.85)');
    grad.addColorStop(1.0, 'rgba(160, 130, 90, 0.1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 1);

    const ringTex = new THREE.CanvasTexture(canvas);
    const ringMat = new THREE.MeshBasicMaterial({
      map: ringTex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92
    });

    const mesh = new THREE.Mesh(ringGeo, ringMat);
    mesh.rotation.x = Math.PI / 2.3;
    mesh.rotation.y = 0.25;
    return mesh;
  }

  createDiagramLabel(text, fontSize = 28) {
    const THREE = window.THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.font = `bold ${fontSize}px "Trebuchet MS", "Inter", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(65, 16.25, 1);
    return sprite;
  }

  toggleSolarView() {
    if (this.viewMode === 'solar') {
      this.focusEarth();
    } else {
      this.viewMode = 'solar';
      const btn = document.getElementById('btn-toggle-solar-mode');
      if (btn) {
        btn.innerHTML = '🌍 पृथ्वी फोकस';
        btn.className = 'btn btn-xs btn-primary';
      }
      this.updateZoomHud();
    }
  }

  focusEarth() {
    this.viewMode = 'earth';
    this.targetRotationX = 0.2;
    this.targetRotationY = 0;
    this.targetCameraDistance = 240;
    const btn = document.getElementById('btn-toggle-solar-mode');
    if (btn) {
      btn.innerHTML = '🌌 सौरमंडल दृश्य';
      btn.className = 'btn btn-xs btn-secondary';
    }
    this.updateZoomHud();
  }

  createThreeStars() {
    const THREE = window.THREE;
    const starCount = 3500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const dist = 3200 + Math.random() * 6800;

      positions[i * 3] = dist * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = dist * Math.cos(phi);
      positions[i * 3 + 2] = dist * Math.sin(phi) * Math.sin(theta);

      const brightness = Math.random() * 0.6 + 0.4;
      colors[i * 3] = brightness * 0.95;
      colors[i * 3 + 1] = brightness * 0.90;
      colors[i * 3 + 2] = brightness;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.88
    });

    this.starPoints = new THREE.Points(geometry, material);
    this.scene.add(this.starPoints);

    // Cosmic Nebula Galaxy Dust (purple, magenta, and amber star clouds)
    const nebulaCount = 600;
    const nebGeo = new THREE.BufferGeometry();
    const nebPos = new Float32Array(nebulaCount * 3);
    const nebCol = new Float32Array(nebulaCount * 3);
    const palette = [
      new THREE.Color(0xa855f7),
      new THREE.Color(0xc026d3),
      new THREE.Color(0xf43f5e),
      new THREE.Color(0xf97316),
      new THREE.Color(0x6366f1)
    ];

    for (let i = 0; i < nebulaCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const dist = 2800 + Math.random() * 3400;

      nebPos[i * 3] = dist * Math.sin(phi) * Math.cos(theta);
      nebPos[i * 3 + 1] = (dist * Math.cos(phi)) * 0.65;
      nebPos[i * 3 + 2] = dist * Math.sin(phi) * Math.sin(theta);

      const col = palette[Math.floor(Math.random() * palette.length)];
      nebCol[i * 3] = col.r;
      nebCol[i * 3 + 1] = col.g;
      nebCol[i * 3 + 2] = col.b;
    }

    nebGeo.setAttribute('position', new THREE.BufferAttribute(nebPos, 3));
    nebGeo.setAttribute('color', new THREE.BufferAttribute(nebCol, 3));

    const nebMat = new THREE.PointsMaterial({
      size: 42.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });

    this.nebulaPoints = new THREE.Points(nebGeo, nebMat);
    this.scene.add(this.nebulaPoints);
  }

  init2DCanvas() {
    this.ctx = this.canvas.getContext('2d');
  }

  // =========================================================================
  // 2. RESIZING & FULLSCREEN
  // =========================================================================
  resize() {
    if (!this.canvas) return;
    const container = this.container || this.canvas.parentElement;
    const rect = container ? container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };

    const w = Math.max(640, rect.width || window.innerWidth);
    const h = Math.max(480, rect.height || (window.innerHeight - 150));

    this.canvas.width = w;
    this.canvas.height = h;

    if (this.isGlobeMode && this.renderer && this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    }
  }

  toggleFullscreen() {
    const container = this.container;
    if (!container) return;

    this.isFullscreen = !this.isFullscreen;
    container.classList.toggle('fullscreen', this.isFullscreen);

    const btn = document.getElementById('btn-toggle-fullscreen');
    if (btn) {
      btn.innerHTML = this.isFullscreen ? '✕ बाहर निकलें' : '⛶ फुलस्क्रीन';
      btn.className = this.isFullscreen ? 'btn btn-xs btn-danger' : 'btn btn-xs btn-primary';
    }

    setTimeout(() => this.resize(), 50);
  }

  toggleGlobeMode() {
    if (typeof window.THREE === 'undefined') {
      alert('3D Three.js library not loaded yet.');
      return;
    }

    this.isGlobeMode = !this.isGlobeMode;
    const modeBtn = document.getElementById('btn-toggle-globe-mode');
    if (modeBtn) {
      modeBtn.innerHTML = this.isGlobeMode ? '🌐 3D गोल पृथ्वी' : '🗺️ 2D फ्लैट मैप';
    }

    if (this.isGlobeMode && !this.renderer) {
      this.initThreeGlobe();
    } else if (!this.isGlobeMode && !this.ctx) {
      this.init2DCanvas();
    }

    this.resize();
    this.updateZoomHud();
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    this.solarAutoRotate = this.autoRotate;
    const btn = document.getElementById('btn-toggle-autorotate');
    if (btn) {
      btn.innerHTML = this.autoRotate ? '🔄 रोटेशन ऑन' : '⏸️ रोटेशन रुका';
      btn.className = this.autoRotate ? 'btn btn-xs btn-secondary' : 'btn btn-xs btn-outline';
    }
    this.updateSolarControlsUI();
  }

  toggleSolarRotate() {
    this.solarAutoRotate = !this.solarAutoRotate;
    this.updateSolarControlsUI();
    return this.solarAutoRotate;
  }

  rotateSolarStep(dir = 1) {
    if (this.viewMode !== 'solar') {
      this.toggleSolarView();
    }
    this.targetSolarYaw += (Math.PI / 8) * dir;
  }

  setSolarSpeed(multiplier) {
    const val = Math.max(0.1, Math.min(10.0, parseFloat(multiplier) || 1.0));
    this.solarSpeedMultiplier = val;
    this.updateSolarControlsUI();
  }

  changeSolarSpeed(delta) {
    const curr = this.solarSpeedMultiplier || 1.0;
    const next = Math.round((curr + delta) * 10) / 10;
    const clamped = Math.max(0.2, Math.min(10.0, next));
    this.setSolarSpeed(clamped);
    if (window.app && window.app.setTimeSpeed) {
      window.app.setTimeSpeed(clamped);
    }
  }

  updateSolarControlsUI() {
    const rotBtn = document.getElementById('btn-solar-rotate');
    if (rotBtn) {
      rotBtn.innerHTML = this.solarAutoRotate ? '🔄 सौरमंडल घूम रहा है' : '⏸️ सौरमंडल रुका हुआ';
      rotBtn.className = this.solarAutoRotate ? 'btn btn-xs btn-primary' : 'btn btn-xs btn-secondary';
    }
    const badges = document.querySelectorAll('.solar-speed-display');
    badges.forEach(b => {
      b.textContent = `${(this.solarSpeedMultiplier || 1.0).toFixed(1)}x`;
    });
    const slider = document.getElementById('solar-speed-slider');
    if (slider) {
      slider.value = this.solarSpeedMultiplier || 1.0;
    }
  }

  toggleClouds() {
    this.cloudsVisible = !this.cloudsVisible;
    if (this.cloudsMesh) {
      this.cloudsMesh.visible = this.cloudsVisible;
    }
    const btn = document.getElementById('btn-toggle-clouds');
    if (btn) {
      btn.innerHTML = this.cloudsVisible ? '☁️ बादल ऑन' : '☁️ बादल बंद';
      btn.className = this.cloudsVisible ? 'btn btn-xs btn-secondary' : 'btn btn-xs btn-outline';
    }
  }

  toggleNightLights() {
    this.nightLightsVisible = !this.nightLightsVisible;
    if (this.lightsMesh) {
      this.lightsMesh.visible = this.nightLightsVisible;
    }
    const btn = document.getElementById('btn-toggle-night-lights');
    if (btn) {
      btn.innerHTML = this.nightLightsVisible ? '💡 नाइट लाइट्स ऑन' : '💡 नाइट लाइट्स';
      btn.className = this.nightLightsVisible ? 'btn btn-xs btn-primary' : 'btn btn-xs btn-secondary';
    }
  }

  // =========================================================================
  // 3. EVENTS (360° DRAG, ZOOM, CLICKS)
  // =========================================================================
  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.isDragging = true;
      this.hasMovedDrag = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        if (Math.hypot(dx, dy) > 4) {
          this.hasMovedDrag = true;
        }

        if (this.isGlobeMode) {
          if (this.viewMode === 'solar') {
            this.targetSolarYaw -= dx * 0.0035;
            this.targetSolarPitch = Math.max(0.12, Math.min(Math.PI / 2.05, this.targetSolarPitch + dy * 0.0035));
          } else {
            const rotateSpeed = 0.0055;
            this.targetRotationY += dx * rotateSpeed;
            this.targetRotationX += dy * rotateSpeed;
            this.targetRotationX = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.targetRotationX));
          }
        } else {
          this.targetPan2D_X += dx;
          this.targetPan2D_Y += dy;
        }

        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
      } else {
        this.checkHover(mouseX, mouseY);
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.style.cursor = (this.hoveredAgent || this.hoveredLocation) ? 'pointer' : 'grab';
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.isGlobeMode) {
        if (this.viewMode === 'solar') {
          const solarDelta = e.deltaY * 0.95;
          this.targetSolarCameraDist = Math.max(450, Math.min(4500, this.targetSolarCameraDist + solarDelta));
        } else {
          const zoomDelta = e.deltaY * 0.18;
          this.targetCameraDistance = Math.max(
            this.minCameraDistance,
            Math.min(this.maxCameraDistance, this.targetCameraDistance + zoomDelta)
          );
        }
      } else {
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.86;
        this.targetZoom2D = Math.max(0.4, Math.min(6.0, this.targetZoom2D * zoomFactor));
      }
      this.updateZoomHud();
    }, { passive: false });

    this.canvas.addEventListener('click', (e) => {
      if (this.hasMovedDrag) return;
      if (this.hoveredAgent && this.onAgentClick) {
        this.onAgentClick(this.hoveredAgent);
      } else if (this.hoveredLocation) {
        this.focusLocation(this.hoveredLocation.name);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isFullscreen) {
        this.toggleFullscreen();
      }
    });
  }

  // =========================================================================
  // 4. ZOOM & CAMERA NAVIGATION
  // =========================================================================
  zoomIn() {
    if (this.isGlobeMode) {
      if (this.viewMode === 'solar') {
        this.targetSolarCameraDist = Math.max(450, this.targetSolarCameraDist - 120);
      } else {
        this.targetCameraDistance = Math.max(this.minCameraDistance, this.targetCameraDistance - 35);
      }
    } else {
      this.targetZoom2D = Math.min(6.0, this.targetZoom2D * 1.3);
    }
    this.updateZoomHud();
  }

  zoomOut() {
    if (this.isGlobeMode) {
      if (this.viewMode === 'solar') {
        this.targetSolarCameraDist = Math.min(4500, this.targetSolarCameraDist + 120);
      } else {
        this.targetCameraDistance = Math.min(this.maxCameraDistance, this.targetCameraDistance + 35);
      }
    } else {
      this.targetZoom2D = Math.max(0.4, this.targetZoom2D * 0.77);
    }
    this.updateZoomHud();
  }

  resetView() {
    if (this.isGlobeMode) {
      if (this.viewMode === 'solar') {
        this.targetSolarCameraDist = 1080;
        this.targetSolarPitch = 0.65;
        this.targetSolarYaw = 0.0;
      } else {
        const initialEuler = getFocusEuler(28.61, 77.21);
        this.targetRotationX = initialEuler.rx;
        this.targetRotationY = initialEuler.ry;
        this.targetCameraDistance = 240;
      }
    } else {
      this.targetZoom2D = 1.0;
      this.targetPan2D_X = 0;
      this.targetPan2D_Y = 0;
    }
    this.updateZoomHud();
  }

  /**
   * Focuses on any city, continent, or celestial planet in the Solar System
   */
  focusLocation(locName) {
    if (locName && locName.startsWith('SolarSystem_')) {
      if (locName === 'SolarSystem_Sun') {
        this.toggleSolarView();
        return;
      }
      if (locName === 'SolarSystem_Earth') {
        this.focusEarth();
        return;
      }
      const pName = locName.replace('SolarSystem_', '');
      const foundPlanet = (this.planets || []).find(p => p.name === pName);
      if (foundPlanet) {
        this.viewMode = 'solar';
        this.updateZoomHud();
        return;
      }
    }

    const loc = this.locations[locName];
    if (!loc) return;

    if (this.isGlobeMode) {
      this.viewMode = 'earth';
      // Mathematically rotates the globe so the chosen lat/lng directly centers in the viewport on land
      const { rx, ry } = getFocusEuler(loc.lat, loc.lng);
      this.targetRotationX = rx;
      this.targetRotationY = ry;
      this.autoRotate = false; // Stop auto-rotate so user can clearly see the city and citizens on land

      const rotBtn = document.getElementById('btn-toggle-autorotate');
      if (rotBtn) {
        rotBtn.innerHTML = '⏸️ रोटेशन रुका';
        rotBtn.className = 'btn btn-xs btn-outline';
      }

      if (loc.type === 'continent') {
        this.targetCameraDistance = 205;
      } else {
        this.targetCameraDistance = 138; // Close-up zoom revealing 3D buildings & citizens
      }
    } else {
      const canvasW = this.canvas.width;
      const canvasH = this.canvas.height;
      const targetZoom = loc.type === 'continent' ? 1.4 : 2.6;
      this.targetZoom2D = targetZoom;
      this.targetPan2D_X = canvasW / 2 - loc.x * targetZoom;
      this.targetPan2D_Y = canvasH / 2 - loc.y * targetZoom;
    }

    this.updateZoomHud();
  }

  focusAgent(agentId) {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return;
    const locName = agent.preferred_city || agent.location || 'Town Square';
    this.focusLocation(locName);
  }

  // =========================================================================
  // 5. UPDATE SIMULATION DATA (ALL CITIZENS RESIDING BY CHOICE)
  // =========================================================================
  updateState(agents, locations) {
    this.agents = agents || [];

    for (const a of this.agents) {
      if (a.runtime_status === 'deceased') continue;

      // Agent lives in their chosen city (preferred_city) or assigned location
      const locName = a.preferred_city || a.location || 'Town Square';
      const loc = this.locations[locName] || this.locations['Town Square'];

      let pos = this.agentPositions.get(a.id);
      if (!pos) {
        // Individual spread around their city / residence so all agents have clear distinct spots
        const angle = ((a.id * 137.5) % 360) * (Math.PI / 180);
        const radius = 0.6 + ((a.id * 13) % 24) * 0.14; // Compact spread firmly inside city land

        const latOffset = Math.sin(angle) * (radius * 0.16);
        const lngOffset = Math.cos(angle) * (radius * 0.26);

        const lat = loc.lat + latOffset;
        const lng = loc.lng + lngOffset;

        const pt2d = latLngTo2D(lat, lng);
        const pt3d = latLngTo3D(lat, lng, 101.4); // Raised slightly above globe surface

        pos = {
          lat,
          lng,
          x: pt2d.x,
          y: pt2d.y,
          currentX: pt2d.x,
          currentY: pt2d.y,
          targetX: pt2d.x,
          targetY: pt2d.y,
          pt3d,
          angle,
          radius
        };
        this.agentPositions.set(a.id, pos);
      } else {
        if (a.activity === 'walking') {
          const wanderAngle = pos.angle + Math.sin(this.timeTicker * 0.05 + a.id) * 0.35;
          const lat = loc.lat + Math.sin(wanderAngle) * (pos.radius * 0.18);
          const lng = loc.lng + Math.cos(wanderAngle) * (pos.radius * 0.28);
          pos.lat = lat;
          pos.lng = lng;
          const pt2d = latLngTo2D(lat, lng);
          pos.targetX = pt2d.x;
          pos.targetY = pt2d.y;
          pos.pt3d = latLngTo3D(lat, lng, 101.4);
        }
      }
    }

    if (this.isGlobeMode) {
      this.rebuild3DAgents();
    }
    this.updateZoomHud();
  }

  // =========================================================================
  // 6. PROCEDURAL 3D CITYSCAPE & BUILDINGS ("jb zoom kre toh city dikhe")
  // =========================================================================
  rebuild3DLandmarks() {
    if (!this.landmarkGroup) return;
    const THREE = window.THREE;

    this.cityBuildingGroups = [];
    this.policeBeacons = [];

    while (this.landmarkGroup.children.length > 0) {
      const obj = this.landmarkGroup.children[0];
      this.landmarkGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    }

    for (const key of Object.keys(this.locations)) {
      const loc = this.locations[key];
      if (loc.type === 'continent') continue; // Continent labels are geographic only

      const pt = loc.pt3d;
      const cityGroup = new THREE.Group();
      cityGroup.position.set(pt.x, pt.y, pt.z);

      const normal = new THREE.Vector3(pt.x, pt.y, pt.z).normalize();
      cityGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      // 1. City Ground Boundary Disc
      const baseGeo = new THREE.CylinderGeometry(4.2, 4.2, 0.3, 16);
      const baseMat = new THREE.MeshBasicMaterial({
        color: loc.color ? new THREE.Color(loc.color) : 0x38bdf8,
        transparent: true,
        opacity: 0.35
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.15;
      cityGroup.add(baseMesh);

      // 2. City Buildings Sub-Group
      const buildingGroup = new THREE.Group();
      cityGroup.add(buildingGroup);
      this.cityBuildingGroups.push(buildingGroup);

      // 3. Construct Procedural 3D Architecture based on Location Type
      const colorVal = loc.color ? new THREE.Color(loc.color) : new THREE.Color(0x38bdf8);

      if (loc.type === 'metropolis') {
        // Skyscraper Skyline (High-rise towers of varied heights)
        const towerOffsets = [
          { x: 0, z: 0, w: 1.6, d: 1.6, h: 9.5, spire: true },
          { x: -1.6, z: -1.2, w: 1.4, d: 1.2, h: 7.2, spire: false },
          { x: 1.8, z: -1.0, w: 1.3, d: 1.4, h: 6.5, spire: false },
          { x: -1.2, z: 1.6, w: 1.5, d: 1.1, h: 8.0, spire: true },
          { x: 1.5, z: 1.4, w: 1.2, d: 1.3, h: 5.8, spire: false }
        ];

        for (const t of towerOffsets) {
          const bGeo = new THREE.BoxGeometry(t.w, t.h, t.d);
          const bMat = new THREE.MeshLambertMaterial({
            color: colorVal.clone().offsetHSL(0, 0, (Math.random() * 0.2 - 0.1))
          });
          const bMesh = new THREE.Mesh(bGeo, bMat);
          bMesh.position.set(t.x, t.h / 2 + 0.3, t.z);
          buildingGroup.add(bMesh);

          // Tower Roof Spire / Antenna
          if (t.spire) {
            const sGeo = new THREE.CylinderGeometry(0.08, 0.2, 3.2, 6);
            const sMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const sMesh = new THREE.Mesh(sGeo, sMat);
            sMesh.position.set(t.x, t.h + 1.6 + 0.3, t.z);
            buildingGroup.add(sMesh);
          }
        }
      } else if (loc.type === 'security') {
        // 🚓 Police Station & Security HQ
        const stationGeo = new THREE.BoxGeometry(3.6, 4.2, 3.2);
        const stationMat = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 });
        const stationMesh = new THREE.Mesh(stationGeo, stationMat);
        stationMesh.position.set(0, 2.1 + 0.3, 0);
        buildingGroup.add(stationMesh);

        // Security Guard Walls
        const wallGeo = new THREE.BoxGeometry(4.8, 1.4, 0.4);
        const wallMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        wallMesh.position.set(0, 0.7 + 0.3, 2.0);
        buildingGroup.add(wallMesh);

        // Flashing Dual Police Emergency Beacons (Blue & Red)
        const bGeo = new THREE.SphereGeometry(0.55, 8, 8);
        const blueBeaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const blueBeacon = new THREE.Mesh(bGeo, blueBeaconMat);
        blueBeacon.position.set(-1.0, 4.8 + 0.3, 0);
        buildingGroup.add(blueBeacon);

        const redBeaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const redBeacon = new THREE.Mesh(bGeo, redBeaconMat);
        redBeacon.position.set(1.0, 4.8 + 0.3, 0);
        buildingGroup.add(redBeacon);

        this.policeBeacons.push({ blue: blueBeacon, red: redBeacon });

      } else if (loc.type === 'residential') {
        // 🏠 Smart Homes & Residences (Neighborhood of houses/ghar)
        const houseOffsets = [
          { x: -1.3, z: -1.2 },
          { x: 1.3, z: -1.2 },
          { x: -1.3, z: 1.3 },
          { x: 1.3, z: 1.3 }
        ];

        for (const h of houseOffsets) {
          const hGeo = new THREE.BoxGeometry(1.6, 2.2, 1.6);
          const hMat = new THREE.MeshLambertMaterial({ color: 0xf472b6 });
          const hMesh = new THREE.Mesh(hGeo, hMat);
          hMesh.position.set(h.x, 1.1 + 0.3, h.z);
          buildingGroup.add(hMesh);

          const rGeo = new THREE.ConeGeometry(1.35, 1.2, 4);
          const rMat = new THREE.MeshLambertMaterial({ color: 0x9f1239 });
          const rMesh = new THREE.Mesh(rGeo, rMat);
          rMesh.position.set(h.x, 2.2 + 0.6 + 0.3, h.z);
          rMesh.rotation.y = Math.PI / 4;
          buildingGroup.add(rMesh);
        }
      } else if (loc.type === 'medical') {
        // 🏥 Emergency Hospital & Trauma Center
        const mainGeo = new THREE.BoxGeometry(3.6, 4.0, 3.2);
        const mainMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const mainMesh = new THREE.Mesh(mainGeo, mainMat);
        mainMesh.position.set(0, 2.0 + 0.3, 0);
        buildingGroup.add(mainMesh);

        // Red Medical Cross geometry on roof
        const crossHGeo = new THREE.BoxGeometry(2.0, 0.45, 0.45);
        const crossVGeo = new THREE.BoxGeometry(0.45, 2.0, 0.45);
        const crossMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

        const crossH = new THREE.Mesh(crossHGeo, crossMat);
        crossH.position.set(0, 4.4 + 0.3, 0);
        buildingGroup.add(crossH);

        const crossV = new THREE.Mesh(crossVGeo, crossMat);
        crossV.position.set(0, 4.4 + 0.3, 0);
        buildingGroup.add(crossV);

      } else if (loc.type === 'work') {
        // 🏢 Workplace Cybernetic Tech Hub (Twin Towers + Skybridge)
        const tGeo = new THREE.BoxGeometry(1.4, 7.5, 1.4);
        const tMat = new THREE.MeshLambertMaterial({ color: 0x6366f1 });

        const t1 = new THREE.Mesh(tGeo, tMat);
        t1.position.set(-1.4, 3.75 + 0.3, 0);
        buildingGroup.add(t1);

        const t2 = new THREE.Mesh(tGeo, tMat);
        t2.position.set(1.4, 3.75 + 0.3, 0);
        buildingGroup.add(t2);

        // Skybridge connecting towers
        const bridgeGeo = new THREE.BoxGeometry(2.8, 0.5, 0.8);
        const bridgeMat = new THREE.MeshBasicMaterial({ color: 0x818cf8 });
        const bridgeMesh = new THREE.Mesh(bridgeGeo, bridgeMat);
        bridgeMesh.position.set(0, 5.0 + 0.3, 0);
        buildingGroup.add(bridgeMesh);

      } else {
        // Standard Civic/Cultural Pavilion (Grand Library, Sanctuary, Cafe, Market, Park)
        const pavGeo = new THREE.CylinderGeometry(1.8, 2.0, 3.2, 12);
        const pavMat = new THREE.MeshLambertMaterial({ color: colorVal });
        const pavMesh = new THREE.Mesh(pavGeo, pavMat);
        pavMesh.position.set(0, 1.6 + 0.3, 0);
        buildingGroup.add(pavMesh);

        // Dome Roof
        const domeGeo = new THREE.SphereGeometry(1.6, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const domeMesh = new THREE.Mesh(domeGeo, domeMat);
        domeMesh.position.set(0, 3.2 + 0.3, 0);
        buildingGroup.add(domeMesh);
      }

      // 4. Central Hover Hit-Target Orb
      const headGeo = new THREE.SphereGeometry(1.6, 12, 12);
      const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const headMesh = new THREE.Mesh(headGeo, headMat);
      headMesh.position.set(0, 8.5, 0);
      cityGroup.add(headMesh);

      cityGroup.userData = { isLandmark: true, locName: key };
      this.landmarkGroup.add(cityGroup);
    }
  }

  // =========================================================================
  // 7. 3D CITIZENS RENDERING ("zoom krne par all agent dikhe")
  // =========================================================================
  rebuild3DAgents() {
    if (!this.agentGroup) return;
    const THREE = window.THREE;

    this.agent3DObjects = [];

    while (this.agentGroup.children.length > 0) {
      const obj = this.agentGroup.children[0];
      this.agentGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    }

    // Shared geometries for high performance across all 500+ agents
    const baseBeaconGeo = new THREE.RingGeometry(0.65, 1.1, 12);
    const bodyPinGeo = new THREE.CylinderGeometry(0.2, 0.42, 2.0, 8);
    const headOrbGeo = new THREE.SphereGeometry(0.72, 10, 10);

    for (const agent of this.agents) {
      if (agent.runtime_status === 'deceased') continue;
      const pos = this.agentPositions.get(agent.id);
      if (!pos || !pos.pt3d) continue;

      let colorHex = 0x38bdf8;
      let activityIcon = '🚶';
      if (agent.runtime_status === 'sleeping') {
        colorHex = 0xc084fc; // Purple
        activityIcon = '💤';
      } else if (agent.activity === 'working') {
        colorHex = 0x60a5fa; // Blue
        activityIcon = '💼';
      } else if (agent.activity === 'eating') {
        colorHex = 0xf59e0b; // Amber
        activityIcon = '🍽️';
      } else if (agent.activity === 'socializing') {
        colorHex = 0xec4899; // Pink
        activityIcon = '💬';
      } else if (agent.activity === 'resting') {
        colorHex = 0x10b981; // Green
        activityIcon = '🌿';
      }

      // Root Agent 3D Figure Group
      const agGroup = new THREE.Group();
      agGroup.position.set(pos.pt3d.x, pos.pt3d.y, pos.pt3d.z);

      const normal = new THREE.Vector3(pos.pt3d.x, pos.pt3d.y, pos.pt3d.z).normalize();
      agGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      // 1. Ground Pulsing Beacon Disc
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65
      });
      const ringMesh = new THREE.Mesh(baseBeaconGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.05;
      agGroup.add(ringMesh);

      // 2. Upright Standing Character Body Pin
      const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
      const bodyMesh = new THREE.Mesh(bodyPinGeo, bodyMat);
      bodyMesh.position.y = 1.0;
      agGroup.add(bodyMesh);

      // 3. Glowing Avatar Head Orb
      const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const headMesh = new THREE.Mesh(headOrbGeo, headMat);
      headMesh.position.y = 2.4;
      agGroup.add(headMesh);

      // 4. Floating Name Billboard Sprite (Visible upon Zoom-in)
      const labelSprite = this.createAgentSprite(agent.name, activityIcon, colorHex);
      if (labelSprite) {
        labelSprite.position.set(0, 4.4, 0);
        labelSprite.visible = false; // Toggled dynamically on zoom in render loop
        agGroup.add(labelSprite);
      }

      agGroup.userData = { isAgent: true, agentId: agent.id };
      this.agentGroup.add(agGroup);

      this.agent3DObjects.push({
        group: agGroup,
        ring: ringMesh,
        head: headMesh,
        labelSprite,
        agent
      });
    }
  }

  /**
   * Generates a sleek canvas billboard sprite displaying agent name & status icon
   */
  createAgentSprite(name, icon, colorHex) {
    try {
      const THREE = window.THREE;
      const canvas = document.createElement('canvas');
      canvas.width = 192;
      canvas.height = 48;
      const ctx = canvas.getContext('2d');

      // Rounded pill badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.roundRect(3, 3, 186, 42, 10);
      ctx.fill();

      ctx.strokeStyle = typeof colorHex === 'number' ? `#${colorHex.toString(16).padStart(6, '0')}` : '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const shortName = (name || 'Citizen').split(' ')[0];
      ctx.fillText(`${icon} ${shortName}`, 96, 24);

      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(4.8, 1.2, 1);
      return sprite;
    } catch (e) {
      return null;
    }
  }

  // =========================================================================
  // 8. HOVER CHECK (3D RAYCASTING OR 2D HIT DETECTION)
  // =========================================================================
  checkHover(screenX, screenY) {
    if (this.isGlobeMode && this.raycaster && this.camera && this.globeGroup) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseRay.x = ((screenX) / rect.width) * 2 - 1;
      this.mouseRay.y = -((screenY) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouseRay, this.camera);
      const intersects = this.raycaster.intersectObjects(this.globeGroup.children, true);

      let foundAgent = null;
      let foundLoc = null;

      if (this.viewMode === 'solar') {
        const earthHits = this.raycaster.intersectObjects(this.globeGroup.children, true);
        if (earthHits.length > 0) {
          foundLoc = { name: 'SolarSystem_Earth', icon: '🌍', region: 'मानव सिमुलेशन (Click to Focus Earth)' };
        } else if (this.planets) {
          for (const p of this.planets) {
            if (p.group) {
              const hits = this.raycaster.intersectObjects(p.group.children, true);
              if (hits.length > 0) {
                foundLoc = { name: 'SolarSystem_' + p.name, icon: '🪐', region: p.hindiName };
                break;
              }
            }
          }
        }
      } else {
        for (const hit of intersects) {
          let curr = hit.object;
          while (curr && curr !== this.globeGroup) {
            if (curr.userData && curr.userData.isAgent) {
              foundAgent = this.agents.find(a => a.id === curr.userData.agentId);
              break;
            } else if (curr.userData && curr.userData.isLandmark) {
              foundLoc = this.locations[curr.userData.locName];
              break;
            }
            curr = curr.parent;
          }
          if (foundAgent || foundLoc) break;
        }
      }

      this.hoveredAgent = foundAgent;
      this.hoveredLocation = foundLoc;
      this.canvas.style.cursor = (foundAgent || foundLoc) ? 'pointer' : (this.isDragging ? 'grabbing' : 'grab');
    } else {
      const worldX = (screenX - this.pan2D_X) / this.zoom2D;
      const worldY = (screenY - this.pan2D_Y) / this.zoom2D;
      const hitRadius = 22 / this.zoom2D;

      let foundAgent = null;
      let foundLoc = null;

      if (this.zoom2D >= 1.25) {
        for (const agent of this.agents) {
          if (agent.runtime_status === 'deceased') continue;
          const pos = this.agentPositions.get(agent.id);
          if (!pos) continue;
          if (Math.hypot(pos.currentX - worldX, pos.currentY - worldY) < hitRadius) {
            foundAgent = agent;
            break;
          }
        }
      }

      if (!foundAgent) {
        for (const locName of Object.keys(this.locations)) {
          const loc = this.locations[locName];
          if (loc.type === 'continent') continue;
          if (Math.hypot(loc.x - worldX, loc.y - worldY) < 24 / this.zoom2D) {
            foundLoc = loc;
            break;
          }
        }
      }

      this.hoveredAgent = foundAgent;
      this.hoveredLocation = foundLoc;
      this.canvas.style.cursor = (foundAgent || foundLoc) ? 'pointer' : (this.isDragging ? 'grabbing' : 'grab');
    }
  }

  // =========================================================================
  // 9. MASTER RENDER LOOP
  // =========================================================================
  loop() {
    this.timeTicker++;

    if (this.isGlobeMode && this.renderer) {
      this.render3DGlobe();
    } else if (this.ctx) {
      this.render2DMap();
    }

    requestAnimationFrame(() => this.loop());
  }

  // =========================================================================
  // 10. THREE.JS 3D RENDER CYCLE (GROW BUILDINGS & CITIZENS ON ZOOM-IN)
  // =========================================================================
  render3DGlobe() {
    const isSolar = this.viewMode === 'solar';

    // Flare pulse on the Sun
    if (this.sunCoronaMesh && this.sunFlareMesh) {
      this.sunCoronaMesh.rotation.y += 0.003;
      this.sunFlareMesh.rotation.y -= 0.002;
      const flarePulse = 1.0 + Math.sin(this.timeTicker * 0.04) * 0.04;
      this.sunFlareMesh.scale.set(flarePulse, flarePulse, flarePulse);
    }

    if (isSolar) {
      // 1. SOLAR SYSTEM VIEW: Real-world Heliocentric Model matching reference diagram
      const solarSpeed = Math.max(0.1, this.solarSpeedMultiplier || 1.0);

      // Auto-spin solar system 3D camera perspective around central Sun
      if (this.solarAutoRotate && !this.isDragging) {
        this.targetSolarYaw += 0.0024 * solarSpeed;
      }

      this.solarCameraDist += (this.targetSolarCameraDist - this.solarCameraDist) * 0.08;
      this.solarPitch += (this.targetSolarPitch - this.solarPitch) * 0.08;
      this.solarYaw += (this.targetSolarYaw - this.solarYaw) * 0.08;

      const targetCamX = this.solarCameraDist * Math.cos(this.solarPitch) * Math.sin(this.solarYaw);
      const targetCamY = this.solarCameraDist * Math.sin(this.solarPitch);
      const targetCamZ = this.solarCameraDist * Math.cos(this.solarPitch) * Math.cos(this.solarYaw);

      this.camera.position.x += (targetCamX - this.camera.position.x) * 0.08;
      this.camera.position.y += (targetCamY - this.camera.position.y) * 0.08;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * 0.08;

      if (!this.cameraLookAt) this.cameraLookAt = new THREE.Vector3();
      this.cameraLookAt.lerp(new THREE.Vector3(0, 0, 0), 0.08);
      this.camera.lookAt(this.cameraLookAt);

      // Earth scaled proportionally into the planetary diagram
      const targetEarthScale = 0.15;
      this.globeGroup.scale.x += (targetEarthScale - this.globeGroup.scale.x) * 0.1;
      this.globeGroup.scale.y += (targetEarthScale - this.globeGroup.scale.y) * 0.1;
      this.globeGroup.scale.z += (targetEarthScale - this.globeGroup.scale.z) * 0.1;

      // Axial diurnal spin for Earth (scaled by speed)
      this.globeGroup.rotation.y += 0.006 * solarSpeed;

      if (this.planets) {
        for (const p of this.planets) {
          if (this.solarAutoRotate && !this.isDragging) {
            p.angle += p.speed * 0.14 * solarSpeed; // Keplerian orbital velocity around central Sun
          }

          const px = p.orbitRadius * Math.cos(p.angle);
          const pz = p.orbitRadius * Math.sin(p.angle);

          if (p.isEarth) {
            this.globeGroup.position.set(px, 0, pz);
            if (p.label) p.label.position.set(px, -16, pz + 14);
            continue;
          }

          if (p.mesh) p.mesh.rotation.y += 0.01 * solarSpeed;
          if (p.group) p.group.position.set(px, 0, pz);
          if (p.label) p.label.position.set(px, -p.radius - 12, pz + 12);
        }
      }
    } else {
      // 2. EARTH SIMULATION VIEW: Focus on Earth, cities, and living agents
      if (this.autoRotate && !this.isDragging) {
        this.targetRotationY += 0.0016;
      }

      this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.08;
      this.currentRotationX += (this.targetRotationX - this.currentRotationX) * 0.08;
      this.cameraDistance += (this.targetCameraDistance - this.cameraDistance) * 0.12;

      this.globeGroup.rotation.y = this.currentRotationY;
      this.globeGroup.rotation.x = this.currentRotationX;
      this.globeGroup.position.lerp(new THREE.Vector3(0, 0, 0), 0.12);

      // Scale Earth back to 1.0 (full high-res radius 100) for city and citizen inspection
      this.globeGroup.scale.x += (1.0 - this.globeGroup.scale.x) * 0.12;
      this.globeGroup.scale.y += (1.0 - this.globeGroup.scale.y) * 0.12;
      this.globeGroup.scale.z += (1.0 - this.globeGroup.scale.z) * 0.12;

      if (!this.cameraLookAt) this.cameraLookAt = new THREE.Vector3();
      this.cameraLookAt.lerp(new THREE.Vector3(0, 0, 0), 0.1);

      this.camera.position.x += (0 - this.camera.position.x) * 0.1;
      this.camera.position.y += (0 - this.camera.position.y) * 0.1;
      this.camera.position.z += (this.cameraDistance - this.camera.position.z) * 0.1;
      this.camera.lookAt(this.cameraLookAt);
    }

    // Atmospheric limb pulse
    if (this.atmMatureMesh) {
      const pulse = Math.sin(this.timeTicker * 0.05) * 0.02 + 0.18;
      this.atmMatureMesh.material.opacity = pulse;
    }

    // Atmospheric cloud rotation (drifting over continents)
    if (this.cloudsMesh && this.cloudsVisible) {
      this.cloudsMesh.rotation.y += 0.0003;
    }

    // Dynamic 3D City Buildings Growth upon Zoom-In ("jb zoom kre toh city dikhe")
    const zoomProgress = Math.max(0, Math.min(1, (240 - this.cameraDistance) / (240 - 125)));
    const buildingScale = 0.35 + zoomProgress * 0.90;

    for (const bGroup of this.cityBuildingGroups) {
      bGroup.scale.set(buildingScale, buildingScale, buildingScale);
    }

    // Dynamic 3D Citizens Scaling & Label Visibility on Zoom ("zoom krne par all agent dikhe")
    // When far away: compact visible beacon (0.75x)
    // When zoomed in close: prominent avatar figures (2.2x) with floating name labels!
    const agentScale = 0.75 + zoomProgress * 1.65;
    const showLabels = this.cameraDistance <= 175;

    for (const ag of this.agent3DObjects) {
      ag.group.scale.set(agentScale, agentScale, agentScale);

      // Pulse beacon ring
      if (ag.ring) {
        ag.ring.material.opacity = 0.45 + Math.sin(this.timeTicker * 0.08 + ag.agent.id) * 0.25;
      }

      if (ag.labelSprite) {
        ag.labelSprite.visible = showLabels;
      }
    }

    // Police Flashing Alternating Red & Blue Beacons
    for (const p of this.policeBeacons) {
      const phase = Math.sin(this.timeTicker * 0.22);
      if (p.blue && p.blue.material) {
        p.blue.material.opacity = phase > 0 ? 1.0 : 0.2;
      }
      if (p.red && p.red.material) {
        p.red.material.opacity = phase <= 0 ? 1.0 : 0.2;
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.renderScreenHudOverlay();
  }

  // =========================================================================
  // 11. 2D FALLBACK RENDER CYCLE (TRUE EQUIRECTANGULAR REAL EARTH MAP)
  // =========================================================================
  render2DMap() {
    const ctx = this.ctx;
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;

    this.zoom2D += (this.targetZoom2D - this.zoom2D) * 0.12;
    this.pan2D_X += (this.targetPan2D_X - this.pan2D_X) * 0.12;
    this.pan2D_Y += (this.targetPan2D_Y - this.pan2D_Y) * 0.12;

    ctx.clearRect(0, 0, canvasW, canvasH);

    // Deep Cosmic Backdrop
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvasW, canvasH);
    for (const star of this.stars2D) {
      ctx.beginPath();
      ctx.arc(star.x * canvasW, star.y * canvasH, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.fill();
    }

    ctx.save();
    ctx.translate(this.pan2D_X, this.pan2D_Y);
    ctx.scale(this.zoom2D, this.zoom2D);

    // 1. Draw Real Equirectangular Earth Satellite Map (2:1 NASA Blue Marble)
    if (this.earthLoaded && this.earthImg.complete) {
      ctx.drawImage(this.earthImg, 0, 0, EARTH_2D_WIDTH, EARTH_2D_HEIGHT);
    } else {
      ctx.fillStyle = '#0a192f';
      ctx.fillRect(0, 0, EARTH_2D_WIDTH, EARTH_2D_HEIGHT);
    }

    // 2. Tactical Geographic Graticule (Equator, Tropics, Prime Meridian)
    this.draw2DGraticules(ctx);

    // 3. Continent & Ocean Name Overlays
    this.draw2DContinentAndOceans(ctx);

    // 4. Cities and Landmarks
    this.draw2DLandmarks(ctx);

    // 5. Citizens on Map with Names upon Zoom
    if (this.zoom2D >= 1.2) {
      this.draw2DCitizens(ctx);
    }

    ctx.restore();
    this.renderScreenHudOverlay();
  }

  draw2DGraticules(ctx) {
    ctx.save();
    ctx.lineWidth = 1;

    // Equator (0° Latitude)
    const eqY = latLngTo2D(0, 0).y;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, eqY);
    ctx.lineTo(EARTH_2D_WIDTH, eqY);
    ctx.stroke();

    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
    ctx.textAlign = 'left';
    ctx.fillText('0° भूमध्य रेखा (Equator)', 12, eqY - 4);

    // Tropic of Cancer (23.5° N)
    const canY = latLngTo2D(23.4365, 0).y;
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(0, canY);
    ctx.lineTo(EARTH_2D_WIDTH, canY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(234, 179, 8, 0.75)';
    ctx.fillText('23.5° N कर्क रेखा (Tropic of Cancer)', 12, canY - 4);

    // Tropic of Capricorn (-23.5° S)
    const capY = latLngTo2D(-23.4365, 0).y;
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)';
    ctx.beginPath();
    ctx.moveTo(0, capY);
    ctx.lineTo(EARTH_2D_WIDTH, capY);
    ctx.stroke();
    ctx.fillText('23.5° S मकर रेखा (Tropic of Capricorn)', 12, capY + 12);

    // Arctic Circle (66.5° N)
    const arcY = latLngTo2D(66.5, 0).y;
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, arcY);
    ctx.lineTo(EARTH_2D_WIDTH, arcY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(147, 197, 253, 0.7)';
    ctx.fillText('66.5° N आर्कटिक वृत्त (Arctic Circle)', 12, arcY - 4);

    // Antarctic Circle (-66.5° S)
    const antY = latLngTo2D(-66.5, 0).y;
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, antY);
    ctx.lineTo(EARTH_2D_WIDTH, antY);
    ctx.stroke();
    ctx.fillText('66.5° S अंटार्कटिक वृत्त (Antarctic Circle)', 12, antY + 12);

    // Prime Meridian (0° Longitude - Greenwich)
    const pmX = latLngTo2D(0, 0).x;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(pmX, 0);
    ctx.lineTo(pmX, EARTH_2D_HEIGHT);
    ctx.stroke();

    ctx.save();
    ctx.translate(pmX - 6, 50);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.fillText('0° प्रधान मध्याह्न (Prime Meridian - Greenwich)', 0, 0);
    ctx.restore();

    ctx.setLineDash([]);
    ctx.restore();
  }

  draw2DContinentAndOceans(ctx) {
    if (this.zoom2D > 3.4) return; // Hide when closely zoomed into an individual city

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Continents
    const continents = [
      { name: 'एशिया (Asia)', lat: 38, lng: 90, color: '#fef08a' },
      { name: 'यूरोप (Europe)', lat: 50, lng: 18, color: '#bae6fd' },
      { name: 'अफ्रीका (Africa)', lat: 4, lng: 22, color: '#bbf7d0' },
      { name: 'उत्तरी अमेरिका (North America)', lat: 44, lng: -100, color: '#fbcfe8' },
      { name: 'दक्षिणी अमेरिका (South America)', lat: -16, lng: -58, color: '#a5f3fc' },
      { name: 'ऑस्ट्रेलिया (Australia)', lat: -25, lng: 134, color: '#ddd6fe' },
      { name: 'अंटार्कटिका (Antarctica)', lat: -78, lng: 0, color: '#e2e8f0' }
    ];

    for (const c of continents) {
      const pt = latLngTo2D(c.lat, c.lng);
      ctx.font = 'bold 11px Inter, sans-serif';
      const tw = ctx.measureText(c.name).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.roundRect(pt.x - (tw + 14) / 2, pt.y - 10, tw + 14, 20, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = c.color;
      ctx.fillText(c.name, pt.x, pt.y);
    }

    // Oceans (Atmospheric labels)
    const oceans = [
      { name: 'प्रशांत महासागर (Pacific Ocean)', lat: 0, lng: -140 },
      { name: 'प्रशांत महासागर (Pacific Ocean)', lat: 0, lng: 165 },
      { name: 'अटलांटिक महासागर (Atlantic Ocean)', lat: 18, lng: -32 },
      { name: 'हिंद महासागर (Indian Ocean)', lat: -18, lng: 76 },
      { name: 'आर्कटिक महासागर (Arctic Ocean)', lat: 80, lng: 0 }
    ];

    ctx.font = 'italic 10.5px Inter, sans-serif';
    ctx.fillStyle = 'rgba(147, 197, 253, 0.45)';
    for (const o of oceans) {
      const pt = latLngTo2D(o.lat, o.lng);
      ctx.fillText(o.name, pt.x, pt.y);
    }

    ctx.restore();
  }

  draw2DLandmarks(ctx) {
    for (const locName of Object.keys(this.locations)) {
      const loc = this.locations[locName];
      if (loc.type === 'continent') continue;

      const count = this.agents.filter(a => (a.preferred_city === locName || a.location === locName) && a.runtime_status !== 'deceased').length;

      ctx.beginPath();
      ctx.arc(loc.x, loc.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = loc.color || '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(loc.icon, loc.x, loc.y);

      ctx.font = 'bold 10.5px Inter, sans-serif';
      const label = `${loc.name} • 👥 ${count}`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.roundRect(loc.x - (tw + 12) / 2, loc.y + 16, tw + 12, 18, 5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, loc.x, loc.y + 25);
    }
  }

  draw2DCitizens(ctx) {
    const dotRadius = Math.max(3.5, Math.min(8.5, 3.5 + (this.zoom2D - 1.2) * 1.6));
    for (const agent of this.agents) {
      if (agent.runtime_status === 'deceased') continue;
      const pos = this.agentPositions.get(agent.id);
      if (!pos) continue;

      let color = '#38bdf8';
      if (agent.runtime_status === 'sleeping') color = '#c084fc';
      else if (agent.activity === 'working') color = '#60a5fa';
      else if (agent.activity === 'eating') color = '#f59e0b';
      else if (agent.activity === 'socializing') color = '#ec4899';
      else if (agent.activity === 'resting') color = '#10b981';

      // Drop shadow
      ctx.beginPath();
      ctx.ellipse(pos.currentX + 1.8, pos.currentY + 2.2, dotRadius * 1.1, dotRadius * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();

      // Citizen Marker
      ctx.beginPath();
      ctx.arc(pos.currentX, pos.currentY, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // When zoomed in, draw citizen name tag
      if (this.zoom2D >= 2.0) {
        ctx.font = 'bold 9.5px Inter, sans-serif';
        const namePart = (agent.name || 'Citizen').split(' ')[0];
        const tw = ctx.measureText(namePart).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.roundRect(pos.currentX - (tw + 8) / 2, pos.currentY - dotRadius - 15, tw + 8, 13, 3);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(namePart, pos.currentX, pos.currentY - dotRadius - 8);
      }
    }
  }

  // =========================================================================
  // 12. RECONNAISSANCE HUD (SHOWS CHOSEN CITY & REASON)
  // =========================================================================
  renderScreenHudOverlay() {
    let tooltip = document.getElementById('earth-recon-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'earth-recon-tooltip';
      tooltip.style.position = 'absolute';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.zIndex = '999';
      tooltip.style.display = 'none';
      if (this.container) this.container.appendChild(tooltip);
    }

    if (this.hoveredAgent) {
      const a = this.hoveredAgent;
      tooltip.style.display = 'block';
      tooltip.style.right = '20px';
      tooltip.style.bottom = '75px';
      tooltip.innerHTML = `
        <div style="background:rgba(15,23,42,0.94);backdrop-filter:blur(16px);border:1px solid rgba(56,189,248,0.45);border-radius:12px;padding:14px 18px;min-width:280px;box-shadow:0 12px 30px rgba(0,0,0,0.75);color:#fff;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:6px;">
            <div style="font-weight:700;font-size:14px;color:#38bdf8;">🛰️ सैटेलाइट टार्गेट [ ⌖ ]</div>
            <span style="font-size:11px;background:#1e293b;padding:2px 8px;border-radius:99px;color:#94a3b8;">आयु: ${a.age || 28} वर्ष</span>
          </div>
          <div style="font-size:15px;font-weight:800;color:#fff;">${a.name}</div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">💼 ${a.occupation} • 📍 वर्तमान: ${a.location}</div>
          
          <!-- Autonomous City Choice Badge -->
          <div style="background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.28);border-radius:8px;padding:7px 10px;margin-bottom:8px;">
            <div style="font-size:11px;color:#38bdf8;font-weight:700;">🏠 नागरिक का पसंदीदा शहर (Choice):</div>
            <div style="font-size:13px;font-weight:800;color:#fff;">${a.preferred_city || a.location}</div>
            <div style="font-size:11px;color:#cbd5e1;font-style:italic;margin-top:2px;">"${a.choice_reason || 'Autonomous choice'}"</div>
          </div>

          <div style="display:flex;gap:6px;font-size:11.5px;flex-wrap:wrap;">
            <span style="background:rgba(56,189,248,0.15);color:#38bdf8;padding:2px 8px;border-radius:6px;">गतिविधि: ${a.activity}</span>
            <span style="background:rgba(16,185,129,0.15);color:#10b981;padding:2px 8px;border-radius:6px;">स्वास्थ्य: ${Math.round(a.health || 80)}%</span>
            <span style="background:rgba(234,179,8,0.15);color:#eab308;padding:2px 8px;border-radius:6px;">ऊर्जा: ${Math.round(a.energy || 75)}%</span>
          </div>
          <div style="margin-top:8px;text-align:right;font-size:10.5px;color:#38bdf8;font-weight:700;">👆 क्लिक करके पूरा प्रोफाइल व मन्नत देखें</div>
        </div>
      `;
    } else if (this.hoveredLocation) {
      const loc = this.hoveredLocation;
      const residents = this.agents.filter(a => (a.preferred_city === loc.name || a.location === loc.name) && a.runtime_status !== 'deceased');
      const residentSample = residents.slice(0, 4).map(r => r.name.split(' ')[0]).join(', ');

      tooltip.style.display = 'block';
      tooltip.style.right = '20px';
      tooltip.style.bottom = '75px';
      tooltip.innerHTML = `
        <div style="background:rgba(15,23,42,0.94);backdrop-filter:blur(16px);border:1px solid rgba(56,189,248,0.45);border-radius:12px;padding:14px 18px;min-width:270px;box-shadow:0 12px 30px rgba(0,0,0,0.75);color:#fff;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:22px;">${loc.icon}</span>
            <div>
              <div style="font-weight:800;font-size:15px;color:#fff;">${loc.name}</div>
              <div style="font-size:11.5px;color:#94a3b8;">${loc.region || 'World Landmark'}</div>
            </div>
          </div>
          <div style="font-size:13px;font-weight:800;color:#38bdf8;margin-top:6px;">
            👥 पसंद से रहने वाले निवासी: ${residents.length}
          </div>
          ${residentSample ? `<div style="font-size:11px;color:#cbd5e1;margin-top:4px;">निवासी: ${residentSample}${residents.length > 4 ? ' आदि' : ''}</div>` : ''}
          <div style="margin-top:8px;font-size:11px;color:#38bdf8;font-weight:700;">
            👆 क्लिक करके सीधे इस स्थान पर ज़ूम करें (Focus Location)
          </div>
        </div>
      `;
    } else {
      tooltip.style.display = 'none';
    }
  }

  // =========================================================================
  // 13. STATUS BADGE UPDATE
  // =========================================================================
  updateZoomHud() {
    const indicator = document.getElementById('earth-zoom-status-badge');
    if (indicator) {
      const livingCount = this.agents.filter(a => a.runtime_status !== 'deceased').length;
      if (this.isGlobeMode) {
        if (this.viewMode === 'solar') {
          indicator.className = 'badge';
          indicator.style.background = 'rgba(234, 179, 8, 0.25)';
          indicator.style.color = '#fde047';
          indicator.style.border = '1px solid rgba(234, 179, 8, 0.5)';
          indicator.textContent = `🌌 3D सौरमंडल (Solar System Diagram) • 1 केंद्रीय सूर्य + 8 ग्रह • 🌍 पृथ्वी पर ${livingCount} नागरिक सक्रिय`;
        } else {
          const zoomPct = Math.round((1 - (this.cameraDistance - this.minCameraDistance) / (this.maxCameraDistance - this.minCameraDistance)) * 100);
          indicator.className = 'badge';
          indicator.style.background = 'rgba(56, 189, 248, 0.2)';
          indicator.style.color = '#7dd3fc';
          indicator.style.border = '1px solid rgba(56, 189, 248, 0.4)';
          indicator.textContent = `🌍 3D गोल पृथ्वी • ${livingCount} नागरिक सक्रिय • ज़ूम: ${zoomPct}% • शहर सटीक ज़मीन पर स्थित`;
        }
      } else {
        indicator.className = 'badge';
        indicator.style.background = 'rgba(234, 179, 8, 0.2)';
        indicator.style.color = '#fde047';
        indicator.style.border = '1px solid rgba(234, 179, 8, 0.4)';
        indicator.textContent = `🗺️ 2D फ्लैट मैप (${this.zoom2D.toFixed(1)}x) • ${livingCount} नागरिक बिंदु सक्रिय`;
      }
    }
  }
}

window.SimulationWorldCanvas = SimulationWorldCanvas;
