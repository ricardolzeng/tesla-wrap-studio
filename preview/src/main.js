import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'

const statusEl = document.getElementById('status')
const wrapSelect = document.getElementById('wrapSelect')
const wrapFile = document.getElementById('wrapFile')
const reloadBtn = document.getElementById('reloadBtn')
const carSelect = document.getElementById('carSelect')
const titleEl = document.getElementById('title')
const subtitleEl = document.getElementById('subtitle')

const OFFICIAL = 'https://cdn.jsdelivr.net/gh/teslamotors/custom-wraps@master'
/** 国内常见的四款车身。不含美国独售的 2025 Standard（modely-2025-base）。 */
const CARS = [
  {
    id: 'm3old',
    name: '老款 Model 3',
    note: '2024 焕新前 · 官方 model3',
    file: '/model/m3old/Model3_High.gltf',
    wraps: [
      { name: '官方示例 · Vintage Gradient', url: `${OFFICIAL}/model3/example/Vintage_Gradient.png` },
    ],
  },
  {
    id: 'yold',
    name: '老款 Model Y',
    note: '2025 焕新前 · 官方 modely',
    file: '/model/yold/ModelY_High.gltf',
    wraps: [
      { name: '官方示例 · Vintage Gradient', url: `${OFFICIAL}/modely/example/Vintage_Gradient.png` },
    ],
  },
  {
    id: 'm3',
    name: '焕新 Model 3',
    note: 'Highland · 官方 model3-2024-base（后驱 / 长续航共用）',
    file: '/model/m3/Poppyseed.gltf',
    wraps: [
      { name: '官方示例 · Vintage Gradient', url: `${OFFICIAL}/model3-2024-base/example/Vintage_Gradient.png` },
    ],
  },
  {
    id: 'yp',
    name: '焕新 Model Y',
    note: 'Juniper Premium · 国内长续航，不是美国 Standard',
    file: '/model/juniper/Bayberry.gltf',
    wraps: [
      { name: '银箭流动线 · 2026 车队风格', url: '/wraps/SilverFlow.png' },
      { name: '军绿鲨鱼嘴 · Flying Tigers', url: '/wraps/SharkMouth.png' },
      { name: 'Unicorn NT-D · Ceramic Pearl', url: '/wraps/UnicornNTD_Tesla.png' },
      { name: 'Grok · Midnight Gold', url: '/wraps/MidnightGold.png' },
      { name: '官方示例 · Vintage Gradient', url: `${OFFICIAL}/modely-2025-premium/example/Vintage_Gradient.png` },
    ],
  },
]

const params = {
  clearcoat: 0.85,
  clearcoatRoughness: 0.08,
  metalness: 0.25,
  roughness: 0.32,
  exposure: 1.05,
  envIntensity: 1.1,
  paint: '#c0c6cc',
}

const paintMaterials = []
const paintShaders = []
let wrapTexture = null
let carRoot = null
let wheelAsset = null
let wheelAssetPromise = null
let currentCar = CARS[3]
let loadingCar = null
let pendingCar = null

const view = document.getElementById('view')
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(view.clientWidth, view.clientHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = params.exposure
view.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color('#0c0e12')

const camera = new THREE.PerspectiveCamera(32, view.clientWidth / view.clientHeight, 0.05, 80)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.maxPolarAngle = Math.PI * 0.49
controls.minDistance = 2.2
controls.maxDistance = 16

const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.add(new THREE.HemisphereLight(0xe7edf7, 0x1c1e24, 0.25))
const key = new THREE.DirectionalLight(0xfff7ee, 2.6)
key.position.set(5, 8, 4)
scene.add(key)
const fill = new THREE.DirectionalLight(0xd5def0, 0.55)
fill.position.set(-6, 3, -4)
scene.add(fill)
buildStudio(scene)
loadWheelAsset()

// CC0 studio HDR from Poly Haven. Reflections only; the backdrop stays dark.
new RGBELoader().load(
  'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr',
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping
    scene.environment = texture
    scene.environmentIntensity = 0.9
  }
)

const texLoader = new THREE.TextureLoader()

function setStatus(msg) {
  statusEl.textContent = msg
}

function buildStudio(root) {
  const room = new THREE.Group()
  room.name = 'studio'

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 28),
    new THREE.MeshStandardMaterial({ color: '#3a3834', metalness: 0.45, roughness: 0.38, envMapIntensity: 0.7 })
  )
  floor.rotation.x = -Math.PI / 2
  room.add(floor)

  const wall = new THREE.MeshStandardMaterial({ color: '#16171b', roughness: 0.92, metalness: 0.02 })
  const back = new THREE.Mesh(new THREE.PlaneGeometry(22, 6), wall)
  back.position.set(0, 3, 7)
  back.rotation.y = Math.PI
  room.add(back)
  const side = new THREE.Mesh(new THREE.PlaneGeometry(18, 6), wall)
  side.position.set(-8, 3, 0)
  side.rotation.y = Math.PI / 2
  room.add(side)

  const steel = new THREE.MeshStandardMaterial({ color: '#2a2d32', metalness: 0.85, roughness: 0.35 })
  const truss = new THREE.Mesh(new THREE.BoxGeometry(10, 0.05, 0.05), steel)
  truss.position.set(0, 4.1, -1.5)
  room.add(truss)
  const trussCross = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 3.2), steel)
  trussCross.position.set(0, 4.1, -0.2)
  room.add(trussCross)

  for (let i = 0; i < 6; i++) {
    const x = -4.2 + i * 1.7
    const drop = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.03), steel)
    drop.position.set(x, 3.94, -1.5)
    room.add(drop)
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 8),
      new THREE.MeshStandardMaterial({ color: '#fff6e4', emissive: '#fff1cc', emissiveIntensity: 2, roughness: 0.3 })
    )
    head.position.set(x, 3.76, -1.5)
    room.add(head)
    const spot = new THREE.SpotLight(0xfff4e2, 40, 16, 0.42, 0.5, 1)
    spot.position.set(x, 3.7, -1.5)
    spot.target.position.set(x * 0.15, 0.5, 0.4)
    room.add(spot)
    room.add(spot.target)
  }

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 0.35),
    new THREE.MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff1c1c', emissiveIntensity: 2.4, roughness: 0.4 })
  )
  glow.position.set(4.5, 1.1, 6.7)
  glow.rotation.y = Math.PI
  room.add(glow)

  root.add(room)
}

function loadWheelAsset() {
  wheelAssetPromise = new GLTFLoader().loadAsync('/scene/alloy-wheel.glb').then((gltf) => {
    wheelAsset = gltf.scene
    return wheelAsset
  })
  return wheelAssetPromise
}

const WHEEL_ANCHOR = /^Wheel_[LR][LRF]_Spatial$/

function makeWheel(radius, outward) {
  const model = wheelAsset.clone(true)
  model.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  model.position.sub(center)

  const dims = [size.x, size.y, size.z]
  let axleAxis = 0
  if (dims[1] < dims[axleAxis]) axleAxis = 1
  if (dims[2] < dims[axleAxis]) axleAxis = 2
  const axleLocal = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ][axleAxis]
  const diameter = Math.max(size.x, size.y, size.z)
  // 225/40R18 source, scaled so the rolling radius matches the car and the rim lands near 20 in.
  const scale = (radius * 2) / diameter

  const wheel = new THREE.Group()
  wheel.add(model)
  wheel.scale.setScalar(scale)
  wheel.quaternion.setFromUnitVectors(axleLocal.clone().negate(), outward.clone().normalize())
  wheel.traverse((obj) => {
    obj.userData.proceduralWheel = true
    if (!obj.isMesh) return
    obj.castShadow = true
    obj.receiveShadow = true
    obj.material = obj.material.clone()
    obj.material.color.set('#1a1c20')
    obj.material.metalness = 0.82
    obj.material.roughness = 0.32
  })
  return wheel
}

function attachWheels(root) {
  root.updateMatrixWorld(true)
  const anchors = new Map()
  root.traverse((child) => {
    if (!WHEEL_ANCHOR.test(child.name || '')) return
    child.updateWorldMatrix(true, false)
    const world = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld)
    anchors.set(child.name, root.worldToLocal(world.clone()))
  })
  if (anchors.size === 0) return
  const pair = [
    ['Wheel_LF_Spatial', 'Wheel_RF_Spatial'],
    ['Wheel_LR_Spatial', 'Wheel_RR_Spatial'],
    ['Wheel_RL_Spatial', 'Wheel_RR_Spatial'],
  ].map(([left, right]) => [anchors.get(left), anchors.get(right)]).find(([left, right]) => left && right)
  const axle = pair
    ? new THREE.Vector3().subVectors(pair[1], pair[0]).normalize()
    : new THREE.Vector3(0, 0, 1)
  const centre = new THREE.Vector3()
  for (const local of anchors.values()) centre.add(local)
  centre.divideScalar(anchors.size)
  for (const [name, local] of anchors) {
    const outward = local.clone().sub(centre).dot(axle) >= 0 ? axle.clone() : axle.clone().negate()
    const wheel = makeWheel(Math.abs(local.y), outward)
    wheel.name = `preview-${name}`
    wheel.position.copy(local)
    root.add(wheel)
  }
}

function addContactShadow(root) {
  const box = new THREE.Box3()
  root.traverse((child) => {
    if (child.isMesh && child.visible && !child.userData.proceduralWheel) box.expandByObject(child)
  })
  if (box.isEmpty()) return
  const size = box.getSize(new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62)
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)')
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.22)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(size.x, size.z) * 1.05, Math.min(size.x, size.z) * 1.35),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false })
  )
  mesh.rotation.x = -Math.PI / 2
  if (size.x < size.z) mesh.rotation.z = Math.PI / 2
  mesh.position.set(centre.x, box.min.y + 0.004, centre.z)
  mesh.name = 'contact-shadow'
  const previous = scene.getObjectByName('contact-shadow')
  if (previous) {
    scene.remove(previous)
    previous.geometry.dispose()
    previous.material.map?.dispose()
    previous.material.dispose()
  }
  scene.add(mesh)
}

function clearGlass(root) {
  root.traverse((child) => {
    if (!child.isMesh) return
    const mats = [].concat(child.material)
    const next = mats.map((mat) => {
      const name = mat?.name || ''
      if (/seat|interior/i.test(name) && !/glass/i.test(name)) {
        mat.color = new THREE.Color('#b7bdc6')
        if ('roughness' in mat) mat.roughness = 0.65
        if ('metalness' in mat) mat.metalness = 0.05
        return mat
      }
      if (!/glass/i.test(name) || /light/i.test(name)) return mat
      return new THREE.MeshPhysicalMaterial({
        name,
        color: '#f4f7fb',
        metalness: 0,
        roughness: 0.03,
        transparent: true,
        opacity: 0.08,
        envMapIntensity: 0.35,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    })
    child.material = Array.isArray(child.material) ? next : next[0]
  })
}

const BODY = /paint|^cover|exterior/i
const NOT_BODY = /glass|light|interior|seat|trim|fade|plastic|rubber/i
const isBody = (name = '') => BODY.test(name) && !NOT_BODY.test(name)

function hasMappedWrapUv(geometry, uv) {
  const cache = geometry.userData
  if (cache.wrapUvMapped !== undefined) return cache.wrapUvMapped
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
  const step = Math.max(1, Math.floor(uv.count / 400))
  for (let i = 0; i < uv.count; i += step) {
    const u = uv.getX(i)
    const v = uv.getY(i)
    if (u < minU) minU = u
    if (u > maxU) maxU = u
    if (v < minV) minV = v
    if (v > maxV) maxV = v
  }
  const area = Math.max(0, maxU - minU) * Math.max(0, maxV - minV)
  cache.wrapUvMapped = area > 0.001
  return cache.wrapUvMapped
}

function bindSlider(id, key, digits = 2) {
  const el = document.getElementById(id)
  const val = document.getElementById(id + 'Val')
  if (!el) return
  const sync = () => {
    params[key] = Number(el.value)
    if (val) val.textContent = params[key].toFixed(digits)
    applyPaint()
    if (key === 'exposure') renderer.toneMappingExposure = params.exposure
  }
  el.addEventListener('input', sync)
}

function applyPaint() {
  const color = new THREE.Color(params.paint)
  for (const mat of paintMaterials) {
    mat.color.copy(color)
    mat.clearcoat = params.clearcoat
    mat.clearcoatRoughness = params.clearcoatRoughness
    mat.metalness = params.metalness
    mat.roughness = params.roughness
    mat.envMapIntensity = params.envIntensity
    mat.transparent = false
    mat.opacity = 1
    mat.depthWrite = true
    mat.needsUpdate = true
  }
  for (const shader of paintShaders) {
    if (shader.uniforms.uTex) shader.uniforms.uTex.value = wrapTexture
  }
}

function makePaintMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: params.paint,
    roughness: params.roughness,
    metalness: params.metalness,
    clearcoat: params.clearcoat,
    clearcoatRoughness: params.clearcoatRoughness,
    envMapIntensity: params.envIntensity,
    transparent: false,
    opacity: 1,
  })
  mat.name = 'FactoryPaint'
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTex = { value: wrapTexture }
    shader.vertexShader = 'varying vec2 vWrapUv;\nattribute vec2 wrapUv;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      '#include <uv_vertex>\nvWrapUv = wrapUv;'
    )
    shader.fragmentShader = 'uniform sampler2D uTex;\nvarying vec2 vWrapUv;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      vec4 wrapColor = texture2D(uTex, vWrapUv);
      // 透明区域露出底漆；不透明区域显示贴膜。材质本身保持不透明，避免车身发透。
      diffuseColor.rgb = mix(diffuseColor.rgb, wrapColor.rgb, wrapColor.a);
      `
    )
    paintShaders.push(shader)
  }
  mat.customProgramCacheKey = () => 'juniper-wrap-uv1'
  paintMaterials.push(mat)
  return mat
}

function atlasUrl(url) {
  if (url.startsWith('blob:')) return url
  const map = {
    '/wraps/SharkMouth_3d.png': '/wraps/SharkMouth.png',
    '/wraps/UnicornNTD_3d.png': '/wraps/UnicornNTD_Tesla.png',
    '/wraps/UnicornNTD.png': '/wraps/UnicornNTD_Tesla.png',
  }
  return map[url] || url
}

function themePaint(url) {
  const u = url.toLowerCase()
  if (u.includes('silverflow')) return '#0b0d10'
  if (u.includes('shark')) return '#4a5c28'
  if (u.includes('unicorn')) return '#e7ebf1'
  if (u.includes('midnight')) return '#1c2744'
  if (u.includes('vintage')) return '#d26a32'
  return '#c5ccd4'
}

async function loadWrap(url) {
  const src = atlasUrl(url)
  setStatus(`加载贴膜（官方 UV1）…\n${src}`)
  const texture = await texLoader.loadAsync(src)
  texture.flipY = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true
  if (wrapTexture) wrapTexture.dispose()
  wrapTexture = texture
  params.paint = themePaint(url)
  applyPaint()
  setStatus(`实车贴膜已贴上（不透明清漆 + 官方第二套 UV）\n${src}`)
}

function isGround(obj) {
  const names = [obj.name, obj.parent?.name, obj.material?.name]
    .concat([].concat(obj.material || []).map((m) => m?.name))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return /ground|floor|shadow/.test(names)
}

function dressModel(root) {
  let wrapped = 0
  root.traverse((child) => {
    if (isGround(child)) {
      child.visible = false
      return
    }
    if (!child.isMesh) return
    const mats = [].concat(child.material)
    const body = mats.some((m) => isBody(m?.name))
    const uv = child.geometry?.attributes?.uv1 || child.geometry?.attributes?.uv
    if (!body || !uv || !hasMappedWrapUv(child.geometry, uv)) return
    child.geometry.setAttribute('wrapUv', uv)
    child.material = makePaintMaterial()
    child.castShadow = true
    child.receiveShadow = true
    wrapped++
  })
  return wrapped
}

function disposeCar() {
  if (!carRoot) return
  scene.remove(carRoot)
  carRoot.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose()
  })
  carRoot = null
  paintMaterials.length = 0
  paintShaders.length = 0
}

function fillCarSelect() {
  carSelect.innerHTML = ''
  for (const car of CARS) {
    const opt = document.createElement('option')
    opt.value = car.id
    opt.textContent = car.name
    carSelect.appendChild(opt)
  }
  carSelect.value = currentCar.id
}

function fillWrapSelect(car) {
  const prev = wrapSelect.value
  wrapSelect.innerHTML = ''
  for (const wrap of car.wraps) {
    const opt = document.createElement('option')
    opt.value = wrap.url
    opt.textContent = wrap.name
    wrapSelect.appendChild(opt)
  }
  if ([...wrapSelect.options].some((o) => o.value === prev)) wrapSelect.value = prev
}

function setCameraPreset(name) {
  const presets = {
    front: { pos: [0.2, 1.15, 5.4], target: [0, 0.7, 0] },
    side: { pos: [6.4, 1.15, 0.3], target: [0, 0.7, 0] },
    rear: { pos: [-0.2, 1.2, -5.6], target: [0, 0.75, 0] },
    threeQuarter: { pos: [-4.4, 1.15, -5.6], target: [0.2, 0.6, 0.3] },
  }
  const p = presets[name] || presets.threeQuarter
  camera.position.set(...p.pos)
  controls.target.set(...p.target)
  controls.update()
}
window.setCameraPreset = setCameraPreset

async function loadCar(car) {
  if (loadingCar) {
    pendingCar = car
    return
  }
  loadingCar = car.id
  currentCar = car
  titleEl.textContent = car.name
  subtitleEl.textContent = `${car.note} · 官方 UV · 不透明清漆`
  fillWrapSelect(car)
  setStatus(`加载 ${car.name}…`)
  try {
    disposeCar()
    const draco = new DRACOLoader()
    draco.setDecoderPath('/draco/')
    const loader = new GLTFLoader()
    loader.setDRACOLoader(draco)
    const gltf = await loader.loadAsync(car.file)
    if (currentCar.id !== car.id) return
    carRoot = gltf.scene
    const box = new THREE.Box3().setFromObject(carRoot)
    const center = new THREE.Vector3()
    box.getCenter(center)
    carRoot.position.x -= center.x
    carRoot.position.z -= center.z
    carRoot.position.y -= box.min.y
    const wrapped = dressModel(carRoot)
    clearGlass(carRoot)
    if (wheelAssetPromise) await wheelAssetPromise
    if (wheelAsset) attachWheels(carRoot)
    const cabin = new THREE.PointLight(0xfff6ea, 6, 6, 2)
    cabin.position.set(0, 1.05, 0.1)
    carRoot.add(cabin)
    scene.add(carRoot)
    addContactShadow(carRoot)
    setCameraPreset('threeQuarter')
    setStatus(`${car.name} 已加载，车身 ${wrapped} 块。正在贴膜…`)
    await loadWrap(wrapSelect.value)
  } catch (err) {
    console.error(err)
    setStatus(`加载失败：${err.message || err}`)
  } finally {
    loadingCar = null
    if (pendingCar) {
      const next = pendingCar
      pendingCar = null
      loadCar(next)
    }
  }
}

fillCarSelect()
carSelect.addEventListener('change', () => {
  const car = CARS.find((c) => c.id === carSelect.value)
  if (car) loadCar(car)
})
document.querySelectorAll('[data-cam]').forEach((btn) => {
  btn.addEventListener('click', () => setCameraPreset(btn.dataset.cam))
})
bindSlider('clearcoat', 'clearcoat')
bindSlider('clearcoatRoughness', 'clearcoatRoughness')
bindSlider('metalness', 'metalness')
bindSlider('roughness', 'roughness')
bindSlider('exposure', 'exposure')
bindSlider('envIntensity', 'envIntensity')
wrapSelect.addEventListener('change', () => loadWrap(wrapSelect.value))
reloadBtn.addEventListener('click', () => loadWrap(wrapSelect.value))
wrapFile.addEventListener('change', async () => {
  const file = wrapFile.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  const opt = document.createElement('option')
  opt.value = url
  opt.textContent = file.name
  wrapSelect.appendChild(opt)
  wrapSelect.value = url
  await loadWrap(url)
})

window.addEventListener('resize', () => {
  camera.aspect = view.clientWidth / view.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(view.clientWidth, view.clientHeight)
})

function animate() {
  requestAnimationFrame(animate)
  if (wrapTexture) {
    for (const shader of paintShaders) {
      if (shader.uniforms?.uTex) shader.uniforms.uTex.value = wrapTexture
    }
  }
  controls.update()
  renderer.render(scene, camera)
}
animate()

loadCar(currentCar)
