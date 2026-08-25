import * as THREE from 'three'
import { VoxelSystem, buildVoxelGeometry } from '../src/voxel.js'
import { World } from '../src/world.js'

const t0 = performance.now()
const scene = new THREE.Scene()
const sys = new VoxelSystem()
const world = new World(sys, scene)
const t1 = performance.now()
console.log('World construction:', Math.round(t1 - t0), 'ms')

let totalVox = 0
const count = g => { if (g?.attributes?.position) totalVox += g.attributes.position.count / 4 }
const walk = v => v.group.children.forEach(m => count(m))
walk(world.islandVg)
walk(world.pagodaVg)
walk(world.isleVg)
walk(world.lotusVg)
walk(world.starVg)
walk(world.jadeVg)
console.log('Voxel faces (quads):', totalVox)

const list = []
for (let i = 0; i < 20000; i++) {
  list.push({ x: i % 100, y: (i / 100) | 0, z: i % 37, c: '#93D46F', s: 1 })
}
const t2 = performance.now()
const geo = buildVoxelGeometry(list, { ao: true })
const t3 = performance.now()
console.log('buildVoxelGeometry 20k voxels:', Math.round(t3 - t2), 'ms, verts:', geo.attributes.position.count)

const t4 = performance.now()
for (let k = 0; k < 5; k++) world.update(0.016, k)
const t5 = performance.now()
console.log('world.update x5:', Math.round(t5 - t4), 'ms')
