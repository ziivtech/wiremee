// 3D bead double-helix behind the ".beads" sections.
// Two bead-covered tubes twist around each other (matching assets/img/beads-bg.webp)
// and each tube slowly rolls around its own axis. Falls back to the still image
// when WebGL is unavailable or the visitor prefers reduced motion.
(function beads3d() {
  if (!window.THREE) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const sections = Array.from(document.querySelectorAll(".beads"));
  if (!sections.length) return;

  // Scene units: the reference render is 16:9 and 10 units tall (1080px ≈ 10 units).
  const FRAME_H = 10;
  const FRAME_W = FRAME_H * (16 / 9);
  const FOV = 33;
  const ZOOM_OUT = 1;            // 1 = same size as the Figma render; raise to show the helix smaller

  const HELIX_R = 2.0;           // distance of each tube's centre from the shared axis
  const TWIST = Math.PI / 10;    // helix turn rate (rad per unit of height): half a turn over the frame
  const TUBE_R = 1.8;            // tube radius (to bead centres)
  // Bead layout. Strings are spaced tighter along the tube than around it, so they read lengthwise.
  // Phones get fewer, larger, lower-poly beads: they're only a few pixels wide there anyway.
  const DETAIL = {
    full:  { rows: 36, beadR: 0.158, step: 0.29, segs: [14, 10], fps: 60 },
    light: { rows: 24, beadR: 0.23,  step: 0.44, segs: [6, 4],   fps: 30 },
  };
  const ROW_TWIST = 0.12;        // rows spiral gently along the tube
  const ROLL_SPEED = 0.22;       // rad/s each tube rolls around its own axis

  const supportsWebGL = (() => {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) {
      return false;
    }
  })();
  if (!supportsWebGL) return;

  // Centre-line of tube k (0 or 1) at height y, plus its local frame.
  function frameAt(k, y) {
    const phi = TWIST * (FRAME_H / 2 - y) + k * Math.PI;
    const c = new THREE.Vector3(HELIX_R * Math.cos(phi), y, HELIX_R * Math.sin(phi));
    // d(centre)/dy, since dphi/dy = -TWIST
    const t = new THREE.Vector3(HELIX_R * TWIST * Math.sin(phi), 1, -HELIX_R * TWIST * Math.cos(phi)).normalize();
    const n = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi)); // radial, perpendicular to t
    const b = new THREE.Vector3().crossVectors(t, n).normalize();
    return { c, t, n, b, speed: Math.hypot(HELIX_R * TWIST, 1) };
  }

  // Bead stations along each tube (arc-length spaced), covering heights -yHalf..yHalf.
  const makeStations = (yHalf, step) => [0, 1].map((k) => {
    const list = [];
    let y = -yHalf;
    let s = 0;
    while (y <= yHalf) {
      const f = frameAt(k, y);
      list.push({ ...f, s });
      y += step / f.speed;
      s += step;
    }
    return list;
  });

  function buildScene(stations, d) {
    const scene = new THREE.Scene();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(-5, 6, 8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.18);
    fill.position.set(6, -3, 6);
    scene.add(fill);

    const beadGeo = new THREE.SphereGeometry(d.beadR, d.segs[0], d.segs[1]);
    const beadMat = new THREE.MeshStandardMaterial({ color: 0xe9e9e9, roughness: 0.75, metalness: 0 });

    // Darker core inside each tube reads as the shadowed gaps between beads.
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 1, metalness: 0 });

    const tubes = [0, 1].map((k) => {
      const pts = stations[k].filter((_, i) => i % 3 === 0).map((st) => st.c);
      const core = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(160, pts.length * 2), TUBE_R - d.beadR * 0.9, 48, false),
        coreMat
      );
      scene.add(core);

      const count = stations[k].length * d.rows;
      const mesh = new THREE.InstancedMesh(beadGeo, beadMat, count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      return { k, mesh };
    });

    return { scene, tubes, stations, rows: d.rows };
  }

  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();

  function placeBeads({ tubes, stations, rows }, roll) {
    tubes.forEach(({ k, mesh }) => {
      let i = 0;
      for (const st of stations[k]) {
        for (let r = 0; r < rows; r++) {
          const a = (r / rows) * Math.PI * 2 + ROW_TWIST * st.s + roll;
          const ca = Math.cos(a) * TUBE_R;
          const sa = Math.sin(a) * TUBE_R;
          pos.set(
            st.c.x + st.n.x * ca + st.b.x * sa,
            st.c.y + st.n.y * ca + st.b.y * sa,
            st.c.z + st.n.z * ca + st.b.z * sa
          );
          m4.makeTranslation(pos.x, pos.y, pos.z);
          mesh.setMatrixAt(i++, m4);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  function mount(section) {
    const canvas = document.createElement("canvas");
    canvas.className = "beads__canvas";
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

    const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 2000);
    const view = { section, renderer, camera, built: null, builtHalf: 0, detail: null, lastDraw: 0, resize, visible: false };

    function resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      // Scale by width so the helix keeps the same proportions as the 1440px design
      // (tall phone sections would otherwise blow the beads up).
      const viewH = (FRAME_W / (w / h)) * ZOOM_OUT;
      camera.aspect = w / h;
      camera.position.set(0, 0, viewH / 2 / Math.tan((FOV * Math.PI) / 360));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();

      // Tubes must run past the top and bottom of the canvas (perspective makes the near side taller).
      const yHalf = viewH * 0.6 + 2;
      const detail = w < 700 ? DETAIL.light : DETAIL.full;
      if (yHalf > view.builtHalf || detail !== view.detail) {
        if (view.built) view.built.scene.traverse((o) => o.geometry && o.geometry.dispose());
        view.built = buildScene(makeStations(yHalf, detail.step), detail);
        view.builtHalf = yHalf;
        view.detail = detail;
      }
    }

    resize();
    placeBeads(view.built, 0);
    renderer.render(view.built.scene, camera);
    section.classList.add("beads--3d");

    return view;
  }

  const views = sections.map(mount).filter(Boolean);
  if (!views.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const v = views.find((x) => x.section === e.target);
        if (v) v.visible = e.isIntersecting;
      });
    },
    { rootMargin: "100px" }
  );
  views.forEach((v) => io.observe(v.section));

  window.addEventListener("resize", () => views.forEach((v) => v.resize()));

  const start = performance.now();
  function tick(now) {
    const roll = ((now - start) / 1000) * ROLL_SPEED;
    views.forEach((v) => {
      if (!v.visible || now - v.lastDraw < 1000 / v.detail.fps - 2) return;
      v.lastDraw = now;
      placeBeads(v.built, roll);
      v.renderer.render(v.built.scene, v.camera);
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
