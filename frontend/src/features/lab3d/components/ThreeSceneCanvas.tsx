import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Lab3DCameraPreset, Lab3DModelId, TectonicBoundaryMode } from "../types";

function createProceduralEarthTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Đại dương với sắc độ độ sâu địa lí
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#e0f2fe");
  grad.addColorStop(0.08, "#0284c7");
  grad.addColorStop(0.28, "#0369a1");
  grad.addColorStop(0.5, "#075985");
  grad.addColorStop(0.72, "#0369a1");
  grad.addColorStop(0.92, "#0284c7");
  grad.addColorStop(1, "#f0f9ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Dải băng Cực Bắc & Châu Nam Cực
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, 1024, 24);
  ctx.fillRect(0, 482, 1024, 30);

  // Hàm vẽ mảng lục địa đa giác mềm
  const drawPolygon = (points: [number, number][], fill: string, stroke?: string) => {
    ctx.beginPath();
    points.forEach(([x, y], idx) => {
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  // Bắc Mỹ
  drawPolygon(
    [
      [130, 75],
      [255, 65],
      [300, 125],
      [260, 195],
      [215, 225],
      [175, 195],
      [120, 130],
    ],
    "#16a34a",
    "#86efac",
  );
  // Nam Mỹ
  drawPolygon(
    [
      [255, 240],
      [325, 255],
      [365, 310],
      [335, 395],
      [295, 445],
      [275, 375],
      [250, 290],
    ],
    "#15803d",
    "#4ade80",
  );
  // Châu Phi
  drawPolygon(
    [
      [485, 175],
      [585, 180],
      [635, 245],
      [605, 345],
      [565, 405],
      [525, 355],
      [475, 255],
    ],
    "#ca8a04",
    "#fde047",
  );
  // Đại lục Á - Âu (Eurasia)
  drawPolygon(
    [
      [495, 70],
      [645, 55],
      [845, 75],
      [895, 135],
      [835, 205],
      [785, 235],
      [715, 215],
      [645, 185],
      [545, 160],
      [485, 135],
    ],
    "#16a34a",
    "#86efac",
  );
  // Bán đảo Đông Dương & hình chữ S Việt Nam (~105°Đ–109°Đ, 8°B–23°B)
  drawPolygon(
    [
      [792, 188],
      [818, 192],
      [826, 212],
      [816, 236],
      [798, 228],
    ],
    "#dc2626",
    "#fef08a",
  );
  // Châu Úc (Australia)
  drawPolygon(
    [
      [805, 315],
      [895, 315],
      [915, 365],
      [865, 405],
      [795, 375],
    ],
    "#d97706",
    "#fcd34d",
  );

  // Lưới kinh vĩ tuyến chuẩn Địa lí 10
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1;
  for (let lon = 1; lon < 12; lon++) {
    const x = (lon * 1024) / 12;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  // Đường Xích đạo (0°)
  ctx.strokeStyle = "rgba(253, 224, 71, 0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(1024, 256);
  ctx.stroke();

  // Chí tuyến Bắc & Chí tuyến Nam (23°27')
  ctx.setLineDash([10, 6]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 190);
  ctx.lineTo(1024, 190);
  ctx.moveTo(0, 322);
  ctx.lineTo(1024, 322);
  ctx.stroke();
  ctx.setLineDash([]);

  // Mốc tâm điểm Việt Nam (GMT+7)
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(812, 210, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fef08a";
  ctx.lineWidth = 3;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function assignHotspotToObject(obj: THREE.Object3D, hotspotId: string) {
  obj.userData.hotspotId = hotspotId;
  obj.traverse((child) => {
    child.userData.hotspotId = hotspotId;
  });
}

export function ThreeSceneCanvas({
  modelId,
  activeHotspotId,
  onSelectHotspot,
  isPaused,
  speed,
  explodeFactor,
  tectonicMode,
  showGridLines,
  cameraPreset,
  resetCounter,
  onWebGLError,
}: {
  modelId: Lab3DModelId;
  activeHotspotId: string;
  onSelectHotspot?: (hotspotId: string) => void;
  isPaused: boolean;
  speed: number;
  explodeFactor: number;
  tectonicMode: TectonicBoundaryMode;
  showGridLines: boolean;
  cameraPreset?: Lab3DCameraPreset | null;
  resetCounter: number;
  onWebGLError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);

  const controlsStateRef = useRef({
    isPaused,
    speed,
    explodeFactor,
    tectonicMode,
    activeHotspotId,
    showGridLines,
    onSelectHotspot,
  });
  controlsStateRef.current = {
    isPaused,
    speed,
    explodeFactor,
    tectonicMode,
    activeHotspotId,
    showGridLines,
    onSelectHotspot,
  };

  const cameraSphericalRef = useRef({
    radius: 6.4,
    theta: 0.45,
    phi: 1.22,
  });

  useEffect(() => {
    cameraSphericalRef.current = {
      radius: modelId === "atmosphere-layers" ? 7.2 : 6.4,
      theta: 0.45,
      phi: 1.2,
    };
  }, [resetCounter, modelId]);

  useEffect(() => {
    if (!cameraPreset) return;
    cameraSphericalRef.current = {
      radius: cameraPreset.radius,
      theta: cameraPreset.theta,
      phi: cameraPreset.phi,
    };
  }, [cameraPreset]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      onWebGLError();
      return;
    }

    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 340);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x060c18, 1);

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);

    // Bầu trời sao nền vũ trụ
    const starPositions = new Float32Array(220 * 3);
    for (let i = 0; i < 220; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 34;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 24;
      starPositions[i * 3 + 2] = -6 - Math.random() * 14;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x94a3b8, size: 0.08 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const pickableObjects: THREE.Object3D[] = [];
    const registerPickable = (obj: THREE.Object3D, hotspotId: string) => {
      assignHotspotToObject(obj, hotspotId);
      pickableObjects.push(obj);
    };

    // Các tham chiếu phục vụ cập nhật động theo frame
    let earthSpinGroup: THREE.Group | null = null;
    let cloudMesh: THREE.Mesh | null = null;
    let gridRingGroup: THREE.Group | null = null;
    const layerMeshes: {
      id: string;
      group: THREE.Group;
      baseOffset: number;
      materials: THREE.MeshStandardMaterial[];
    }[] = [];
    let leftPlateGroup: THREE.Group | null = null;
    let rightPlateGroup: THREE.Group | null = null;
    let magmaPlumeGroup: THREE.Group | null = null;
    let riftRidgeMesh: THREE.Mesh | null = null;
    let faultRingMesh: THREE.Mesh | null = null;
    let satelliteGroup: THREE.Group | null = null;
    let meteorGroup: THREE.Group | null = null;
    let auroraMesh: THREE.Mesh | null = null;
    const atmosphereStrata: {
      id: string;
      mesh: THREE.Mesh;
      baseOpacity: number;
    }[] = [];

    if (modelId === "earth-rotation") {
      // Ánh sáng Mặt Trời chiếu song song từ bên phải (+X) tạo nửa cầu Sáng và nửa cầu Tối rõ rệt
      const ambient = new THREE.AmbientLight(0x1e293b, 0.38);
      scene.add(ambient);
      const sunLight = new THREE.DirectionalLight(0xfffbeb, 3.1);
      sunLight.position.set(10, 1.2, 1.5);
      scene.add(sunLight);

      // Quả cầu Mặt Trời & các tia sáng chiếu song song từ bên phải
      const sunGroup = new THREE.Group();
      const sunSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xfde047 }),
      );
      sunSphere.position.set(3.85, 0.25, 0);
      sunGroup.add(sunSphere);

      [-0.85, 0, 0.85].forEach((yOffset) => {
        const rayShaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, 1.35, 8),
          new THREE.MeshBasicMaterial({
            color: 0xfef08a,
            transparent: true,
            opacity: 0.65,
          }),
        );
        rayShaft.rotation.z = Math.PI / 2;
        rayShaft.position.set(2.85, yOffset, 0);
        sunGroup.add(rayShaft);
      });
      rootGroup.add(sunGroup);

      // Nhóm trục nghiêng 23°27' (23.44 độ)
      const tiltedGroup = new THREE.Group();
      tiltedGroup.rotation.z = -THREE.MathUtils.degToRad(23.44);
      rootGroup.add(tiltedGroup);

      earthSpinGroup = new THREE.Group();
      tiltedGroup.add(earthSpinGroup);

      const earthGeo = new THREE.SphereGeometry(1.78, 56, 42);
      const earthTex = createProceduralEarthTexture();
      const earthMat = new THREE.MeshStandardMaterial({
        map: earthTex ?? undefined,
        color: earthTex ? 0xffffff : 0x0284c7,
        roughness: 0.62,
        metalness: 0.06,
      });
      const earthMesh = new THREE.Mesh(earthGeo, earthMat);
      earthSpinGroup.add(earthMesh);

      // Lớp mây mỏng bán trong suốt
      const cloudGeo = new THREE.SphereGeometry(1.805, 40, 32);
      const cloudMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.14,
        roughness: 0.9,
      });
      cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
      earthSpinGroup.add(cloudMesh);

      // Ghim mốc tọa độ Việt Nam (16°B, 106°Đ) gắn trực tiếp trên bề mặt quả cầu
      const vnMarkerGroup = new THREE.Group();
      const latRad = THREE.MathUtils.degToRad(16);
      const lonRad = THREE.MathUtils.degToRad(106);
      const markerR = 1.82;
      vnMarkerGroup.position.set(
        -markerR * Math.cos(latRad) * Math.cos(lonRad),
        markerR * Math.sin(latRad),
        markerR * Math.cos(latRad) * Math.sin(lonRad),
      );
      const vnPinSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xef4444 }),
      );
      const vnHalo = new THREE.Mesh(
        new THREE.RingGeometry(0.13, 0.21, 20),
        new THREE.MeshBasicMaterial({ color: 0xfef08a, side: THREE.DoubleSide }),
      );
      vnHalo.lookAt(vnMarkerGroup.position.clone().multiplyScalar(2));
      vnMarkerGroup.add(vnPinSphere, vnHalo);
      earthSpinGroup.add(vnMarkerGroup);
      registerPickable(vnMarkerGroup, "vietnam-meridian");

      // Trục tự quay nghiêng 23°27' + Nón chỉ cực Bắc (N)
      const axisGroup = new THREE.Group();
      const axisRod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 4.6, 14),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
      );
      const northCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.28, 14),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
      );
      northCone.position.set(0, 2.38, 0);
      axisGroup.add(axisRod, northCone);
      tiltedGroup.add(axisGroup);
      registerPickable(axisGroup, "axis-tilt");

      // Vòng phân chia Sáng – Tối (Terminator) cố định vuông góc với tia sáng Mặt Trời
      const terminatorGroup = new THREE.Group();
      const termRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.84, 0.032, 16, 72),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
      );
      termRing.rotation.y = Math.PI / 2;
      terminatorGroup.add(termRing);
      rootGroup.add(terminatorGroup);
      registerPickable(terminatorGroup, "terminator-line");

      // Vòng Xích đạo (0°) & Mũi tên lệch hướng Coriolis
      gridRingGroup = new THREE.Group();
      const eqRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.82, 0.026, 14, 72),
        new THREE.MeshBasicMaterial({ color: 0x10b981 }),
      );
      eqRing.rotation.x = Math.PI / 2;
      gridRingGroup.add(eqRing);

      // Hai vòng Chí tuyến Bắc & Nam (23°27')
      [-0.71, 0.71].forEach((yPos) => {
        const tropicRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.63, 0.014, 10, 64),
          new THREE.MeshBasicMaterial({
            color: 0xa7f3d0,
            transparent: true,
            opacity: 0.65,
          }),
        );
        tropicRing.rotation.x = Math.PI / 2;
        tropicRing.position.y = yPos;
        gridRingGroup!.add(tropicRing);
      });

      tiltedGroup.add(gridRingGroup);
      registerPickable(gridRingGroup, "coriolis-equator");
    } else if (modelId === "earth-layers") {
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.45);
      dirLight.position.set(5, 6, 7);
      scene.add(dirLight);

      const layersSpec = [
        { id: "inner-core", radius: 0.52, color: 0xfef08a, emissive: 0xf59e0b, offset: 0.95 },
        { id: "outer-core", radius: 0.96, color: 0xfacc15, emissive: 0xd97706, offset: 0.68 },
        { id: "lower-mantle", radius: 1.42, color: 0xdc2626, emissive: 0x7f1d1d, offset: 0.44 },
        { id: "upper-mantle", radius: 1.74, color: 0xf97316, emissive: 0x9a3412, offset: 0.22 },
        { id: "crust", radius: 1.94, color: 0x0ea5e9, emissive: 0x0369a1, offset: 0.0 },
      ];

      layersSpec.forEach((spec) => {
        const layerGroup = new THREE.Group();
        const materials: THREE.MeshStandardMaterial[] = [];

        const shellGeo = new THREE.SphereGeometry(
          spec.radius,
          40,
          30,
          Math.PI * 0.25,
          Math.PI * 1.5,
        );
        const shellMat = new THREE.MeshStandardMaterial({
          color: spec.color,
          emissive: spec.emissive,
          emissiveIntensity: spec.id === "inner-core" ? 0.35 : 0.08,
          roughness: 0.42,
          side: THREE.DoubleSide,
        });
        materials.push(shellMat);
        const shellMesh = new THREE.Mesh(shellGeo, shellMat);
        layerGroup.add(shellMesh);

        // Hai mặt phẳng cắt dọc làm rõ độ dày từng lớp đồng tâm
        const capGeo = new THREE.CircleGeometry(spec.radius, 32, -Math.PI / 2, Math.PI);
        const capMat = new THREE.MeshStandardMaterial({
          color: spec.color,
          emissive: spec.emissive,
          emissiveIntensity: 0.12,
          roughness: 0.35,
          side: THREE.DoubleSide,
        });
        materials.push(capMat);
        const cap1 = new THREE.Mesh(capGeo, capMat);
        cap1.rotation.y = Math.PI * 0.25;
        const cap2 = new THREE.Mesh(capGeo, capMat);
        cap2.rotation.y = -Math.PI * 0.25;
        layerGroup.add(cap1, cap2);

        // Nếu là lớp Vỏ Trái Đất, bổ sung các mảng lục địa nổi màu xanh lá trên bề mặt
        if (spec.id === "crust") {
          const continentCap = new THREE.Mesh(
            new THREE.SphereGeometry(
              spec.radius + 0.02,
              28,
              20,
              Math.PI * 0.45,
              Math.PI * 0.85,
              Math.PI * 0.2,
              Math.PI * 0.55,
            ),
            new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.55 }),
          );
          layerGroup.add(continentCap);
        }

        rootGroup.add(layerGroup);
        registerPickable(layerGroup, spec.id);
        layerMeshes.push({
          id: spec.id,
          group: layerGroup,
          baseOffset: spec.offset,
          materials,
        });
      });
    } else if (modelId === "plate-tectonics") {
      scene.add(new THREE.AmbientLight(0xffffff, 0.82));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
      dirLight.position.set(4, 7, 5);
      scene.add(dirLight);

      // Quyển mềm Manti trên (Asthenosphere) cùng mũi tên đối lưu nhiệt
      const mantleGroup = new THREE.Group();
      const mantleMesh = new THREE.Mesh(
        new THREE.BoxGeometry(5.4, 1.15, 3.1),
        new THREE.MeshStandardMaterial({
          color: 0xc2410c,
          emissive: 0x7c2d12,
          emissiveIntensity: 0.25,
          roughness: 0.55,
        }),
      );
      mantleMesh.position.set(0, -1.05, 0);
      mantleGroup.add(mantleMesh);

      // Hai vòng dòng đối lưu Manti phía trước mặt cắt
      [-1.1, 1.1].forEach((xCenter) => {
        const convArc = new THREE.Mesh(
          new THREE.TorusGeometry(0.36, 0.045, 12, 32),
          new THREE.MeshBasicMaterial({ color: 0xfde047 }),
        );
        convArc.position.set(xCenter, -1.02, 1.58);
        mantleGroup.add(convArc);
      });
      rootGroup.add(mantleGroup);
      registerPickable(mantleGroup, "mantle-convection");

      // Mảng kiến tạo bên trái (Mảng đại dương nặng, mỏng hơn)
      leftPlateGroup = new THREE.Group();
      const leftCrust = new THREE.Mesh(
        new THREE.BoxGeometry(2.35, 0.44, 2.95),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 }),
      );
      const oceanLayer = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.22, 2.92),
        new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          transparent: true,
          opacity: 0.84,
        }),
      );
      oceanLayer.position.set(0, 0.32, 0);
      leftPlateGroup.add(leftCrust, oceanLayer);
      leftPlateGroup.position.set(-1.3, -0.22, 0);
      rootGroup.add(leftPlateGroup);
      registerPickable(leftPlateGroup, "subduction-zone");

      // Mảng kiến tạo bên phải (Mảng lục địa dày + Dãy núi uốn nếp & Cung núi lửa)
      rightPlateGroup = new THREE.Group();
      const rightCrust = new THREE.Mesh(
        new THREE.BoxGeometry(2.45, 0.68, 2.95),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 }),
      );
      rightPlateGroup.add(rightCrust);

      // Cung núi lửa lục địa (gồm núi lửa chính đang phun trào và 2 đỉnh núi phụ)
      const volcanoGroup = new THREE.Group();
      const mainVolcano = new THREE.Mesh(
        new THREE.ConeGeometry(0.68, 1.12, 28),
        new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.7 }),
      );
      mainVolcano.position.set(0.18, 0.86, 0);

      const sidePeak1 = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 0.78, 20),
        new THREE.MeshStandardMaterial({ color: 0x44403c }),
      );
      sidePeak1.position.set(-0.35, 0.68, -0.65);

      const sidePeak2 = new THREE.Mesh(
        new THREE.ConeGeometry(0.48, 0.84, 20),
        new THREE.MeshStandardMaterial({ color: 0x44403c }),
      );
      sidePeak2.position.set(0.55, 0.72, 0.68);

      const craterLava = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 18, 18),
        new THREE.MeshBasicMaterial({ color: 0xef4444 }),
      );
      craterLava.position.set(0.18, 1.38, 0);

      volcanoGroup.add(mainVolcano, sidePeak1, sidePeak2, craterLava);
      rightPlateGroup.add(volcanoGroup);
      rightPlateGroup.position.set(1.3, -0.08, 0);
      rootGroup.add(rightPlateGroup);
      registerPickable(volcanoGroup, "magma-volcano");

      // Cột buồng Magma dâng từ đới nóng chảy lên miệng núi lửa
      magmaPlumeGroup = new THREE.Group();
      const magmaColumn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.34, 1.75, 18),
        new THREE.MeshBasicMaterial({ color: 0xef4444 }),
      );
      magmaPlumeGroup.add(magmaColumn);
      magmaPlumeGroup.position.set(1.38, 0.15, 0);
      rootGroup.add(magmaPlumeGroup);
      registerPickable(magmaPlumeGroup, "magma-volcano");

      // Sống núi ngầm đại dương khi ở chế độ Phân kì (Tách giãn)
      riftRidgeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.55, 2.94),
        new THREE.MeshStandardMaterial({
          color: 0xea580c,
          emissive: 0xdc2626,
          emissiveIntensity: 0.6,
        }),
      );
      riftRidgeMesh.position.set(0, -0.35, 0);
      rootGroup.add(riftRidgeMesh);
      registerPickable(riftRidgeMesh, "mantle-convection");

      // Vòng sóng địa chấn tại tâm chấn đứt gãy (Transform fault / Subduction earthquake)
      faultRingMesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.04, 12, 40),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
      );
      faultRingMesh.rotation.x = Math.PI / 2;
      faultRingMesh.position.set(0, 0.28, 0);
      rootGroup.add(faultRingMesh);
      registerPickable(faultRingMesh, "transform-fault");
    } else if (modelId === "atmosphere-layers") {
      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.25);
      dirLight.position.set(4, 6, 6);
      scene.add(dirLight);

      // Địa hình bề mặt Trái Đất ở đáy cột khí quyển (đồng bằng, đại dương & đỉnh núi)
      const earthBaseGroup = new THREE.Group();
      const baseCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(2.15, 2.25, 0.42, 40),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 }),
      );
      baseCyl.position.set(0, -2.18, 0);
      const peak1 = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 0.48, 16),
        new THREE.MeshStandardMaterial({ color: 0x64748b }),
      );
      peak1.position.set(-0.75, -1.78, 0.45);
      earthBaseGroup.add(baseCyl, peak1);
      rootGroup.add(earthBaseGroup);

      const strataSpec = [
        { id: "troposphere", y: -1.45, h: 0.82, color: 0x38bdf8, opacity: 0.54 },
        { id: "stratosphere", y: -0.52, h: 0.82, color: 0x10b981, opacity: 0.48 },
        { id: "mesosphere", y: 0.42, h: 0.82, color: 0x3b82f6, opacity: 0.42 },
        { id: "thermosphere", y: 1.36, h: 0.82, color: 0xa855f7, opacity: 0.38 },
        { id: "exosphere", y: 2.28, h: 0.82, color: 0xf59e0b, opacity: 0.32 },
      ];

      strataSpec.forEach((s) => {
        const cylGeo = new THREE.CylinderGeometry(1.98, 1.98, s.h, 40);
        const cylMat = new THREE.MeshStandardMaterial({
          color: s.color,
          transparent: true,
          opacity: s.opacity,
          roughness: 0.3,
        });
        const mesh = new THREE.Mesh(cylGeo, cylMat);
        mesh.position.set(0, s.y, 0);
        rootGroup.add(mesh);
        registerPickable(mesh, s.id);
        atmosphereStrata.push({ id: s.id, mesh, baseOpacity: s.opacity });
      });

      // 1. Tầng đối lưu: Cụm mây đối lưu trắng
      const cloudCluster = new THREE.Group();
      [
        [-0.85, -1.38, 1.15, 0.22],
        [-0.65, -1.32, 1.2, 0.26],
        [0.75, -1.42, 1.05, 0.24],
      ].forEach(([cx, cy, cz, cr]) => {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(cr, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 }),
        );
        puff.position.set(cx, cy, cz);
        cloudCluster.add(puff);
      });
      rootGroup.add(cloudCluster);
      registerPickable(cloudCluster, "troposphere");

      // 2. Tầng bình lưu: Vòng Lớp Ôdôn (22–25 km) hấp thụ tia UV
      const ozoneRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.04, 0.06, 16, 64),
        new THREE.MeshBasicMaterial({ color: 0x34d399 }),
      );
      ozoneRing.rotation.x = Math.PI / 2;
      ozoneRing.position.set(0, -0.52, 0);
      rootGroup.add(ozoneRing);
      registerPickable(ozoneRing, "stratosphere");

      // 3. Tầng giữa: Sao băng (Thiên thạch bốc cháy)
      meteorGroup = new THREE.Group();
      const meteorHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xfef08a }),
      );
      const meteorTail = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.55, 12),
        new THREE.MeshBasicMaterial({
          color: 0xf97316,
          transparent: true,
          opacity: 0.85,
        }),
      );
      meteorTail.rotation.z = -Math.PI * 0.35;
      meteorTail.position.set(0.22, 0.16, 0);
      meteorGroup.add(meteorHead, meteorTail);
      meteorGroup.position.set(0.6, 0.42, 1.35);
      rootGroup.add(meteorGroup);
      registerPickable(meteorGroup, "mesosphere");

      // 4. Tầng nhiệt: Dải Cực quang (Aurora)
      auroraMesh = new THREE.Mesh(
        new THREE.TorusGeometry(1.55, 0.08, 12, 48, Math.PI * 1.15),
        new THREE.MeshBasicMaterial({
          color: 0xc084fc,
          transparent: true,
          opacity: 0.72,
        }),
      );
      auroraMesh.rotation.x = Math.PI * 0.48;
      auroraMesh.position.set(0, 1.38, 0);
      rootGroup.add(auroraMesh);
      registerPickable(auroraMesh, "thermosphere");

      // 5. Tầng ngoài: Vệ tinh nhân tạo quay trên quỹ đạo cao
      satelliteGroup = new THREE.Group();
      const satBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.24, 0.24),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.4 }),
      );
      const satWing = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.04, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x0284c7 }),
      );
      satBody.position.set(2.35, 2.3, 0);
      satWing.position.set(2.35, 2.3, 0);
      satelliteGroup.add(satBody, satWing);
      rootGroup.add(satelliteGroup);
      registerPickable(satelliteGroup, "exosphere");
    }

    // Raycaster chọn trực tiếp bộ phận 3D trên Canvas
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    const findHitHotspotId = (clientX: number, clientY: number): string | null => {
      const rect = domElem.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const intersects = raycaster.intersectObjects(pickableObjects, true);
      for (const hit of intersects) {
        let cur: THREE.Object3D | null = hit.object;
        while (cur) {
          if (typeof cur.userData?.hotspotId === "string") {
            return cur.userData.hotspotId;
          }
          cur = cur.parent;
        }
      }
      return null;
    };

    // Xử lý kéo chuột / cảm ứng xoay góc nhìn (Orbit), click chọn 3D (Raycast) và cuộn thu phóng
    let dragging = false;
    let downX = 0;
    let downY = 0;
    let prevX = 0;
    let prevY = 0;
    const domElem = renderer.domElement;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      downX = e.clientX;
      downY = e.clientY;
      prevX = e.clientX;
      prevY = e.clientY;
      domElem.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) {
        const hoveredId = findHitHotspotId(e.clientX, e.clientY);
        setHoveredHotspotId(hoveredId);
        domElem.style.cursor = hoveredId ? "pointer" : "grab";
        return;
      }
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;

      cameraSphericalRef.current.theta -= dx * 0.008;
      cameraSphericalRef.current.phi = Math.max(
        0.32,
        Math.min(Math.PI - 0.32, cameraSphericalRef.current.phi - dy * 0.008),
      );
    };

    const onPointerUp = (e: PointerEvent) => {
      const movedDist = Math.hypot(e.clientX - downX, e.clientY - downY);
      dragging = false;
      if (movedDist < 6) {
        const hitHotspot = findHitHotspotId(e.clientX, e.clientY);
        if (hitHotspot && controlsStateRef.current.onSelectHotspot) {
          controlsStateRef.current.onSelectHotspot(hitHotspot);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraSphericalRef.current.radius = Math.max(
        3.5,
        Math.min(10.5, cameraSphericalRef.current.radius + e.deltaY * 0.004),
      );
    };

    domElem.addEventListener("pointerdown", onPointerDown);
    domElem.addEventListener("pointermove", onPointerMove);
    domElem.addEventListener("pointerup", onPointerUp);
    domElem.addEventListener("pointercancel", onPointerUp);
    domElem.addEventListener("wheel", onWheel, { passive: false });

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 280);
      const h = Math.max(container.clientHeight, 320);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);
    window.addEventListener("resize", handleResize);

    let animFrameId = 0;
    let clockTime = 0;
    let lastTimestamp = performance.now();

    const animate = (now: number) => {
      animFrameId = window.requestAnimationFrame(animate);
      if (document.visibilityState === "hidden") {
        lastTimestamp = now;
        return;
      }

      const dt = Math.min((now - lastTimestamp) / 1000, 0.1);
      lastTimestamp = now;

      const ctrl = controlsStateRef.current;
      if (!ctrl.isPaused) {
        clockTime += dt * ctrl.speed;
      }

      const { radius, theta, phi } = cameraSphericalRef.current;
      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 0, 0);

      if (modelId === "earth-rotation") {
        if (earthSpinGroup && !ctrl.isPaused) {
          // Tự quay từ Tây sang Đông (ngược chiều kim đồng hồ nhìn từ cực Bắc xuống)
          earthSpinGroup.rotation.y += dt * 0.72 * ctrl.speed;
        }
        if (cloudMesh && !ctrl.isPaused) {
          cloudMesh.rotation.y += dt * 0.12 * ctrl.speed;
        }
        if (gridRingGroup) {
          gridRingGroup.visible = ctrl.showGridLines;
        }
      } else if (modelId === "earth-layers") {
        layerMeshes.forEach((item) => {
          const isSelected = item.id === ctrl.activeHotspotId;
          const shift = ctrl.explodeFactor * item.baseOffset * 1.38 + (isSelected ? 0.22 : 0);
          item.group.position.set(0, shift * 0.35, shift);
          item.materials.forEach((mat) => {
            mat.emissiveIntensity = isSelected
              ? 0.45 + 0.15 * Math.sin(clockTime * 4)
              : item.id === "inner-core"
                ? 0.3
                : 0.08;
          });
        });
      } else if (modelId === "plate-tectonics") {
        // Tiến trình một chiều (0 -> 1) phản ánh đúng cơ chế dịch chuyển một chiều của mảng kiến tạo
        const cycleProgress = (clockTime * 0.28) % 1;
        if (
          leftPlateGroup &&
          rightPlateGroup &&
          magmaPlumeGroup &&
          riftRidgeMesh &&
          faultRingMesh
        ) {
          if (ctrl.tectonicMode === "convergent") {
            // Hội tụ: Mảng đại dương bên trái tiến sang phải và chúi xuống dưới mảng lục địa
            leftPlateGroup.position.set(-1.38 + cycleProgress * 0.42, -0.26 - cycleProgress * 0.12, 0);
            leftPlateGroup.rotation.z = -0.18;
            rightPlateGroup.position.set(1.22, -0.05, 0);
            rightPlateGroup.position.z = 0;
            magmaPlumeGroup.visible = true;
            magmaPlumeGroup.position.set(1.42, 0.08 + cycleProgress * 0.45, 0);
            riftRidgeMesh.visible = false;
            faultRingMesh.visible = true;
            faultRingMesh.position.set(-0.05, -0.25, 0);
            faultRingMesh.scale.setScalar(0.6 + cycleProgress * 0.9);
          } else if (ctrl.tectonicMode === "divergent") {
            // Phân kì: Hai mảng tách xa nhau về hai phía từ sống núi ngầm giữa đại dương
            leftPlateGroup.position.set(-1.22 - cycleProgress * 0.52, -0.18, 0);
            leftPlateGroup.rotation.z = 0;
            rightPlateGroup.position.set(1.22 + cycleProgress * 0.52, -0.18, 0);
            rightPlateGroup.position.z = 0;
            magmaPlumeGroup.visible = true;
            magmaPlumeGroup.position.set(0, -0.45 + cycleProgress * 0.38, 0);
            riftRidgeMesh.visible = true;
            faultRingMesh.visible = false;
          } else {
            // Trượt ngang: Hai mảng trượt ngược chiều nhau theo phương ngang dọc đứt gãy, phát sóng địa chấn
            leftPlateGroup.position.set(-1.24, -0.18, -0.35 + cycleProgress * 0.7);
            leftPlateGroup.rotation.z = 0;
            rightPlateGroup.position.set(1.24, -0.18, 0.35 - cycleProgress * 0.7);
            magmaPlumeGroup.visible = false;
            riftRidgeMesh.visible = false;
            faultRingMesh.visible = true;
            faultRingMesh.position.set(0, 0.22, 0);
            faultRingMesh.scale.setScalar(0.5 + cycleProgress * 1.4);
          }
        }
      } else if (modelId === "atmosphere-layers") {
        if (satelliteGroup && !ctrl.isPaused) {
          satelliteGroup.rotation.y += dt * 0.9 * ctrl.speed;
        }
        if (meteorGroup && !ctrl.isPaused) {
          const mProg = (clockTime * 0.65) % 1;
          meteorGroup.position.set(0.95 - mProg * 1.4, 0.68 - mProg * 0.45, 1.35);
        }
        if (auroraMesh && !ctrl.isPaused) {
          auroraMesh.rotation.z = Math.sin(clockTime * 1.5) * 0.12;
        }
        atmosphereStrata.forEach((stratum) => {
          const mat = stratum.mesh.material as THREE.MeshStandardMaterial;
          const isSelected = stratum.id === ctrl.activeHotspotId;
          mat.opacity = isSelected ? 0.88 : stratum.baseOpacity;
          stratum.mesh.scale.setScalar(isSelected ? 1.05 : 1.0);
        });
      }

      renderer.render(scene, camera);
    };

    animFrameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animFrameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
      domElem.removeEventListener("pointerdown", onPointerDown);
      domElem.removeEventListener("pointermove", onPointerMove);
      domElem.removeEventListener("pointerup", onPointerUp);
      domElem.removeEventListener("pointercancel", onPointerUp);
      domElem.removeEventListener("wheel", onWheel);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material) {
            const mat = obj.material as THREE.MeshStandardMaterial;
            mat.map?.dispose();
            mat.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [modelId, onWebGLError]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        data-testid="lab3d-webgl-canvas"
        aria-label="Khung nhìn mô hình 3D tương tác — bấm trực tiếp vào bộ phận 3D để chọn, kéo để xoay, cuộn để thu phóng"
        className="h-[380px] w-full cursor-grab touch-none overflow-hidden rounded-2xl bg-[#060c18] active:cursor-grabbing sm:h-[460px]"
      />
      {hoveredHotspotId && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-emerald-400/50 bg-slate-900/85 px-3 py-1 text-xs font-extrabold text-emerald-300 shadow-lg">
          🎯 Bấm để xem chi tiết bộ phận đang trỏ trên mô hình 3D
        </div>
      )}
    </div>
  );
}
