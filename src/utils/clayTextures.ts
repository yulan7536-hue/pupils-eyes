import * as THREE from 'three';

/**
 * 纯代码程序化生成定格动画（Stop-Motion / Claymation）手捏黏土纹理
 * 包括：手搓陶土底色、指纹按压纹路 (Fingerprints) 以及起伏法线贴图
 */

// 1. 生成带有大理石揉泥纹理与颗粒感的黏土漫反射贴图 (Albedo Map)
export function createClayAlbedoTexture(width = 1024, height = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // 基础抹茶绿黏土地色
    ctx.fillStyle = '#6E9277';
    ctx.fillRect(0, 0, width, height);

    // 揉入浅色软陶泥条纹（模拟两块不同深浅黏土揉捏在一起的效果）
    for (let i = 0; i < 45; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(155, 191, 163, 0.22)' : 'rgba(82, 121, 111, 0.25)';
      ctx.beginPath();
      const sx = Math.random() * width;
      const sy = Math.random() * height;
      const r = 25 + Math.random() * 90;
      ctx.ellipse(sx, sy, r * 2.2, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // 手工纸浆与微小纤维杂色点
    ctx.fillStyle = 'rgba(250, 247, 238, 0.12)';
    for (let i = 0; i < 800; i++) {
      const px = Math.random() * width;
      const py = Math.random() * height;
      ctx.fillRect(px, py, 1.5, 1.5);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// 2. 生成手指指纹 (Fingerprints) 与按压凹凸法线贴图 (Normal Map)
export function createClayNormalTexture(width = 512, height = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // 法线贴图基准平面色 (RGB: 128, 128, 255)
    ctx.fillStyle = '#8080FF';
    ctx.fillRect(0, 0, width, height);

    // 随机绘制多个手捏指纹螺旋圈 (Fingerprint Whorls)
    const drawFingerprint = (cx: number, cy: number, radius: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((Math.random() - 0.5) * Math.PI);

      const rings = Math.floor(radius / 7);
      for (let r = 5; r < radius; r += 7) {
        ctx.strokeStyle = (r % 14 === 0) ? 'rgba(160, 100, 255, 0.45)' : 'rgba(96, 155, 255, 0.45)';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        // 稍带椭圆和波动的指纹圈
        for (let a = 0; a <= Math.PI * 2; a += 0.2) {
          const wobble = Math.sin(a * 5) * 1.5;
          const px = Math.cos(a) * (r * 1.4 + wobble);
          const py = Math.sin(a) * (r * 0.9 + wobble);
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    };

    // 分布多个手捏按压处
    drawFingerprint(120, 140, 80);
    drawFingerprint(380, 160, 95);
    drawFingerprint(260, 360, 85);
    drawFingerprint(430, 410, 75);
    drawFingerprint(70, 420, 65);

    // 黏土微小凹坑按压杂色 (Thumb indents)
    for (let k = 0; k < 60; k++) {
      const rx = Math.random() * width;
      const ry = Math.random() * height;
      const rad = 6 + Math.random() * 18;
      const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, rad);
      grad.addColorStop(0, 'rgba(100, 100, 255, 0.4)');
      grad.addColorStop(1, 'rgba(128, 128, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// 3. 构建手捏黏土小树 (Procedural Clay Tree Group)
export function createClayTree(scale = 0.12): THREE.Group {
  const treeGroup = new THREE.Group();

  // 弯曲的棕色黏土树干 (用微变形的圆柱体拼接)
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x5C3E29, // 烘焙陶土棕
    roughness: 0.9,
    metalness: 0.05,
  });

  const trunkGeom = new THREE.CylinderGeometry(0.18, 0.28, 1.2, 10);
  const trunkMesh = new THREE.Mesh(trunkGeom, trunkMat);
  trunkMesh.position.y = 0.6;
  trunkMesh.rotation.z = (Math.random() - 0.5) * 0.12;
  treeGroup.add(trunkMesh);

  // 3 层叠捏的黏土树冠块 (一瓣一瓣捏出来的软陶球)
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x477051, // 深春草绿泥
    roughness: 0.85,
    metalness: 0.02,
  });

  const cluster1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 1), leafMat);
  cluster1.position.set(0, 1.2, 0);
  treeGroup.add(cluster1);

  const cluster2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 1), leafMat);
  cluster2.position.set(0.2, 1.6, 0.1);
  treeGroup.add(cluster2);

  const cluster3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 1), leafMat);
  cluster3.position.set(-0.15, 1.85, -0.05);
  treeGroup.add(cluster3);

  treeGroup.scale.set(scale, scale, scale);
  return treeGroup;
}

// 4. 构建手捏小山峦 (Clay Mountain Peak)
export function createClayMountain(scale = 0.16): THREE.Group {
  const mountainGroup = new THREE.Group();

  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x8C7A65, // 岩石黄泥
    roughness: 0.92,
    metalness: 0.04,
  });

  // 主峰与小侧峰
  const peakGeom = new THREE.ConeGeometry(0.7, 1.1, 7);
  const mainPeak = new THREE.Mesh(peakGeom, mountainMat);
  mainPeak.position.y = 0.55;
  mountainGroup.add(mainPeak);

  const sidePeak = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.75, 6), mountainMat);
  sidePeak.position.set(0.4, 0.35, 0.2);
  mountainGroup.add(sidePeak);

  // 山顶按压白泥雪顶 (Clay Snow Cap)
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xFAF7EE,
    roughness: 0.8,
  });
  const snowCap = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.35, 7), snowMat);
  snowCap.position.y = 0.95;
  mountainGroup.add(snowCap);

  mountainGroup.scale.set(scale, scale, scale);
  return mountainGroup;
}

// 5. 构建《小王子》B612 小行星与玻璃罩小玫瑰 (Clay Asteroid B612)
export function createLittlePrinceB612(): THREE.Group {
  const asteroid = new THREE.Group();

  // 凹凸不平的坑洞小行星主体
  const bodyGeom = new THREE.DodecahedronGeometry(0.38, 2);
  const pos = bodyGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const bump = Math.sin(vx * 8) * Math.cos(vy * 8) * 0.04;
    pos.setXYZ(i, (vx / len) * (0.38 + bump), (vy / len) * (0.38 + bump), (vz / len) * (0.38 + bump));
  }
  bodyGeom.computeVertexNormals();

  const asteroidMat = new THREE.MeshStandardMaterial({
    color: 0xDECDBB, // 暖砂黄小行星陶土
    roughness: 0.9,
    metalness: 0.05,
  });
  const bodyMesh = new THREE.Mesh(bodyGeom, asteroidMat);
  asteroid.add(bodyMesh);

  // 标志性红陶玫瑰 (Red Clay Rose)
  const roseMat = new THREE.MeshStandardMaterial({
    color: 0xD64545, // 玫瑰红陶
    roughness: 0.75,
  });
  const rose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), roseMat);
  rose.position.set(0, 0.44, 0);
  asteroid.add(rose);

  // 玫瑰绿枝
  const stemMat = new THREE.MeshBasicMaterial({ color: 0x2D4A34 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.08, 6), stemMat);
  stem.position.set(0, 0.40, 0);
  asteroid.add(stem);

  // 玻璃防护罩 (Glass Dome)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xFFFFFF,
    transparent: true,
    opacity: 0.35,
    roughness: 0.1,
    transmission: 0.7,
    thickness: 0.05,
    depthWrite: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.65), glassMat);
  dome.position.set(0, 0.42, 0);
  asteroid.add(dome);

  // 旁边一棵细小的嫩芽猴面包树 (Baobab shoot)
  const shoot = createClayTree(0.05);
  shoot.position.set(0.24, 0.28, 0.12);
  shoot.rotation.z = -0.5;
  asteroid.add(shoot);

  return asteroid;
}
