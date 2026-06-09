import React, { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  ContactShadows,
  Environment,
  Html,
  Sparkles,
  Float,
  Billboard,
  Text,
} from "@react-three/drei";
import * as THREE from "three";
import type { Warehouse3DCell } from "@/pages/Warehouse3D";

const SCALE = 0.012;
const RACK_H = 2.6;
const POST = 0.045;
const PIN_LEN = 0.42;

/** Бирка с кодом ячейки над стеллажом (не перекрывает корпус). */
function RackLabel({
  cell,
  palette,
  active,
  rackWidth,
}: {
  cell: Warehouse3DCell;
  palette: ReturnType<typeof statusPalette>;
  active: boolean;
  rackWidth: number;
}) {
  const pinTop = RACK_H / 2;
  const labelY = pinTop + PIN_LEN + 0.06;
  const plateW = Math.min(1.05, Math.max(0.55, rackWidth * 1.1));
  const plateH = active ? 0.28 : 0.2;

  return (
    <group>
      <mesh position={[0, pinTop + PIN_LEN / 2, 0]}>
        <cylinderGeometry args={[0.009, 0.009, PIN_LEN, 6]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={active ? 0.85 : 0.4} />
      </mesh>
      <mesh position={[0, pinTop, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color={palette.accent} />
      </mesh>

      <Billboard position={[0, labelY, 0]}>
        <mesh position={[0, -plateH / 2 + 0.02, -0.02]} renderOrder={10}>
          <planeGeometry args={[plateW, plateH]} />
          <meshBasicMaterial
            color="#0f172a"
            transparent
            opacity={active ? 0.92 : 0.78}
            depthTest={false}
          />
        </mesh>
        <mesh position={[0, -plateH / 2 + 0.02, -0.03]} renderOrder={9}>
          <planeGeometry args={[plateW + 0.02, plateH + 0.02]} />
          <meshBasicMaterial color={palette.accent} transparent opacity={0.55} depthTest={false} />
        </mesh>

        <Text
          position={[0, active ? 0.04 : 0.02, 0.01]}
          fontSize={active ? 0.11 : 0.095}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor="#020617"
          maxWidth={plateW - 0.08}
          renderOrder={11}
        >
          {cell.cell}
        </Text>

        {active && (
          <Text
            position={[0, -0.07, 0.01]}
            fontSize={0.055}
            color="#94a3b8"
            anchorX="center"
            anchorY="middle"
            maxWidth={plateW - 0.06}
            renderOrder={11}
          >
            {cell.productCount > 0
              ? `${cell.productCount} поз · ${cell.totalQty} ед`
              : "пусто"}
          </Text>
        )}
      </Billboard>
    </group>
  );
}

function cellPos(cell: Warehouse3DCell) {
  return {
    x: cell.posX * SCALE - 4,
    z: cell.posY * SCALE - 3,
  };
}

function statusPalette(cell: Warehouse3DCell) {
  if (cell.productCount === 0 && cell.totalQty === 0) {
    return {
      accent: "#64748b",
      glow: "#94a3b8",
      fill: "#1e293b",
      label: "Пустая",
    };
  }
  if (cell.hasExpiryAlert) {
    return {
      accent: "#f87171",
      glow: "#ef4444",
      fill: "#7f1d1d",
      label: "Срок годности",
    };
  }
  if (cell.totalQty < 5) {
    return {
      accent: "#fbbf24",
      glow: "#f59e0b",
      fill: "#78350f",
      label: "Мало остатка",
    };
  }
  const base = cell.zoneColor || "#14b8a6";
  return {
    accent: base,
    glow: "#2dd4bf",
    fill: "#134e4a",
    label: "В норме",
  };
}

/** Металлический стеллаж с паллетами */
function WarehouseRack({
  cell,
  selected,
  onSelect,
}: {
  cell: Warehouse3DCell;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);

  const { x, z } = cellPos(cell);
  const w = Math.max(cell.width * SCALE, 0.55);
  const d = Math.max(cell.height * SCALE, 0.45);
  const palette = statusPalette(cell);

  const isEmpty = cell.productCount === 0 && cell.totalQty === 0;
  const load = Math.max(cell.totalQty, cell.productCount, 0);
  const palletCount = isEmpty
    ? 0
    : Math.min(12, Math.max(1, Math.ceil(Math.log10(load + 1) * 4)));
  const shelfLevels = 3;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const target = hovered || selected ? 1.06 : 1;
    groupRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.12);

    if (glowRef.current && cell.hasExpiryAlert) {
      glowRef.current.emissiveIntensity =
        0.25 + Math.sin(clock.elapsedTime * 4) * 0.18;
    }
  });

  const pallets = useMemo(() => {
    const items: { sx: number; sy: number; sz: number; color: string }[] = [];
    const cols = Math.ceil(Math.sqrt(palletCount));
    const rows = Math.ceil(palletCount / cols);
    let n = 0;
    for (let level = 0; level < shelfLevels && n < palletCount; level++) {
      for (let r = 0; r < rows && n < palletCount; r++) {
        for (let c = 0; c < cols && n < palletCount; c++) {
          const px = (c - (cols - 1) / 2) * (w * 0.22);
          const pz = (r - (rows - 1) / 2) * (d * 0.22);
          const sy = 0.14 + (level + 1) * (RACK_H / (shelfLevels + 1)) - RACK_H / 2;
          const hue = (n * 47 + cell.cell.charCodeAt(0) * 3) % 360;
          items.push({
            sx: px,
            sy,
            sz: pz,
            color: cell.hasExpiryAlert
              ? "#fca5a5"
              : `hsl(${hue}, 55%, ${48 + (n % 3) * 8}%)`,
          });
          n++;
        }
      }
    }
    return items;
  }, [palletCount, w, d, cell.cell, cell.hasExpiryAlert, shelfLevels]);

  const postPositions: [number, number, number][] = [
    [-w / 2 + POST, 0, -d / 2 + POST],
    [w / 2 - POST, 0, -d / 2 + POST],
    [-w / 2 + POST, 0, d / 2 - POST],
    [w / 2 - POST, 0, d / 2 - POST],
  ];

  return (
    <group
      ref={groupRef}
      position={[x, RACK_H / 2, z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(cell.key);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {/* Вертикальные стойки */}
      {postPositions.map((p, i) => (
        <mesh key={`post-${i}`} position={[p[0], 0, p[2]]} castShadow>
          <boxGeometry args={[POST, RACK_H, POST]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.92} roughness={0.18} />
        </mesh>
      ))}

      {/* Полки */}
      {Array.from({ length: shelfLevels }).map((_, i) => {
        const y = -RACK_H / 2 + ((i + 1) / (shelfLevels + 1)) * RACK_H;
        return (
          <mesh key={`shelf-${i}`} position={[0, y, 0]} castShadow receiveShadow>
            <boxGeometry args={[w - POST * 2, 0.035, d - POST * 2]} />
            <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.35} />
          </mesh>
        );
      })}

      {/* Задняя стенка стеллажа */}
      <mesh position={[0, 0, -d / 2 + 0.02]} receiveShadow>
        <boxGeometry args={[w - POST, RACK_H * 0.92, 0.02]} />
        <meshStandardMaterial
          color={palette.fill}
          transparent
          opacity={0.35}
          metalness={0.2}
          roughness={0.8}
        />
      </mesh>

      {/* Паллеты / короба */}
      {pallets.map((p, i) => (
        <mesh key={`box-${i}`} position={[p.sx, p.sy, p.sz]} castShadow>
          <boxGeometry args={[w * 0.18, 0.22, d * 0.18]} />
          <meshStandardMaterial
            color={p.color}
            roughness={0.55}
            metalness={0.08}
            emissive={selected ? palette.glow : "#000000"}
            emissiveIntensity={selected ? 0.15 : 0}
          />
        </mesh>
      ))}

      {/* Подсветка основания */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -RACK_H / 2 + 0.02, 0]}>
        <ringGeometry args={[w * 0.35, w * 0.55, 32]} />
        <meshBasicMaterial
          color={palette.glow}
          transparent
          opacity={selected ? 0.55 : hovered ? 0.35 : 0.12}
        />
      </mesh>

      {/* Пульсирующая рамка при выборе */}
      {selected && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[w + 0.08, RACK_H + 0.08, d + 0.08]} />
          <meshStandardMaterial
            ref={glowRef}
            color={palette.accent}
            transparent
            opacity={0.12}
            emissive={palette.glow}
            emissiveIntensity={0.35}
            wireframe
          />
        </mesh>
      )}

      <RackLabel
        cell={cell}
        palette={palette}
        active={hovered || selected}
        rackWidth={w}
      />
    </group>
  );
}

function WarehouseFloor({
  bounds,
  size,
  onClear,
}: {
  bounds: { cx: number; cz: number };
  size: number;
  onClear: () => void;
}) {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[bounds.cx, 0, bounds.cz]}
        receiveShadow
        onClick={onClear}
      >
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#1e293b" roughness={0.92} metalness={0.05} />
      </mesh>
      {/* Разметка проезда */}
      {[-1, 0, 1].map((i) => (
        <mesh
          key={`lane-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[bounds.cx + i * 3.5, 0.008, bounds.cz]}
        >
          <planeGeometry args={[0.12, size * 0.85]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function CeilingLights({ bounds }: { bounds: { cx: number; cz: number } }) {
  const positions: [number, number, number][] = [
    [bounds.cx - 4, 4.2, bounds.cz - 3],
    [bounds.cx + 4, 4.2, bounds.cz - 3],
    [bounds.cx - 4, 4.2, bounds.cz + 3],
    [bounds.cx + 4, 4.2, bounds.cz + 3],
    [bounds.cx, 4.2, bounds.cz],
  ];

  return (
    <>
      {positions.map((pos, i) => (
        <group key={`light-${i}`} position={pos}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.08, 16]} />
            <meshStandardMaterial
              color="#fef3c7"
              emissive="#fde68a"
              emissiveIntensity={1.2}
            />
          </mesh>
          <spotLight
            position={[0, -0.2, 0]}
            angle={0.55}
            penumbra={0.8}
            intensity={28}
            castShadow
            shadow-mapSize={[512, 512]}
            color="#fff7ed"
          />
        </group>
      ))}
      <pointLight position={[bounds.cx, 5, bounds.cz]} intensity={12} color="#bae6fd" />
    </>
  );
}

function SceneContent({
  cells,
  selectedKey,
  onSelect,
}: {
  cells: Warehouse3DCell[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const bounds = useMemo(() => {
    if (!cells.length) return { cx: 0, cz: 0, span: 14 };
    const xs = cells.map((c) => cellPos(c).x);
    const zs = cells.map((c) => cellPos(c).z);
    const span = Math.max(
      14,
      Math.max(...xs) - Math.min(...xs) + 6,
      Math.max(...zs) - Math.min(...zs) + 6
    );
    return {
      cx: (Math.min(...xs) + Math.max(...xs)) / 2,
      cz: (Math.min(...zs) + Math.max(...zs)) / 2,
      span,
    };
  }, [cells]);

  const zones = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cells) {
      map.set(c.location, (map.get(c.location) ?? 0) + 1);
    }
    return [...map.entries()];
  }, [cells]);

  return (
    <>
      <fog attach="fog" args={["#0c1222", 18, 42]} />
      <color attach="background" args={["#0c1222"]} />

      <ambientLight intensity={0.22} color="#cbd5e1" />
      <directionalLight
        position={[10, 18, 8]}
        intensity={0.55}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={40}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        color="#e0f2fe"
      />

      <Environment preset="city" environmentIntensity={0.45} />
      <CeilingLights bounds={bounds} />

      <Sparkles
        count={55}
        scale={[bounds.span, 4, bounds.span]}
        position={[bounds.cx, 2.5, bounds.cz]}
        size={1.2}
        speed={0.18}
        opacity={0.22}
        color="#67e8f9"
      />

      <WarehouseFloor
        bounds={bounds}
        size={bounds.span + 4}
        onClear={() => onSelect(null)}
      />

      <ContactShadows
        position={[bounds.cx, 0.001, bounds.cz]}
        opacity={0.45}
        scale={bounds.span + 2}
        blur={2.2}
        far={8}
        color="#020617"
      />

      {/* Подписи зон — у центра группы ячеек зоны */}
      {zones.map(([zone, count]) => {
        const zoneCells = cells.filter((c) => c.location === zone);
        if (!zoneCells.length) return null;
        const xs = zoneCells.map((c) => cellPos(c).x);
        const zs = zoneCells.map((c) => cellPos(c).z);
        const zx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const zz = Math.min(...zs) - 1.2;
        return (
          <Float key={zone} speed={1.2} floatIntensity={0.08} rotationIntensity={0}>
            <Html
              position={[zx, 0.08, zz]}
              center
              distanceFactor={28}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              <div className="rounded-md border border-cyan-500/35 bg-cyan-950/75 px-2 py-0.5 text-center shadow-md whitespace-nowrap">
                <p className="text-[9px] font-semibold text-cyan-100 leading-tight">{zone}</p>
                <p className="text-[8px] text-cyan-400/90 leading-tight">{count} яч.</p>
              </div>
            </Html>
          </Float>
        );
      })}

      {cells.map((cell) => (
        <WarehouseRack
          key={cell.key}
          cell={cell}
          selected={selectedKey === cell.key}
          onSelect={onSelect}
        />
      ))}

      <OrbitControls
        makeDefault
        target={[bounds.cx, 1.1, bounds.cz]}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={4}
        maxDistance={bounds.span * 1.4}
        enableDamping
        dampingFactor={0.06}
        autoRotate={!selectedKey}
        autoRotateSpeed={0.35}
      />
    </>
  );
}

export function Warehouse3DScene({
  cells,
  selectedKey,
  onSelect,
  onWebglLost,
}: {
  cells: Warehouse3DCell[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onWebglLost?: () => void;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.25]}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      camera={{ position: [8, 6.5, 10], fov: 42, near: 0.1, far: 100 }}
      onCreated={({ gl }) => {
        const canvas = gl.domElement;
        const onLost = (e: Event) => {
          e.preventDefault();
          onWebglLost?.();
        };
        canvas.addEventListener("webglcontextlost", onLost, false);
      }}
    >
      <SceneContent cells={cells} selectedKey={selectedKey} onSelect={onSelect} />
    </Canvas>
  );
}
