// 3D globe behind the ".globe-bg" sections: a natural-looking Earth (NASA-based textures from the
// three.js examples, in assets/img/earth) with drifting clouds and a soft atmosphere, turning slowly.
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

    return { scene, globe, cloudMesh };
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
    const { globe, scene, cloudMesh } = v.built;
    // Texture longitude 0 faces +x on three.js spheres, so -90° turns FACE_LON towards the camera.
    globe.rotation.y = (-(FACE_LON + 90) * Math.PI) / 180 + seconds * SPIN_SPEED;
    if (cloudMesh) cloudMesh.rotation.y = seconds * CLOUD_DRIFT;
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
