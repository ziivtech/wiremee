// 3D "fintech" globe behind the ".globe-bg" sections: a natural-looking Earth (NASA-based textures
// from the three.js examples, in assets/img/earth) with drifting clouds and a soft atmosphere, plus
// money routes between financial hubs, pulsing city markers, currency symbols and a faint grid.
// Without WebGL the sections simply keep their plain background.
(function globe3d() {
  if (!window.THREE) return;

  const sections = Array.from(document.querySelectorAll(".globe-bg"));
  if (!sections.length) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const supportsWebGL = (() => {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) {
      return false;
    }
  })();
  if (!supportsWebGL) return;

  const FOV = 30;
  const R = 1;                   // globe radius (scene units)
  const SPIN_SPEED = 0.045;      // rad/s, slow so it stays in the background
  const FACE_LON = 15;           // longitude facing the viewer at start (Africa)
  const TILT = 0.32;             // rad, tips the north pole slightly towards the viewer
  const CLOUD_DRIFT = 0.012;     // rad/s the clouds move relative to the ground
  const TEX = "assets/img/earth/";
  const SHOW_ROUTES = true;      // set false to hide the arcs and pulses

  const GREEN = new THREE.Color(0x02c408);
  const BLUE = new THREE.Color(0x17bef6);

  // Financial hubs on every continent: [lat, lon, currency symbol]
  const HUB = {
    accra: [5.6, -0.2, "₵"], lagos: [6.5, 3.4, "₦"], nairobi: [-1.3, 36.8, ""], joburg: [-26.2, 28.0, ""], cairo: [30.0, 31.2, ""],
    london: [51.5, -0.1, "£"], frankfurt: [50.1, 8.7, "€"], dubai: [25.2, 55.3, ""], mumbai: [19.1, 72.9, "₹"],
    singapore: [1.35, 103.8, "₿"], shanghai: [31.2, 121.5, "¥"], tokyo: [35.7, 139.7, ""], sydney: [-33.9, 151.2, ""],
    newYork: [40.7, -74.0, "$"], toronto: [43.7, -79.4, ""], sanFrancisco: [37.8, -122.4, ""], mexicoCity: [19.4, -99.1, ""],
    saoPaulo: [-23.5, -46.6, ""], lima: [-12.0, -77.0, ""],
  };
  // Africa-centred, but spread around the world so arcs show from every side as the globe turns.
  const ROUTES = [
    ["accra", "london"], ["lagos", "newYork"], ["nairobi", "dubai"], ["joburg", "shanghai"], ["accra", "saoPaulo"],
    ["cairo", "frankfurt"], ["lagos", "london"], ["nairobi", "mumbai"], ["joburg", "sydney"], ["dubai", "singapore"],
    ["mumbai", "singapore"], ["singapore", "sydney"], ["shanghai", "tokyo"], ["tokyo", "sanFrancisco"], ["sydney", "sanFrancisco"],
    ["sanFrancisco", "newYork"], ["toronto", "london"], ["newYork", "frankfurt"], ["mexicoCity", "saoPaulo"], ["lima", "mexicoCity"],
    ["saoPaulo", "joburg"], ["tokyo", "mumbai"],
  ];

  // Lat/lon to a point matching the texture on three.js spheres (lon -180 at u = 0).
  function toVec(lat, lon, r) {
    const phi = ((lon + 180) * Math.PI) / 180;
    const theta = ((90 - lat) * Math.PI) / 180;
    return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
  }

  // Great-circle arc lifted off the surface.
  function arcPoints(a, b, steps) {
    const va = toVec(a[0], a[1], 1);
    const vb = toVec(b[0], b[1], 1);
    const angle = va.angleTo(vb);
    const lift = 0.05 + angle * 0.09;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const v = va.clone().multiplyScalar(Math.sin((1 - t) * angle))
        .add(vb.clone().multiplyScalar(Math.sin(t * angle)))
        .divideScalar(Math.sin(angle));
      pts.push(v.normalize().multiplyScalar(R * (1.01 + Math.sin(Math.PI * t) * lift)));
    }
    return pts;
  }

  // Round white chip with a gradient currency symbol, used as a sprite.
  function currencyTexture(symbol) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.beginPath();
    g.arc(64, 64, 58, 0, Math.PI * 2);
    g.fill();
    const grad = g.createLinearGradient(20, 0, 108, 0);
    grad.addColorStop(0, "#02c408");
    grad.addColorStop(1, "#17bef6");
    g.fillStyle = grad;
    g.font = "800 68px Manrope, system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(symbol, 64, 68);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // Shared textures (loaded once for every section).
  const loader = new THREE.TextureLoader();
  const loadTex = (file, srgb) => new Promise((resolve) => {
    loader.load(TEX + file, (t) => {
      if (srgb) t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 4;
      resolve(t);
    }, undefined, () => resolve(null));
  });
  const textures = Promise.all([loadTex("earth-day.webp", true), loadTex("earth-water.webp"), loadTex("earth-clouds.webp", true)]);

  function buildScene(light, [day, water, clouds]) {
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const sun = new THREE.DirectionalLight(0xffffff, 0.95);
    sun.position.set(-4, 3, 6);
    scene.add(sun);

    const globe = new THREE.Group();
    globe.rotation.x = TILT;
    scene.add(globe);

    const segs = light ? [48, 32] : [96, 64];
    globe.add(new THREE.Mesh(
      new THREE.SphereGeometry(R, segs[0], segs[1]),
      new THREE.MeshPhongMaterial({ map: day, specularMap: water, specular: new THREE.Color(0x3a4a5a), shininess: 18 })
    ));

    let cloudMesh = null;
    if (clouds) {
      cloudMesh = new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.008, segs[0], segs[1]),
        new THREE.MeshLambertMaterial({ map: clouds, transparent: true, opacity: 0.85, depthWrite: false })
      );
      globe.add(cloudMesh);
    }

    // Soft blue atmosphere around the edge.
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.06, 64, 48),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "varying vec3 vN; void main(){ float i = pow(0.72 - dot(vN, vec3(0.0, 0.0, 1.0)), 3.0); gl_FragColor = vec4(0.35, 0.65, 1.0, clamp(i, 0.0, 1.0)); }",
      })
    ));

    // Faint latitude / longitude grid
    const grid = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += 4) grid.push(toVec(lat, lon, R * 1.012), toVec(lat, lon + 4, R * 1.012));
    }
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -80; lat < 80; lat += 4) grid.push(toVec(lat, lon, R * 1.012), toVec(lat + 4, lon, R * 1.012));
    }
    globe.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(grid),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 })
    ));

    // City markers: a dot plus a ring that pulses outwards.
    const rings = [];
    const ringGeo = new THREE.RingGeometry(0.75, 1, 32);
    Object.values(HUB).forEach(([lat, lon, symbol], i) => {
      const pos = toVec(lat, lon, R * 1.012);
      const normal = pos.clone().normalize();

      const dot = new THREE.Mesh(new THREE.SphereGeometry(R * 0.012, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      dot.position.copy(pos);
      globe.add(dot);

      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      ring.position.copy(pos);
      ring.lookAt(pos.clone().add(normal));
      globe.add(ring);
      rings.push({ mesh: ring, offset: i * 0.37 });

      if (symbol) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: currencyTexture(symbol), transparent: true }));
        sprite.position.copy(toVec(lat, lon, R * 1.16));
        sprite.scale.setScalar(R * 0.11);
        globe.add(sprite);
      }
    });

    // Money routes: green→blue arcs with a pulse travelling along each.
    const pulses = [];
    if (SHOW_ROUTES) {
      const pulseGeo = new THREE.SphereGeometry(R * 0.016, 12, 8);
      ROUTES.forEach(([from, to], i) => {
        const curve = new THREE.CatmullRomCurve3(arcPoints(HUB[from], HUB[to], 64));
        const tube = new THREE.TubeGeometry(curve, 96, R * 0.004, 6, false);
        const colors = [];
        for (let v = 0; v < tube.attributes.position.count; v++) {
          const c = GREEN.clone().lerp(BLUE, Math.floor(v / 7) / 96); // 7 vertices per ring along the tube
          colors.push(c.r, c.g, c.b);
        }
        tube.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        globe.add(new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 })));

        const pulse = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
        globe.add(pulse);
        pulses.push({ curve, mesh: pulse, offset: i / ROUTES.length, speed: 0.1 + (i % 3) * 0.02 });
      });
    }

    return { scene, globe, cloudMesh, rings, pulses };
  }

  function mount(section) {
    const canvas = document.createElement("canvas");
    canvas.className = "globe-bg__canvas";
    canvas.setAttribute("aria-hidden", "true");
    section.prepend(canvas);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    } catch (e) {
      canvas.remove();
      return null;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1000);
    const light = canvas.clientWidth < 700;
    const view = { section, renderer, camera, built: null, light, fps: light ? 30 : 60, lastDraw: 0, visible: false, resize };

    function resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const sh = section.clientHeight;
      if (!w || !h || !sh) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Globe radius in px: big on desktop, fits the width on phones.
      const radiusPx = (view.radiusPx = Math.min(sh * 0.4, w * 0.42, 380));
      const tanHalf = Math.tan((FOV * Math.PI) / 360);
      camera.position.set(0, 0, (R * h) / (2 * tanHalf * radiusPx));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();

      // Phones: sections are tall and full of cards, so lift the globe up behind the heading
      // (centre ~200px below the section top) instead of hiding it in the middle.
      const centerFromTop = w < 700 ? 80 + 200 : h / 2; // canvas starts 80px above the section
      view.globeY = ((h / 2 - centerFromTop) * R) / view.radiusPx;
      if (view.built) view.built.globe.position.y = view.globeY;
    }

    resize();
    return view;
  }

  function draw(v, seconds) {
    if (!v.built) return;
    const { globe, scene, cloudMesh, rings, pulses } = v.built;
    // Texture longitude 0 faces +x on three.js spheres, so -90° turns FACE_LON towards the camera.
    globe.rotation.y = (-(FACE_LON + 90) * Math.PI) / 180 + seconds * SPIN_SPEED;
    if (cloudMesh) cloudMesh.rotation.y = seconds * CLOUD_DRIFT;
    rings.forEach((r) => {
      const t = (seconds * 0.6 + r.offset) % 1;
      r.mesh.scale.setScalar(R * (0.015 + t * 0.05));
      r.mesh.material.opacity = 1 - t;
    });
    pulses.forEach((p) => {
      const t = (p.offset + seconds * p.speed) % 1;
      p.mesh.position.copy(p.curve.getPointAt(t));
    });
    v.renderer.render(scene, v.camera);
  }

  const views = sections.map(mount).filter(Boolean);
  if (!views.length) return;

  textures.then((tex) => {
    if (!tex[0]) return; // no Earth texture: keep the plain background
    views.forEach((v) => {
      v.built = buildScene(v.light, tex);
      v.built.globe.position.y = v.globeY || 0;
      draw(v, 0);
      v.section.classList.add("globe-bg--3d");
    });
  });

  window.addEventListener("resize", () => views.forEach((v) => { v.resize(); draw(v, 0); }));
  if (reducedMotion) return; // keep the single still frame

  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      const v = views.find((x) => x.section === e.target);
      if (v) v.visible = e.isIntersecting;
    }),
    { rootMargin: "100px" }
  );
  views.forEach((v) => io.observe(v.section));

  const start = performance.now();
  function tick(now) {
    views.forEach((v) => {
      if (!v.visible || now - v.lastDraw < 1000 / v.fps - 2) return;
      v.lastDraw = now;
      draw(v, (now - start) / 1000);
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
