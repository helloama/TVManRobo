import fs from "fs";
import path from "path";

const FBX_DIR = "D:/TVRoboPhetta/public/models/animations";

class FBXBinaryReader {
  constructor(buffer) { this.buf = buffer; this.pos = 0; }
  readUint8()  { const v = this.buf.readUInt8(this.pos); this.pos += 1; return v; }
  readUint32() { const v = this.buf.readUInt32LE(this.pos); this.pos += 4; return v; }
  readInt16()  { const v = this.buf.readInt16LE(this.pos); this.pos += 2; return v; }
  readInt32()  { const v = this.buf.readInt32LE(this.pos); this.pos += 4; return v; }
  readInt64()  { const lo = this.buf.readUInt32LE(this.pos); const hi = this.buf.readInt32LE(this.pos + 4); this.pos += 8; return lo + hi * 0x100000000; }
  readFloat32() { const v = this.buf.readFloatLE(this.pos); this.pos += 4; return v; }
  readFloat64() { const v = this.buf.readDoubleLE(this.pos); this.pos += 8; return v; }
  readString(len) { const s = this.buf.toString("utf8", this.pos, this.pos + len); this.pos += len; return s; }
  readBytes(len)  { const b = this.buf.slice(this.pos, this.pos + len); this.pos += len; return b; }
  seek(pos) { this.pos = pos; }
}
function readProperty(reader) {
  const typeCode = String.fromCharCode(reader.readUint8());
  switch (typeCode) {
    case "Y": return reader.readInt16();
    case "C": return reader.readUint8() !== 0;
    case "I": return reader.readInt32();
    case "F": return reader.readFloat32();
    case "D": return reader.readFloat64();
    case "L": return reader.readInt64();
    case "S": { const len = reader.readUint32(); return reader.readString(len); }
    case "R": { const len = reader.readUint32(); return reader.readBytes(len); }
    case "f": case "d": case "l": case "i": case "b": {
      const arrayLen = reader.readUint32();
      const encoding = reader.readUint32();
      const compLen = reader.readUint32();
      reader.pos += compLen;
      return "[Array: " + arrayLen + " elements]";
    }
    default: throw new Error("Unknown property type at pos " + (reader.pos - 1));
  }
}

function readNode(reader, version64) {
  let endOffset, numProperties, propertyListLen;
  if (version64) {
    endOffset = reader.readUint32() + reader.readUint32() * 0x100000000;
    numProperties = reader.readUint32() + reader.readUint32() * 0x100000000;
    propertyListLen = reader.readUint32() + reader.readUint32() * 0x100000000;
  } else {
    endOffset = reader.readUint32();
    numProperties = reader.readUint32();
    propertyListLen = reader.readUint32();
  }
  if (endOffset === 0) return null;
  const nameLen = reader.readUint8();
  const name = reader.readString(nameLen);
  const props = [];
  for (let i = 0; i < numProperties; i++) props.push(readProperty(reader));
  const children = [];
  if (reader.pos < endOffset) {
    while (reader.pos < endOffset) {
      const child = readNode(reader, version64);
      if (child === null) break;
      children.push(child);
    }
  }
  reader.seek(endOffset);
  return { name, props, children };
}
function parseFBX(filePath) {
  const buf = fs.readFileSync(filePath);
  const reader = new FBXBinaryReader(buf);
  const magic = reader.readString(21);
  if (!magic.startsWith("Kaydara FBX Binary")) throw new Error("Not a binary FBX file");
  reader.pos = 23;
  const version = reader.readUint32();
  const version64 = version >= 7500;
  const nodes = [];
  while (reader.pos < buf.length - 100) {
    try {
      const node = readNode(reader, version64);
      if (node === null) break;
      nodes.push(node);
    } catch (e) { break; }
  }
  return { version, nodes };
}

function extractInfo(fbxData) {
  const { version, nodes } = fbxData;
  const info = { version, bones: [], animStacks: [], animLayers: [], animCurveNodes: [], models: [], connections: [] };
  const objectsNode = nodes.find(n => n.name === "Objects");
  if (!objectsNode) return info;
  const connectionsNode = nodes.find(n => n.name === "Connections");
  if (connectionsNode) {
    for (const c of connectionsNode.children) {
      if (c.name === "C" && c.props.length >= 3) {
        info.connections.push({ type: c.props[0], child: c.props[1], parent: c.props[2], property: c.props[3] || null });
      }
    }
  }
  for (const child of objectsNode.children) {
    if (child.name === "Model") {
      const id = child.props[0];
      const fullName = child.props[1] || "";
      const type = child.props[2] || "";
      const nullIdx = fullName.indexOf(String.fromCharCode(0));
      const shortName = nullIdx >= 0 ? fullName.substring(0, nullIdx) : fullName;
      info.models.push({ id, name: shortName, type });
      if (type === "LimbNode" || type === "Null" || type === "Root") info.bones.push({ id, name: shortName, type });
    }
    if (child.name === "AnimationStack") {
      const id = child.props[0];
      const fullName = child.props[1] || "";
      const nullIdx = fullName.indexOf(String.fromCharCode(0));
      const shortName = nullIdx >= 0 ? fullName.substring(0, nullIdx) : fullName;
      info.animStacks.push({ id, name: shortName });
    }
    if (child.name === "AnimationLayer") {
      const id = child.props[0];
      const fullName = child.props[1] || "";
      const nullIdx = fullName.indexOf(String.fromCharCode(0));
      const shortName = nullIdx >= 0 ? fullName.substring(0, nullIdx) : fullName;
      info.animLayers.push({ id, name: shortName });
    }
    if (child.name === "AnimationCurveNode") {
      const id = child.props[0];
      const fullName = child.props[1] || "";
      const nullIdx = fullName.indexOf(String.fromCharCode(0));
      const shortName = nullIdx >= 0 ? fullName.substring(0, nullIdx) : fullName;
      info.animCurveNodes.push({ id, name: shortName });
    }
  }
  return info;
}
function buildAnimStructure(info) {
  const idMap = new Map();
  for (const m of info.models) idMap.set(m.id, { ...m, category: "Model" });
  for (const a of info.animStacks) idMap.set(a.id, { ...a, category: "AnimationStack" });
  for (const a of info.animLayers) idMap.set(a.id, { ...a, category: "AnimationLayer" });
  for (const a of info.animCurveNodes) idMap.set(a.id, { ...a, category: "AnimationCurveNode" });
  const childrenOf = new Map();
  for (const conn of info.connections) {
    if (!childrenOf.has(conn.parent)) childrenOf.set(conn.parent, []);
    childrenOf.get(conn.parent).push({ childId: conn.child, property: conn.property, type: conn.type });
  }
  const stacks = [];
  for (const stack of info.animStacks) {
    const stackChildren = childrenOf.get(stack.id) || [];
    const layers = [];
    for (const sc of stackChildren) {
      const layerObj = idMap.get(sc.childId);
      if (layerObj && layerObj.category === "AnimationLayer") {
        const layerChildren = childrenOf.get(sc.childId) || [];
        const curveNodes = [];
        for (const lc of layerChildren) {
          const cnObj = idMap.get(lc.childId);
          if (cnObj && cnObj.category === "AnimationCurveNode") {
            const targetConns = info.connections.filter(c => c.child === lc.childId && c.type === "OP");
            let targetBoneName = "unknown";
            let targetProperty = "unknown";
            for (const tc of targetConns) {
              const target = idMap.get(tc.parent);
              if (target && target.category === "Model") { targetBoneName = target.name; targetProperty = tc.property || "unknown"; }
            }
            curveNodes.push({ name: cnObj.name, targetBone: targetBoneName, property: targetProperty });
          }
        }
        layers.push({ name: layerObj.name, curveNodes });
      }
    }
    stacks.push({ name: stack.name, layers });
  }
  return stacks;
}
// ---- Main ----
const files = fs.readdirSync(FBX_DIR).filter(f => f.endsWith(".fbx"));
const primaryFile = "Rig_Medium_MovementBasic.fbx";
console.log("=".repeat(80));
console.log("DETAILED ANALYSIS: " + primaryFile);
console.log("=".repeat(80));
const fbxData = parseFBX(path.join(FBX_DIR, primaryFile));
console.log("FBX Version: " + fbxData.version);
const info = extractInfo(fbxData);

console.log("
" + "-".repeat(60));
console.log("ALL MODEL NODES");
console.log("-".repeat(60));
console.log("Total Model nodes: " + info.models.length);
for (const m of info.models) console.log("  " + m.name + " [type=" + m.type + "]");

console.log("
" + "-".repeat(60));
console.log("BONES (LimbNode/Null/Root types)");
console.log("-".repeat(60));
console.log("Total: " + info.bones.length);

const boneIds = new Set(info.bones.map(b => b.id));
const childBoneMap = new Map();
for (const conn of info.connections) {
  if (conn.type === "OO" && boneIds.has(conn.child) && boneIds.has(conn.parent)) {
    if (!childBoneMap.has(conn.parent)) childBoneMap.set(conn.parent, []);
    childBoneMap.get(conn.parent).push(conn.child);
  }
}
const parentMap = new Map();
for (const conn of info.connections) {
  if (conn.type === "OO" && boneIds.has(conn.child)) parentMap.set(conn.child, conn.parent);
}
const rootBones = info.bones.filter(b => !boneIds.has(parentMap.get(b.id)));
const boneById = new Map(info.bones.map(b => [b.id, b]));
function printBoneTree(boneId, indent) {
  const bone = boneById.get(boneId);
  if (!bone) return;
  console.log("  ".repeat(indent) + bone.name + " (" + bone.type + ")");
  const children = childBoneMap.get(boneId) || [];
  for (const cid of children) printBoneTree(cid, indent + 1);
}
console.log("
Bone hierarchy:");
for (const root of rootBones) printBoneTree(root.id, 1);
console.log("
" + "-".repeat(60));
console.log("ANIMATION STACKS (CLIPS)");
console.log("-".repeat(60));
console.log("Total animation stacks: " + info.animStacks.length);
for (let i = 0; i < info.animStacks.length; i++) console.log("  [" + i + "] "" + info.animStacks[i].name + """);
console.log("Total animation layers: " + info.animLayers.length);
console.log("Total animation curve nodes: " + info.animCurveNodes.length);

const animStructure = buildAnimStructure(info);
console.log("
" + "-".repeat(60));
console.log("SAMPLE TRACKS FROM FIRST CLIP");
console.log("-".repeat(60));
if (animStructure.length > 0) {
  const firstStack = animStructure[0];
  console.log("Stack: "" + firstStack.name + """);
  for (const layer of firstStack.layers) {
    console.log("  Layer: "" + layer.name + """);
    const sample = layer.curveNodes.slice(0, 30);
    console.log("  Tracks (showing " + sample.length + " of " + layer.curveNodes.length + "):");
    for (const cn of sample) console.log("    " + cn.name + " -> " + cn.targetBone + " [" + cn.property + "]");
    if (layer.curveNodes.length > 30) console.log("    ... and " + (layer.curveNodes.length - 30) + " more");
  }
}

const animatedBones = new Set();
for (const stack of animStructure) {
  for (const layer of stack.layers) {
    for (const cn of layer.curveNodes) {
      if (cn.targetBone !== "unknown") animatedBones.add(cn.targetBone);
    }
  }
}
console.log("
" + "-".repeat(60));
console.log("UNIQUE ANIMATED BONE NAMES");
console.log("-".repeat(60));
const sortedAnimBones = [...animatedBones].sort();
console.log("Count: " + sortedAnimBones.length);
for (const b of sortedAnimBones) console.log("  " + b);
console.log("

" + "=".repeat(80));
console.log("SUMMARY OF ALL FBX FILES");
console.log("=".repeat(80));
for (const file of files) {
  console.log("
" + file + ":");
  try {
    const data = parseFBX(path.join(FBX_DIR, file));
    const fileInfo = extractInfo(data);
    console.log("  Bones: " + fileInfo.bones.length);
    console.log("  Animation Stacks (clips): " + fileInfo.animStacks.length);
    for (const stack of fileInfo.animStacks) console.log("    - "" + stack.name + """);
  } catch (e) { console.log("  ERROR: " + e.message); }
}

console.log("

" + "=".repeat(80));
console.log("BONE NAME COMPARISON: FBX vs MIXAMO");
console.log("=".repeat(80));
console.log("
FBX bone names (sorted):");
for (const b of [...info.bones].sort((a, bb) => a.name.localeCompare(bb.name))) console.log("  " + b.name);
console.log("
Typical Mixamo bone names:");
const mixamoBones = ["mixamorigHips","mixamorigSpine","mixamorigSpine1","mixamorigSpine2","mixamorigNeck","mixamorigHead","mixamorigHeadTop_End","mixamorigLeftShoulder","mixamorigLeftArm","mixamorigLeftForeArm","mixamorigLeftHand","mixamorigRightShoulder","mixamorigRightArm","mixamorigRightForeArm","mixamorigRightHand","mixamorigLeftUpLeg","mixamorigLeftLeg","mixamorigLeftFoot","mixamorigLeftToeBase","mixamorigRightUpLeg","mixamorigRightLeg","mixamorigRightFoot","mixamorigRightToeBase"];
for (const b of mixamoBones) console.log("  " + b);