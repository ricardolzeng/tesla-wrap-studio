# Tesla Wrap Studio

本地预览特斯拉 Paint Shop 车衣，并把图案压进官方 UV。默认页面是焕新 Model Y（Juniper Premium）的科技 P 房：清漆车身、20 英寸锻造涡轮轮毂、实体卡钳。

Preview Tesla Paint Shop wraps locally, and stencil artwork onto the official UV. The default page is a pit-lane studio for the refreshed Model Y (Juniper Premium), with clearcoat paint, 20-inch forged turbine wheels, and solid calipers.

本项目与特斯拉公司无关，不是官方工具。

This project is not affiliated with Tesla, Inc. and is not an official tool.

## 中文

### 它做什么

- 在浏览器里看焕新 Model Y Premium 的贴膜效果。贴膜走官方 UV1，车身材质保持不透明清漆。
- 用 `pipeline/stencil.py` 把一张图蒙进 `modely-2025-premium` 的白色板件，并压到 1MB 以内。
- `preview/cars.html` 仍可切换四款国内车身：老款 Model 3、老款 Model Y、焕新 Model 3（Highland）、焕新 Model Y。不含美国独售的 2025 Standard。

车身网格和官方 UV 模板不在本仓库里。安装脚本会从上游公开地址下载到本地，这些目录已写入 `.gitignore`。

### 安装

```bash
bash scripts/setup.sh
cd preview && npm run dev
```

浏览器打开 http://localhost:5173 。四款车身切换在 http://localhost:5173/cars.html 。

生成一张可上车的 Premium 贴膜：

```bash
python3 pipeline/stencil.py path/to/art.png -n MyWrap
python3 pipeline/validate.py outputs/MyWrap.png
```

蒙版只适用于焕新 Model Y Premium。PNG 需为 1024×1024、不超过 1MB。上车路径：App `Creations → Wrap → Upload`，或 U 盘根目录文件夹 `Wraps/`（exFAT 或 FAT32）。车机路径是 `Toybox → Paint Shop → Wraps`。

### 致谢

这个工作室是站在下面这些公开项目上做出来的。感谢作者把模板、网格和渲染器开放出来。

- **[teslamotors/custom-wraps](https://github.com/teslamotors/custom-wraps)**  
  官方 Paint Shop 模板。白色板件、文件尺寸和 UV 分区规则都来自这里。`modely-2025-premium/template.png` 是蒙版的唯一依据。该仓库没有开源许可证，所以本仓库不转载模板，只在安装时下载。示例贴膜在预览里通过 jsDelivr 读取上游，不复制进 git。

- **[starbadboy/tesla](https://github.com/starbadboy/tesla)**  
  社区整理的车身 glTF。第二套 UV（`uv1`）能对上官方图集，贴膜才会落在正确的板件上。仓库本身是 MIT，网格来自特斯拉可视化程序。本仓库同样不转载这些网格，安装时下载这四款：`model3_classic`、`modely_classic`、`model3_2024`、`modely_2025_premium`。

- **[three.js](https://github.com/mrdoob/three.js)**（MIT）  
  渲染器、`GLTFLoader`、`OrbitControls`、`MeshPhysicalMaterial` 清漆，以及 P 房灯光和轮毂几何的运行时。页面通过 jsDelivr 使用 0.170.0。几何解码用的是 three 自带的 **[Draco](https://github.com/google/draco)**（Apache-2.0）。

- **[Vite](https://github.com/vitejs/vite)**（MIT）  
  本地预览的开发服务器。

- **[Pillow](https://github.com/python-pillow/Pillow)** 与 **NumPy**  
  蒙版、扩边和压到 1MB 的图像处理。

- **[Poly Haven](https://polyhaven.com/a/studio_small_09)** `studio_small_09`（CC0）  
  四款车身页面 `cars.html` 的环境反射。只用于反光，不作为背景图转载。

P 房墙地、射灯、20 英寸扁胎涡轮轮毂和卡钳是本仓库里的程序化几何，不是外部车库模型。

## English

### What it does

- Preview a refreshed Model Y Premium wrap in the browser. The wrap is sampled from official UV1. The body material stays opaque clearcoat.
- `pipeline/stencil.py` masks artwork onto the white panels of `modely-2025-premium` and keeps the PNG under 1MB.
- `preview/cars.html` still switches among the four cars sold in China: pre-refresh Model 3, pre-refresh Model Y, Highland Model 3, and Juniper Model Y. The US-only 2025 Standard is not included.

Body meshes and official UV templates are not in this repository. Setup downloads them from their public upstreams. Those paths are gitignored.

### Setup

```bash
bash scripts/setup.sh
cd preview && npm run dev
```

Open http://localhost:5173 . The four-car switcher is at http://localhost:5173/cars.html .

Stencil a Premium wrap:

```bash
python3 pipeline/stencil.py path/to/art.png -n MyWrap
python3 pipeline/validate.py outputs/MyWrap.png
```

The mask fits refreshed Model Y Premium only. The PNG must be 1024×1024 and at most 1MB. In the app: `Creations → Wrap → Upload`. On a USB drive, put files in a root folder named `Wraps` (exFAT or FAT32). In the car: `Toybox → Paint Shop → Wraps`.

### Thanks

This studio is built on the public projects below. Thank you to the authors who published the templates, the meshes, and the renderer.

- **[teslamotors/custom-wraps](https://github.com/teslamotors/custom-wraps)**  
  Official Paint Shop templates. Panel masks, file limits, and UV layout all come from here. `modely-2025-premium/template.png` is the only mask this stencil uses. That repository has no open-source license, so this repo does not redistribute the templates. Setup downloads them. Example wraps are read from upstream through jsDelivr and are not copied into git.

- **[starbadboy/tesla](https://github.com/starbadboy/tesla)**  
  Community glTF bodies. The second UV set (`uv1`) matches the official atlas, which is why a wrap lands on the right panels. The repository is MIT. The meshes come from Tesla's visualizer. This repo does not ship those meshes. Setup downloads four of them: `model3_classic`, `modely_classic`, `model3_2024`, and `modely_2025_premium`.

- **[three.js](https://github.com/mrdoob/three.js)** (MIT)  
  The renderer, `GLTFLoader`, `OrbitControls`, clearcoat via `MeshPhysicalMaterial`, and the runtime for the pit lights and wheel geometry. The page loads 0.170.0 from jsDelivr. Mesh decoding uses the **[Draco](https://github.com/google/draco)** decoder shipped with three (Apache-2.0).

- **[Vite](https://github.com/vitejs/vite)** (MIT)  
  The local preview server.

- **[Pillow](https://github.com/python-pillow/Pillow)** and **NumPy**  
  Masking, color bleed, and the 1MB PNG squeeze.

- **[Poly Haven](https://polyhaven.com/a/studio_small_09)** `studio_small_09` (CC0)  
  Environment reflections on the four-car page, `cars.html`. Used for reflections only, not redistributed as a backdrop.

The pit walls and floor, the spot lights, the 20-inch low-profile turbine wheels, and the calipers are procedural geometry in this repository. They are not an external garage model.

## License

Code in this repository is [MIT](LICENSE). That license does not cover Tesla body meshes, official wrap templates, or Tesla trademarks. Those stay with their upstreams.
