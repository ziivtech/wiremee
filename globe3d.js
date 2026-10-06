// 3D globe behind the ".globe-bg" sections.
// Continents are drawn as small white beads (positions from globe-land.js) and the globe turns slowly.
// Without WebGL the sections simply keep their plain background.
(function globe3d() {
  if (!window.THREE || !window.WIREMEE_LAND) return;

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


  function toVec(lat, lon, r) {
    const la = (lat * Math.PI) / 180;
    const lo = (lon * Math.PI) / 180;
    return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
  }


  function buildScene(light) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(-4, 5, 7);
    scene.add(key);

    const globe = new THREE.Group();
    globe.rotation.x = TILT;
    scene.add(globe);

    // Soft body so the globe reads as a sphere.
    globe.add(new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.985, 64, 48),
      new THREE.MeshStandardMaterial({ color: 0xe4e4e4, roughness: 1, metalness: 0 })
    ));

    // Land beads
    const land = window.WIREMEE_LAND;
    const count = land.length / 2;
    const beadGeo = new THREE.SphereGeometry(R * 0.0125, light ? 6 : 10, light ? 4 : 8);
    const beads = new THREE.InstancedMesh(
      beadGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, metalness: 0 }),
      count
    );
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const p = toVec(land[i * 2] / 10, land[i * 2 + 1] / 10, R);
      beads.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z));
    }
    globe.add(beads);

    return { scene, globe };
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
    const built = buildScene(light);
    const view = { section, renderer, camera, built, fps: light ? 30 : 60, lastDraw: 0, visible: false, resize };

    function resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const sh = section.clientHeight;
      if (!w || !h || !sh) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Globe radius in px: big on desktop, fits the width on phones.
      const radiusPx = Math.min(sh * 0.4, w * 0.42, 380);
      const tanHalf = Math.tan((FOV * Math.PI) / 360);
      camera.position.set(0, 0, (R * h) / (2 * tanHalf * radiusPx));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();

      // Phones: sections are tall and full of cards, so lift the globe up behind the heading
      // (centre ~200px below the section top) instead of hiding it in the middle.
      const centerFromTop = w < 700 ? 80 + 200 : h / 2; // canvas starts 80px above the section
      built.globe.position.y = ((h / 2 - centerFromTop) * R) / radiusPx;
    }

    resize();
    draw(view, 0);
    section.classList.add("globe-bg--3d");
    return view;
  }

  function draw(v, seconds) {
    const { globe, scene } = v.built;
    globe.rotation.y = (-FACE_LON * Math.PI) / 180 + seconds * SPIN_SPEED;
    v.renderer.render(scene, v.camera);
  }

  const views = sections.map(mount).filter(Boolean);
  if (!views.length) return;

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
