# Tesla Paint Shop 自动上漆规则（2025 Model Y Premium）

车辆模板 ID：`modely-2025-premium`  
官方源：https://github.com/teslamotors/custom-wraps/tree/master/modely-2025-premium  
3D 网格（社区整理，第二套 UV 对齐官方图集）：[starbadboy/tesla](https://github.com/starbadboy/tesla) 的 `modely_2025_premium/Bayberry.gltf`。安装时下载，不进本仓库。

## 1. 车机如何“上漆”

1. 你上传的是一张 **UV 展开图**（不是侧视图照片）。
2. 模板里 **白色岛屿** = 可上色车身板件；像素坐标映射到 3D 网格 UV。
3. **全透明区域** = 无表面，填色无效且浪费 1MB 配额。
4. **黑色描边** = 编辑参考线，可被设计覆盖，不是几何。
5. 车机/App 3D 查看器用 **自带清漆/光照** 着色；PNG 应接近 **flat albedo（扁平贴图）**，不要烤高光/环境反射。

## 2. 硬性文件规则（官方）

| 规则 | 要求 |
|------|------|
| 格式 | 真 PNG（改后缀无效） |
| 尺寸 | 512–1024（本车模板 **1024×1024**） |
| 体积 | ≤ **1 MB** |
| 文件名 | ≤30 字符；仅字母数字、空格、`-`、`_` |
| 数量 | App ≤10 + USB ≤10 |
| USB | 根目录文件夹名必须是 `Wraps`；文件系统 exFAT/FAT32/ext3/ext4（**不要 NTFS**） |
| 路径 | App：`Creations → Wrap → Upload`；车机：`Toybox → Paint Shop → Wraps` |

## 3. Model Y 2025 Premium 专用注意

- 必须用 **Premium** 模板，不要用 Standard / Performance / 旧款 Model Y。
- 2025+ Juniper：贯穿式灯带；Premium 与 Standard/Performance 的保险杠/饰条 UV **不同**。
- UV 大致布局（社区逆向，非官方）：
  - **左半** ≈ 车身左侧（主驾侧，LHD）
  - **右半** ≈ 车身右侧（副驾侧）
  - **中轴** ≈ 引擎盖 / 车顶 / 尾厢等水平面（前后自上而下堆叠）
  - 充电口只在一侧，左右并非完美镜像

## 4. 生成管线约定（本仓库）

```
Grok 生图（图案/颜色，flat vinyl）
  → stencil.py 用官方模板 alpha 裁切板件
  → validate.py 检查尺寸/体积/文件名/面板 IoU
  → preview 3D（clearcoat 车漆实时着色）
  → 拷贝到 USB Wraps/ 或 App 上传
```

禁止把带假高光的整车渲染图直接当 wrap。
