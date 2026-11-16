# 《穗守》白模占位与 Blender MCP 生成提示词

> 版本：v3 中国田园白模季 · 自动生成自 [`src/game/whitebox-assets.json`](../src/game/whitebox-assets.json)。
> 生成命令：`npm run docs:whitebox`。请勿手工编辑本文件，改清单后重新生成。

## 0. 这份文档解决什么

《穗守》v3 不再加载任何外部 GLB，全部场景物件都是程序化白模（无贴图、平面着色、低多边形）。这样做的原因：

- 没有找到同时满足「中国田园（青瓦白墙、梯田、稻穗、竹篱）」和「可商用许可」的现成素材包；
- 宁可用统一的白模占位，也不使用来源不明或许可证不清的资产；
- 每个占位物都给出尺寸、比例、朝向、面数预算、风格参考和 GLB 导出参数，方便你之后用 Blender MCP 生成正式模型逐个替换。

**清单规模：36 个占位物**，与游戏中的模型 id 一一对应。白模不是最终美术，而是可替换的骨架。

## 1. 通用生成约定

| 项 | 约定 |
| --- | --- |
| 单位 | 1 Blender 单位 = 1 米；游戏内模型按真实比例构建 |
| 朝向 | Three.js 的 +Z 是模型正面，对应 Blender 的 **-Y**（Front 视图）。若模型正脸朝 Three.js -Z（仅玩家角色），对应 Blender **+Y**。 |
| 原点 | 模型底部几何中心（树/建筑/角色都落在 y = 0），方便直接放到地块坐标 |
| 导出 | glTF 2.0 二进制 **GLB**，+Y up，应用旋转与缩放 |
| 面数 | 每项都给出三角面预算；目标是在 2.2 × 2.2 m 地块上远看仍有清晰剪影 |
| 材质 | 无贴图、无 UV 纹理、平面着色；每项 2–5 个纯色材质槽，按结构分色即可 |
| 命名 | `<id>.glb`，例如 `env_house.glb`；id 见下表 |
| 碰撞 | 不要做碰撞体；游戏用 2D 近似障碍，正式模型只需外观 |
| 动画 | 水车轮、稻灵光环、兽径布幡等是独立子对象，提示词中已标注；其余为静态 |

### 配色（唯一允许的调色板）

| 名称 | 色值 | 用途 |
| --- | --- | --- |
| 米白（白墙、布衣、稻粒） | `#f2efe6` | 结构分色 |
| 暖白（阴影面、石基） | `#e4ddd0` | 结构分色 |
| 墨灰（瓦顶、梁柱、眼睛） | `#4b514c` | 结构分色 |
| 中墨（石材、阴影结构） | `#767d75` | 结构分色 |
| 暖土（土、木、皮肤） | `#b09571` | 结构分色 |
| 草黄（稻草、斗笠、稻穗） | `#cbb283` | 结构分色 |
| 淡青（植物、竹） | `#8d9f87` | 结构分色 |
| 朱砂（门、布招、眼睛；少量） | `#a84b38` | 结构分色 |
| 浅金（发光件、等级珠） | `#e6d6a4` | 结构分色 |

### 白模替换流程（生成之后）

1. 在 Blender 中按对应条目的提示词生成模型，检查朝向、原点和面数；
2. 导出为 `<id>.glb`，放进 `游戏/public/assets/whitebox/`；
3. 目前 v3 默认使用程序化白模，**不自动加载** GLB；要做正式替换，需要在 `main.ts` / `models.ts` 里接入 GLTFLoader，并按 id 替换对应构建器（本季不包含自动替换逻辑，避免把未验证的加载路径混进验收）；
4. 运行 `npm run build` 和 `npm run verify`，确认场景无破面、无悬空、无缩放过大的模型。

> 诚实说明：v3 当前的验收只覆盖**白模占位**；本仓库没有随附正式 GLB，也没有把生成后的模型接入构建。提示词的作用是让你可以自己替换，而不是声称已经替换。

## 2. 清单总表

| # | id | 名称 | 类别 | 尺寸 (W×H×D, m) | 面数预算 | 游戏用途 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [`env_house`](#env-house) | 青瓦白墙民居 | 环境与建筑 | 7.2 × 4 × 5.1 | 3200 | 农舍地标 / 出生点背景建筑 |
| 2 | [`env_waterwheel`](#env-waterwheel) | 竹木水车 | 环境与建筑 | 4.2 × 4 × 2.6 | 2400 | 农舍旁的动态装饰（风车槽位） |
| 3 | [`env_tea_shed`](#env-tea-shed) | 乡集茶棚 | 环境与建筑 | 3.2 × 2.6 × 2 | 1600 | 乡集 / 行商摊位背景 |
| 4 | [`env_well`](#env-well) | 青石井 | 环境与建筑 | 1.6 × 2.3 × 1.6 | 1200 | 农舍区装饰 |
| 5 | [`env_haystack`](#env-haystack) | 草垛 | 环境与建筑 | 1.5 × 2 × 1.5 | 700 | 农事装饰 |
| 6 | [`env_basket`](#env-basket) | 竹筐 | 环境与建筑 | 0.9 × 0.65 × 0.9 | 500 | 农事道具装饰 |
| 7 | [`env_jar`](#env-jar) | 陶瓮 | 环境与建筑 | 0.85 × 1 × 0.85 | 600 | 茶棚/农舍道具 |
| 8 | [`env_bamboo_fence`](#env-bamboo-fence) | 竹篱 | 环境与建筑 | 2.4 × 1.1 × 0.22 | 700 | 田埂/院墙边界（2.4 m 一段，可拼接） |
| 9 | [`env_pine`](#env-pine) | 松树 | 环境与建筑 | 2.6 × 4.5 × 2.6 | 1200 | 林木装饰（可替换两种树形） |
| 10 | [`env_bamboo`](#env-bamboo) | 竹丛 | 环境与建筑 | 2 × 4.2 × 2 | 1600 | 竹篱外景/遮挡装饰 |
| 11 | [`env_rock`](#env-rock) | 山石 | 环境与建筑 | 1.6 × 0.9 × 1.4 | 400 | 散景岩石 |
| 12 | [`env_stone_lantern`](#env-stone-lantern) | 土地庙石灯 | 环境与建筑 | 1.3 × 2.3 × 1.3 | 800 | 路旁石灯 / 土地庙（雕像槽位） |
| 13 | [`env_field_shelter`](#env-field-shelter) | 田棚 | 环境与建筑 | 2 × 1.7 × 2.2 | 900 | 田边歇脚棚 |
| 14 | [`env_beast_gate`](#env-beast-gate) | 兽径柴门 | 环境与建筑 | 2.8 × 3 × 1.2 | 1400 | 敌人出生点的山口/柴门 |
| 15 | [`env_shrine`](#env-shrine) | 社稷坛 | 环境与建筑 | 4.6 × 2.2 × 4.6 | 2600 | 守望之种 / 核心目标祭坛 |
| 16 | [`env_terrace`](#env-terrace) | 梯田段 | 环境与建筑 | 12 × 2.6 × 6.2 | 2000 | 东侧三级水田（菜单/俯瞰可见的场景地标） |
| 17 | [`env_drying_rack`](#env-drying-rack) | 晒谷架 | 环境与建筑 | 2.1 × 1.6 × 0.9 | 900 | 农事装饰 |
| 18 | [`env_scarecrow`](#env-scarecrow) | 稻草人 | 环境与建筑 | 1.2 × 2.2 × 0.6 | 700 | 田边地标 |
| 19 | [`crop_rice`](#crop-rice) | 金穗稻（成熟态） | 作物 | 0.9 × 1.3 × 0.9 | 900 | 作物 wheat 的成熟白模；游戏用同一模型缩放表现 4 个生长阶段 |
| 20 | [`crop_pumpkin`](#crop-pumpkin) | 暖阳瓜（成熟态） | 作物 | 0.9 × 1.1 × 0.9 | 900 | 作物 pumpkin 的成熟白模；同一模型缩放表现生长阶段 |
| 21 | [`crop_starflower`](#crop-starflower) | 星辉花（成熟态） | 作物 | 0.7 × 1.4 × 0.7 | 700 | 作物 flower 的成熟白模；同一模型缩放表现生长阶段 |
| 22 | [`tower_bamboo`](#tower-bamboo) | 竹风望楼 Lv.1 | 防御塔 | 2.15 × 3.9 × 2.15 | 2200 | 防御塔 arrow 的基础白模；Lv.2/3 复用同一模型缩放并加等级珠 |
| 23 | [`tower_mortar`](#tower-mortar) | 石臼炮台 Lv.1 | 防御塔 | 2.2 × 2.6 × 2.2 | 2000 | 防御塔 cannon 的基础白模；Lv.2/3 复用同一模型缩放并加等级珠 |
| 24 | [`tower_shrine`](#tower-shrine) | 社火祭坛 Lv.1 | 防御塔 | 2.2 × 3.4 × 2.2 | 2400 | 防御塔 star 的基础白模；Lv.2/3 复用同一模型缩放并加等级珠 |
| 25 | [`guard_bowman`](#guard-bowman) | 竹弓手 | 乡勇 | 0.8 × 1.85 × 0.7 | 1400 | 乡勇 bowman 的基础白模；等级缩放 + 等级珠 |
| 26 | [`guard_hoeman`](#guard-hoeman) | 锄禾客 | 乡勇 | 0.9 × 1.8 × 0.8 | 1300 | 乡勇 hoeman 的基础白模；等级缩放 + 等级珠 |
| 27 | [`guard_fieldhand`](#guard-fieldhand) | 田倌 | 乡勇 | 0.9 × 1.75 × 0.8 | 1300 | 乡勇 fieldhand 的基础白模；等级缩放 + 等级珠 |
| 28 | [`guard_herbalist`](#guard-herbalist) | 采药人 | 乡勇 | 0.85 × 1.8 × 1 | 1500 | 乡勇 herbalist 的基础白模；等级缩放 + 等级珠 |
| 29 | [`guard_mason`](#guard-mason) | 石匠 | 乡勇 | 0.9 × 1.85 × 0.8 | 1500 | 乡勇 mason 的基础白模；等级缩放 + 等级珠 |
| 30 | [`guard_ricespirit`](#guard-ricespirit) | 稻灵 | 乡勇 | 0.9 × 1.8 × 0.9 | 1800 | 乡勇 ricespirit 的基础白模；等级缩放 + 等级珠 |
| 31 | [`enemy_fox`](#enemy-fox) | 赤狐 | 野兽 | 1 × 0.9 × 1.8 | 1100 | 敌人 fox 的基础白模 |
| 32 | [`enemy_wolf`](#enemy-wolf) | 灰狼 | 野兽 | 1.2 × 1.1 × 2.1 | 1300 | 敌人 wolf 的基础白模 |
| 33 | [`enemy_boar`](#enemy-boar) | 荒角野猪 | 野兽 | 1.6 × 1.4 × 2.4 | 1500 | 敌人 bull 的基础白模 |
| 34 | [`enemy_stag`](#enemy-stag) | 白鹿王（Boss） | 野兽 | 2 × 2.4 × 2.8 | 1800 | 敌人 stag 的基础白模；Boss 光环由游戏另加 |
| 35 | [`player_farmer`](#player-farmer) | 守望者（第三人称） | 玩家 | 0.7 × 1.9 × 0.5 | 1400 | 俯瞰视角下可见的玩家角色 |
| 36 | [`player_hoe`](#player-hoe) | 第一人称锄头 | 玩家 | 0.4 × 1 × 0.7 | 300 | 第一人称手持道具 |

## 环境与建筑

### 青瓦白墙民居 · `env_house`

**游戏用途**：农舍地标 / 出生点背景建筑

| 项 | 值 |
| --- | --- |
| 英文名 | Whitewashed Jiangnan Farmhouse |
| 尺寸 (W×H×D) | 7.2 × 4 × 5.1 m |
| 比例 | 正房约 5.0 m 宽、檐口高约 2.5 m、屋脊高约 3.6 m；厢房高约为正房的 70%，总高约 4.0 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 3200 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_house.glb`（GLB, glTF 2.0, +Y up） |
| 接入备注 | replace with env_house.glb; placed at WORLD.decorations.farmhouse |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「青瓦白墙民居」。
造型：单层三开间正房带一侧厢房，白灰墙、墨灰瓦、木格窗，前有小院矮墙与柴门。屋顶为双坡青瓦，檐口微微上翘；屋后有一截烟囱和一捆柴。
尺寸：宽 7.2 m × 高 4 m × 深 5.1 m。正房约 5.0 m 宽、檐口高约 2.5 m、屋脊高约 3.6 m；厢房高约为正房的 70%，总高约 4.0 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 3200 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_house.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Whitewashed Jiangnan Farmhouse".
Shape: A single-storey three-bay farmhouse with one side wing: whitewashed walls, dark grey tiled double-pitch roof with slightly upturned eaves, timber lattice windows, a low courtyard wall and a bamboo gate, a chimney and a small firewood stack.
Dimensions: 7.2 m W × 4 m H × 5.1 m D. 正房约 5.0 m 宽、檐口高约 2.5 m、屋脊高约 3.6 m；厢房高约为正房的 70%，总高约 4.0 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 3200 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_house.glb.
```

### 竹木水车 · `env_waterwheel`

**游戏用途**：农舍旁的动态装饰（风车槽位）

| 项 | 值 |
| --- | --- |
| 英文名 | Bamboo Waterwheel Mill |
| 尺寸 (W×H×D) | 4.2 × 4 × 2.6 m |
| 比例 | 水轮直径约 2.4 m，中心离地约 1.45 m；棚顶高约 3.6 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 2400 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_waterwheel.glb`（GLB, glTF 2.0, +Y up） |
| 接入备注 | 子对象命名 Waterwheel 用于旋转动画 |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「竹木水车」。
造型：一座架在石砌水槽上的竹木大水车，轮辐 8 根、外圈两道竹箍，带小茅草棚与引水槽。轮子需与静止支架分开，以便游戏旋转。
尺寸：宽 4.2 m × 高 4 m × 深 2.6 m。水轮直径约 2.4 m，中心离地约 1.45 m；棚顶高约 3.6 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 2400 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_waterwheel.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Bamboo Waterwheel Mill".
Shape: A bamboo-and-timber waterwheel on a stone channel, eight spokes, two bamboo rims, with a small thatched shelter and a flume. The wheel must be a separate child object so the game can rotate it.
Dimensions: 4.2 m W × 4 m H × 2.6 m D. 水轮直径约 2.4 m，中心离地约 1.45 m；棚顶高约 3.6 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 2400 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_waterwheel.glb.
```

### 乡集茶棚 · `env_tea_shed`

**游戏用途**：乡集 / 行商摊位背景

| 项 | 值 |
| --- | --- |
| 英文名 | Village Tea Shed |
| 尺寸 (W×H×D) | 3.2 × 2.6 × 2 m |
| 比例 | 檐口高约 1.8 m，棚顶最高 2.6 m；柜台高 0.55 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 1600 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_tea_shed.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「乡集茶棚」。
造型：四根竹柱撑起的方锥茅草棚，下面一张矮柜台、三只陶罐和一面朱砂布招。
尺寸：宽 3.2 m × 高 2.6 m × 深 2 m。檐口高约 1.8 m，棚顶最高 2.6 m；柜台高 0.55 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 1600 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_tea_shed.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Village Tea Shed".
Shape: A square thatched canopy on four bamboo posts, with a low counter, three ceramic jars and a small vermilion cloth banner.
Dimensions: 3.2 m W × 2.6 m H × 2 m D. 檐口高约 1.8 m，棚顶最高 2.6 m；柜台高 0.55 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 1600 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_tea_shed.glb.
```

### 青石井 · `env_well`

**游戏用途**：农舍区装饰

| 项 | 值 |
| --- | --- |
| 英文名 | Stone Village Well |
| 尺寸 (W×H×D) | 1.6 × 2.3 × 1.6 m |
| 比例 | 井身高 0.9 m，木架高 2.3 m，屋檐直径 1.6 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 1200 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_well.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「青石井」。
造型：青石砌成的圆井，井口有木架与横梁，顶上盖一小片青瓦顶，垂着绳与木桶。
尺寸：宽 1.6 m × 高 2.3 m × 深 1.6 m。井身高 0.9 m，木架高 2.3 m，屋檐直径 1.6 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 1200 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_well.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Stone Village Well".
Shape: A round stone well with a timber frame, a crossbeam, a small tiled roof, and a rope with a wooden bucket.
Dimensions: 1.6 m W × 2.3 m H × 1.6 m D. 井身高 0.9 m，木架高 2.3 m，屋檐直径 1.6 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 1200 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_well.glb.
```

### 草垛 · `env_haystack`

**游戏用途**：农事装饰

| 项 | 值 |
| --- | --- |
| 英文名 | Straw Haystack |
| 尺寸 (W×H×D) | 1.5 × 2 × 1.5 m |
| 比例 | 底部直径 1.5 m，草垛本体高 1.7 m，木杆高出 0.3 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 700 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_haystack.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「草垛」。
造型：圆锥形稻草垛，外圈三道草绳，中央插一根木杆，顶部收成尖顶。
尺寸：宽 1.5 m × 高 2 m × 深 1.5 m。底部直径 1.5 m，草垛本体高 1.7 m，木杆高出 0.3 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 700 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_haystack.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Straw Haystack".
Shape: A conical straw haystack bound by three straw ropes around a central pole, with a pointed top.
Dimensions: 1.5 m W × 2 m H × 1.5 m D. 底部直径 1.5 m，草垛本体高 1.7 m，木杆高出 0.3 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 700 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_haystack.glb.
```

### 竹筐 · `env_basket`

**游戏用途**：农事道具装饰

| 项 | 值 |
| --- | --- |
| 英文名 | Bamboo Harvest Basket |
| 尺寸 (W×H×D) | 0.9 × 0.65 × 0.9 m |
| 比例 | 口径 0.9 m，底径 0.65 m，高 0.65 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 500 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_basket.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「竹筐」。
造型：敞口圆竹筐，外壁由 8 根竹片围成，口沿与底沿各一道竹箍。
尺寸：宽 0.9 m × 高 0.65 m × 深 0.9 m。口径 0.9 m，底径 0.65 m，高 0.65 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 500 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_basket.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Bamboo Harvest Basket".
Shape: A round open bamboo harvest basket made from eight bamboo slats with a rim hoop and a base hoop.
Dimensions: 0.9 m W × 0.65 m H × 0.9 m D. 口径 0.9 m，底径 0.65 m，高 0.65 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 500 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_basket.glb.
```

### 陶瓮 · `env_jar`

**游戏用途**：茶棚/农舍道具

| 项 | 值 |
| --- | --- |
| 英文名 | Glazed Clay Jar |
| 尺寸 (W×H×D) | 0.85 × 1 × 0.85 m |
| 比例 | 腹部最大直径 0.85 m，口沿直径 0.5 m，盖顶高 1.0 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 600 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_jar.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「陶瓮」。
造型：鼓腹陶瓮，带小口与陶盖，腹部圆润，表面无釉光。
尺寸：宽 0.85 m × 高 1 m × 深 0.85 m。腹部最大直径 0.85 m，口沿直径 0.5 m，盖顶高 1.0 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 600 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_jar.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Glazed Clay Jar".
Shape: A round-bellied clay jar with a narrow mouth and a clay lid, matte unglazed surface.
Dimensions: 0.85 m W × 1 m H × 0.85 m D. 腹部最大直径 0.85 m，口沿直径 0.5 m，盖顶高 1.0 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 600 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_jar.glb.
```

### 竹篱 · `env_bamboo_fence`

**游戏用途**：田埂/院墙边界（2.4 m 一段，可拼接）

| 项 | 值 |
| --- | --- |
| 英文名 | Bamboo Fence Segment |
| 尺寸 (W×H×D) | 2.4 × 1.1 × 0.22 m |
| 比例 | 柱高 1.1 m，横杆高 0.34 m 与 0.72 m；深度仅 0.22 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 700 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_bamboo_fence.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「竹篱」。
造型：2.4 m 长的竹篱段：3–4 根立柱、上下两道横杆、交叉斜撑，柱顶削尖。左右两端需能无缝拼接。
尺寸：宽 2.4 m × 高 1.1 m × 深 0.22 m。柱高 1.1 m，横杆高 0.34 m 与 0.72 m；深度仅 0.22 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 700 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_bamboo_fence.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Bamboo Fence Segment".
Shape: A 2.4 m bamboo fence segment with three or four pointed posts, two horizontal rails and crossed diagonal ties. Both ends must tile seamlessly.
Dimensions: 2.4 m W × 1.1 m H × 0.22 m D. 柱高 1.1 m，横杆高 0.34 m 与 0.72 m；深度仅 0.22 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 700 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_bamboo_fence.glb.
```

### 松树 · `env_pine`

**游戏用途**：林木装饰（可替换两种树形）

| 项 | 值 |
| --- | --- |
| 英文名 | Chinese Pine |
| 尺寸 (W×H×D) | 2.6 × 4.5 × 2.6 m |
| 比例 | 冠幅约 2.6 m，树高 4.5 m；最下层冠幅最大，向上逐层收小。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 1200 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_pine.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「松树」。
造型：低多边形松树，主干略弯，四层不规则伞状松针冠，层与层之间留出空隙。
尺寸：宽 2.6 m × 高 4.5 m × 深 2.6 m。冠幅约 2.6 m，树高 4.5 m；最下层冠幅最大，向上逐层收小。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 1200 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_pine.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Chinese Pine".
Shape: A low-poly Chinese pine with a slightly bent trunk and four irregular umbrella-like needle layers with visible gaps.
Dimensions: 2.6 m W × 4.5 m H × 2.6 m D. 冠幅约 2.6 m，树高 4.5 m；最下层冠幅最大，向上逐层收小。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 1200 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_pine.glb.
```

### 竹丛 · `env_bamboo`

**游戏用途**：竹篱外景/遮挡装饰

| 项 | 值 |
| --- | --- |
| 英文名 | Bamboo Grove Cluster |
| 尺寸 (W×H×D) | 2 × 4.2 × 2 m |
| 比例 | 竹丛直径 2.0 m，最高竹竿 4.2 m，最矮 2.8 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 1600 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_bamboo.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「竹丛」。
造型：7 根高低错落的竹子组成一丛，竹节处有环状凸起，顶部 3–4 片细长竹叶。
尺寸：宽 2 m × 高 4.2 m × 深 2 m。竹丛直径 2.0 m，最高竹竿 4.2 m，最矮 2.8 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 1600 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_bamboo.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Bamboo Grove Cluster".
Shape: A cluster of seven bamboo stalks of varied heights with ring nodes and three or four slender leaves near the top.
Dimensions: 2 m W × 4.2 m H × 2 m D. 竹丛直径 2.0 m，最高竹竿 4.2 m，最矮 2.8 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 1600 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_bamboo.glb.
```

### 山石 · `env_rock`

**游戏用途**：散景岩石

| 项 | 值 |
| --- | --- |
| 英文名 | Mountain Rock |
| 尺寸 (W×H×D) | 1.6 × 0.9 × 1.4 m |
| 比例 | 横向较扁，高度约为宽度的 55%。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 400 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_rock.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「山石」。
造型：低多边形青灰山石，顶面较平，底部略宽，带 2–3 个自然切面。
尺寸：宽 1.6 m × 高 0.9 m × 深 1.4 m。横向较扁，高度约为宽度的 55%。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 400 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_rock.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Mountain Rock".
Shape: A low-poly grey mountain rock with a flatter top, wider base and two or three natural facets.
Dimensions: 1.6 m W × 0.9 m H × 1.4 m D. 横向较扁，高度约为宽度的 55%。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 400 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_rock.glb.
```

### 土地庙石灯 · `env_stone_lantern`

**游戏用途**：路旁石灯 / 土地庙（雕像槽位）

| 项 | 值 |
| --- | --- |
| 英文名 | Village Stone Lantern Shrine |
| 尺寸 (W×H×D) | 1.3 × 2.3 × 1.3 m |
| 比例 | 基座直径 1.3 m，灯室高 0.4 m，总高 2.3 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 800 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_stone_lantern.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「土地庙石灯」。
造型：石灯式小土地庙：圆形石基、方形石柱、灯室、四坡小石顶，灯室正面有一点暖光。
尺寸：宽 1.3 m × 高 2.3 m × 深 1.3 m。基座直径 1.3 m，灯室高 0.4 m，总高 2.3 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 800 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_stone_lantern.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Village Stone Lantern Shrine".
Shape: A small stone lantern shrine: round base, square pillar, lamp chamber, four-sided stone cap, and a warm glow on the front of the chamber.
Dimensions: 1.3 m W × 2.3 m H × 1.3 m D. 基座直径 1.3 m，灯室高 0.4 m，总高 2.3 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 800 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_stone_lantern.glb.
```

### 田棚 · `env_field_shelter`

**游戏用途**：田边歇脚棚

| 项 | 值 |
| --- | --- |
| 英文名 | Straw Field Shelter |
| 尺寸 (W×H×D) | 2 × 1.7 × 2.2 m |
| 比例 | 前檐高 1.2 m，后檐高 1.5 m，屋顶进深 2.0 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 900 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_field_shelter.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「田棚」。
造型：两坡茅草顶的简易田棚，后侧有挡风草墙，前面一张矮凳和一只竹筐。
尺寸：宽 2 m × 高 1.7 m × 深 2.2 m。前檐高 1.2 m，后檐高 1.5 m，屋顶进深 2.0 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 900 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_field_shelter.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Straw Field Shelter".
Shape: A simple field lean-to with a two-slope straw roof, a straw windbreak at the back, a low stool and a bamboo basket in front.
Dimensions: 2 m W × 1.7 m H × 2.2 m D. 前檐高 1.2 m，后檐高 1.5 m，屋顶进深 2.0 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 900 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_field_shelter.glb.
```

### 兽径柴门 · `env_beast_gate`

**游戏用途**：敌人出生点的山口/柴门

| 项 | 值 |
| --- | --- |
| 英文名 | Bamboo Beast-Path Gate |
| 尺寸 (W×H×D) | 2.8 × 3 × 1.2 m |
| 比例 | 门柱高 2.7 m，门宽 1.9 m，横梁离地 2.62 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 1400 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_beast_gate.glb`（GLB, glTF 2.0, +Y up） |
| 接入备注 | 子对象命名 Charms 用于飘动 |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「兽径柴门」。
造型：两根粗竹门柱加一道横梁的柴门，梁上垂五条布幡（米白与朱砂相间），门内是暗色山口。布幡需要单独子对象，以便轻微摆动。
尺寸：宽 2.8 m × 高 3 m × 深 1.2 m。门柱高 2.7 m，门宽 1.9 m，横梁离地 2.62 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 1400 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_beast_gate.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Bamboo Beast-Path Gate".
Shape: A bamboo gate with two thick posts and a lintel, five hanging cloth strips alternating rice-white and vermilion, and a dark mountain opening behind. The cloth strips should be a separate child object for gentle sway.
Dimensions: 2.8 m W × 3 m H × 1.2 m D. 门柱高 2.7 m，门宽 1.9 m，横梁离地 2.62 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 1400 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_beast_gate.glb.
```

### 社稷坛 · `env_shrine`

**游戏用途**：守望之种 / 核心目标祭坛

| 项 | 值 |
| --- | --- |
| 英文名 | Village Grain Altar |
| 尺寸 (W×H×D) | 4.6 × 2.2 × 4.6 m |
| 比例 | 底层直径 4.6 m，台高 0.6 m，谷灵中心离地约 1.5 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 2600 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_shrine.glb`（GLB, glTF 2.0, +Y up） |
| 接入备注 | 子对象 Crystal / Halo 用于旋转 |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「社稷坛」。
造型：三层圆形石台，四根石柱各立一束稻穗，中央悬浮由七束稻穗围成的金色谷灵，外有两道细光环。谷灵与光环需可独立旋转。
尺寸：宽 4.6 m × 高 2.2 m × 深 4.6 m。底层直径 4.6 m，台高 0.6 m，谷灵中心离地约 1.5 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 2600 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_shrine.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Village Grain Altar".
Shape: A three-tier round stone altar with four stone posts, each holding a rice sheaf; at the centre floats a golden grain spirit ringed by seven rice stalks and two thin halos. The grain spirit and halos must be separate rotating children.
Dimensions: 4.6 m W × 2.2 m H × 4.6 m D. 底层直径 4.6 m，台高 0.6 m，谷灵中心离地约 1.5 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 2600 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_shrine.glb.
```

### 梯田段 · `env_terrace`

**游戏用途**：东侧三级水田（菜单/俯瞰可见的场景地标）

| 项 | 值 |
| --- | --- |
| 英文名 | Terraced Field Segment |
| 尺寸 (W×H×D) | 12 × 2.6 × 6.2 m |
| 比例 | 三级台地每级高差 0.78 m，台面进深约 2.07 m；前层最宽 12 m，向上每层收窄约 2.2 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 2000 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_terrace.glb`（GLB, glTF 2.0, +Y up） |
| 接入备注 | 固定场景地标；不需要拼接。 |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「梯田段」。
造型：三级阶梯水田：每级有夯土挡墙、石砌田唇、浅水与成排秧苗，最高一级最窄，形成向内收的梯田轮廓。
尺寸：宽 12 m × 高 2.6 m × 深 6.2 m。三级台地每级高差 0.78 m，台面进深约 2.07 m；前层最宽 12 m，向上每层收窄约 2.2 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 2000 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_terrace.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Terraced Field Segment".
Shape: A three-tier paddy terrace: each tier has a packed-earth retaining wall, a stone lip, shallow water and rows of seedlings; the highest tier is the narrowest, giving the stepped inward silhouette of a terraced field.
Dimensions: 12 m W × 2.6 m H × 6.2 m D. 三级台地每级高差 0.78 m，台面进深约 2.07 m；前层最宽 12 m，向上每层收窄约 2.2 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 2000 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_terrace.glb.
```

### 晒谷架 · `env_drying_rack`

**游戏用途**：农事装饰

| 项 | 值 |
| --- | --- |
| 英文名 | Grain Drying Rack |
| 尺寸 (W×H×D) | 2.1 × 1.6 × 0.9 m |
| 比例 | 横杆跨度 1.8 m，三层高度 0.55/0.9/1.25 m，稻穗垂到 0.15 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 900 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_drying_rack.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「晒谷架」。
造型：两对木柱撑起三层横杆，横杆上倒挂五束稻穗；结构轻，适合放在田边。
尺寸：宽 2.1 m × 高 1.6 m × 深 0.9 m。横杆跨度 1.8 m，三层高度 0.55/0.9/1.25 m，稻穗垂到 0.15 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 900 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_drying_rack.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Grain Drying Rack".
Shape: Two pairs of timber posts supporting three rails, with five rice sheaves hung upside down from the rails; a light structure for the field edge.
Dimensions: 2.1 m W × 1.6 m H × 0.9 m D. 横杆跨度 1.8 m，三层高度 0.55/0.9/1.25 m，稻穗垂到 0.15 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 900 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_drying_rack.glb.
```

### 稻草人 · `env_scarecrow`

**游戏用途**：田边地标

| 项 | 值 |
| --- | --- |
| 英文名 | Scarecrow |
| 尺寸 (W×H×D) | 1.2 × 2.2 × 0.6 m |
| 比例 | 臂展 1.1 m，主体高 1.85 m，草帽直径 0.75 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。 |
| 面数预算 | ≤ 700 三角面 |
| 材质槽 | 米白素胎 / 墨灰瓦木 / 暖土 / 淡青 |
| 碰撞 | 不需要碰撞网格；游戏用 2D 圆形/矩形障碍体近似。 |
| 导出文件 | `public/assets/whitebox/env_scarecrow.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「稻草人」。
造型：木杆十字架撑起的稻草人，草帽、草裙、圆草头，脸上两点墨色眼睛。
尺寸：宽 1.2 m × 高 2.2 m × 深 0.6 m。臂展 1.1 m，主体高 1.85 m，草帽直径 0.75 m。
朝向：正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
面数预算：不超过 700 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 env_scarecrow.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Scarecrow".
Shape: A scarecrow on a wooden cross: straw hat, straw skirt, round straw head and two ink-dot eyes.
Dimensions: 1.2 m W × 2.2 m H × 0.6 m D. 臂展 1.1 m，主体高 1.85 m，草帽直径 0.75 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于地面几何中心。
Triangle budget: no more than 700 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file env_scarecrow.glb.
```

## 作物

### 金穗稻（成熟态） · `crop_rice`

**游戏用途**：作物 wheat 的成熟白模；游戏用同一模型缩放表现 4 个生长阶段

| 项 | 值 |
| --- | --- |
| 英文名 | Mature Golden Rice Clump |
| 尺寸 (W×H×D) | 0.9 × 1.3 × 0.9 m |
| 比例 | 冠幅 0.9 m，最高稻穗 1.3 m；稻穗约占顶部 1/3 高度。 |
| 朝向 | 径向对称，无固定正面；原点位于地面中心。 |
| 面数预算 | ≤ 900 三角面 |
| 材质槽 | 米白稻粒 / 淡青稻叶 / 暖土基部 |
| 碰撞 | 无需碰撞。 |
| 导出文件 | `public/assets/whitebox/crop_rice.glb`（GLB, glTF 2.0, +Y up） |
| 接入备注 | 游戏按 0.28/0.55/0.80/1.0 缩放表现生长阶段 |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「金穗稻（成熟态）」。
造型：一丛 11 根稻秆，稻穗下垂、带细芒，基部有一圈泥土。整体略呈圆形，便于从任意角度观看。
尺寸：宽 0.9 m × 高 1.3 m × 深 0.9 m。冠幅 0.9 m，最高稻穗 1.3 m；稻穗约占顶部 1/3 高度。
朝向：径向对称，无固定正面；原点位于地面中心。
面数预算：不超过 900 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 crop_rice.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Mature Golden Rice Clump".
Shape: A clump of eleven rice stalks with drooping, awned ears and a small soil base; roughly radial so it reads from any angle.
Dimensions: 0.9 m W × 1.3 m H × 0.9 m D. 冠幅 0.9 m，最高稻穗 1.3 m；稻穗约占顶部 1/3 高度。
Orientation: 径向对称，无固定正面；原点位于地面中心。
Triangle budget: no more than 900 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file crop_rice.glb.
```

### 暖阳瓜（成熟态） · `crop_pumpkin`

**游戏用途**：作物 pumpkin 的成熟白模；同一模型缩放表现生长阶段

| 项 | 值 |
| --- | --- |
| 英文名 | Mature Sun Gourd |
| 尺寸 (W×H×D) | 0.9 × 1.1 × 0.9 m |
| 比例 | 两只瓜直径 0.54 m / 0.42 m，藤蔓高 0.72 m；整体不高于 1.1 m。 |
| 朝向 | 径向对称，无固定正面；原点位于地面中心。 |
| 面数预算 | ≤ 900 三角面 |
| 材质槽 | 米白瓜身 / 淡青藤叶 / 浅金花 |
| 碰撞 | 无需碰撞。 |
| 导出文件 | `public/assets/whitebox/crop_pumpkin.glb`（GLB, glTF 2.0, +Y up） |
| 接入备注 | 游戏按 0.28/0.55/0.80/1.0 缩放表现生长阶段 |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「暖阳瓜（成熟态）」。
造型：一条主藤、五片掌状叶，两只大小不一的瓜，瓜面有浅棱，旁边一朵小黄花。
尺寸：宽 0.9 m × 高 1.1 m × 深 0.9 m。两只瓜直径 0.54 m / 0.42 m，藤蔓高 0.72 m；整体不高于 1.1 m。
朝向：径向对称，无固定正面；原点位于地面中心。
面数预算：不超过 900 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 crop_pumpkin.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Mature Sun Gourd".
Shape: A main vine with five palmate leaves, two gourds of different sizes with shallow ribs, and a small yellow flower.
Dimensions: 0.9 m W × 1.1 m H × 0.9 m D. 两只瓜直径 0.54 m / 0.42 m，藤蔓高 0.72 m；整体不高于 1.1 m。
Orientation: 径向对称，无固定正面；原点位于地面中心。
Triangle budget: no more than 900 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file crop_pumpkin.glb.
```

### 星辉花（成熟态） · `crop_starflower`

**游戏用途**：作物 flower 的成熟白模；同一模型缩放表现生长阶段

| 项 | 值 |
| --- | --- |
| 英文名 | Mature Starlight Bloom |
| 尺寸 (W×H×D) | 0.7 × 1.4 × 0.7 m |
| 比例 | 花朵直径 0.55 m，花心离地约 0.95 m，光环直径 0.5 m。 |
| 朝向 | 径向对称，无固定正面；原点位于地面中心。 |
| 面数预算 | ≤ 700 三角面 |
| 材质槽 | 米白花瓣 / 淡青茎叶 / 浅金花蕊 |
| 碰撞 | 无需碰撞。 |
| 导出文件 | `public/assets/whitebox/crop_starflower.glb`（GLB, glTF 2.0, +Y up） |
| 接入备注 | 发光花蕊请用独立材质槽 Emissive，方便游戏替换 |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「星辉花（成熟态）」。
造型：一根细茎、四片窄叶、七片米白花瓣，中心是一颗浅金发光花蕊，花下有一圈很淡的光环。
尺寸：宽 0.7 m × 高 1.4 m × 深 0.7 m。花朵直径 0.55 m，花心离地约 0.95 m，光环直径 0.5 m。
朝向：径向对称，无固定正面；原点位于地面中心。
面数预算：不超过 700 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 crop_starflower.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Mature Starlight Bloom".
Shape: A slender stem with four narrow leaves, seven rice-white petals, a pale-gold glowing centre and a faint halo below the bloom.
Dimensions: 0.7 m W × 1.4 m H × 0.7 m D. 花朵直径 0.55 m，花心离地约 0.95 m，光环直径 0.5 m。
Orientation: 径向对称，无固定正面；原点位于地面中心。
Triangle budget: no more than 700 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file crop_starflower.glb.
```

## 防御塔

### 竹风望楼 Lv.1 · `tower_bamboo`

**游戏用途**：防御塔 arrow 的基础白模；Lv.2/3 复用同一模型缩放并加等级珠

| 项 | 值 |
| --- | --- |
| 英文名 | Bamboo Watchtower Lv.1 |
| 尺寸 (W×H×D) | 2.15 × 3.9 × 2.15 m |
| 比例 | 塔基直径 2.15 m，台面高 2.36 m，屋脊高 3.95 m；塔身略上收。 |
| 朝向 | 正面（面向敌人的一侧）朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于塔基中心地面。 |
| 面数预算 | ≤ 2200 三角面 |
| 材质槽 | 米白墙体 / 墨灰瓦顶 / 竹木 / 浅金发光件 |
| 碰撞 | 无碰撞；地块尺寸 2.2 × 2.2 m，模型最大外径不超过 2.2 m。 |
| 导出文件 | `public/assets/whitebox/tower_bamboo.glb`（GLB, glTF 2.0, +Y up） |
| 接入备注 | 升级：整体放大 10%/20%，正面下方加 1/2 颗等级珠 |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「竹风望楼 Lv.1」。
造型：四根竹柱撑起的高台，台上小木屋、青瓦顶、朱砂布招和风向小旗；台沿有护栏。
尺寸：宽 2.15 m × 高 3.9 m × 深 2.15 m。塔基直径 2.15 m，台面高 2.36 m，屋脊高 3.95 m；塔身略上收。
朝向：正面（面向敌人的一侧）朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于塔基中心地面。
面数预算：不超过 2200 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 tower_bamboo.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Bamboo Watchtower Lv.1".
Shape: A raised bamboo watchtower on four posts, with a small timber cabin, dark tiled roof, vermilion banner and wind vane; railing around the platform.
Dimensions: 2.15 m W × 3.9 m H × 2.15 m D. 塔基直径 2.15 m，台面高 2.36 m，屋脊高 3.95 m；塔身略上收。
Orientation: 正面（面向敌人的一侧）朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于塔基中心地面。
Triangle budget: no more than 2200 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file tower_bamboo.glb.
```

### 石臼炮台 Lv.1 · `tower_mortar`

**游戏用途**：防御塔 cannon 的基础白模；Lv.2/3 复用同一模型缩放并加等级珠

| 项 | 值 |
| --- | --- |
| 英文名 | Stone Mortar Tower Lv.1 |
| 尺寸 (W×H×D) | 2.2 × 2.6 × 2.2 m |
| 比例 | 基座高 1.55 m，炮管中心离地 1.9 m，屋顶高 2.6 m；炮口伸出正面 0.5 m。 |
| 朝向 | 正面（面向敌人的一侧）朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于塔基中心地面。 |
| 面数预算 | ≤ 2000 三角面 |
| 材质槽 | 米白墙体 / 墨灰瓦顶 / 竹木 / 浅金发光件 |
| 碰撞 | 无碰撞；地块尺寸 2.2 × 2.2 m，模型最大外径不超过 2.2 m。 |
| 导出文件 | `public/assets/whitebox/tower_mortar.glb`（GLB, glTF 2.0, +Y up） |
| 接入备注 | 升级：整体放大 8%/16%，正面下方加等级珠 |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「石臼炮台 Lv.1」。
造型：方形石砌基座上一口石臼，臼中伸出竹木炮管，炮口朝正面；基座四角有石垛，顶上盖小青瓦顶。
尺寸：宽 2.2 m × 高 2.6 m × 深 2.2 m。基座高 1.55 m，炮管中心离地 1.9 m，屋顶高 2.6 m；炮口伸出正面 0.5 m。
朝向：正面（面向敌人的一侧）朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于塔基中心地面。
面数预算：不超过 2000 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 tower_mortar.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Stone Mortar Tower Lv.1".
Shape: A square stone base with a stone mortar, a bamboo-and-timber barrel project forward from the mortar, corner stone merlons and a small tiled roof.
Dimensions: 2.2 m W × 2.6 m H × 2.2 m D. 基座高 1.55 m，炮管中心离地 1.9 m，屋顶高 2.6 m；炮口伸出正面 0.5 m。
Orientation: 正面（面向敌人的一侧）朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于塔基中心地面。
Triangle budget: no more than 2000 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file tower_mortar.glb.
```

### 社火祭坛 Lv.1 · `tower_shrine`

**游戏用途**：防御塔 star 的基础白模；Lv.2/3 复用同一模型缩放并加等级珠

| 项 | 值 |
| --- | --- |
| 英文名 | Village Shrine Tower Lv.1 |
| 尺寸 (W×H×D) | 2.2 × 3.4 × 2.2 m |
| 比例 | 台基高 0.45 m，龛顶高 2.6 m，悬浮谷灵中心高 3.1 m；光环直径 1.3 m。 |
| 朝向 | 正面（面向敌人的一侧）朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于塔基中心地面。 |
| 面数预算 | ≤ 2400 三角面 |
| 材质槽 | 米白墙体 / 墨灰瓦顶 / 竹木 / 浅金发光件 |
| 碰撞 | 无碰撞；地块尺寸 2.2 × 2.2 m，模型最大外径不超过 2.2 m。 |
| 导出文件 | `public/assets/whitebox/tower_shrine.glb`（GLB, glTF 2.0, +Y up） |
| 接入备注 | 升级：整体放大 9%/18%，正面下方加等级珠；谷灵/光环需可独立旋转 |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「社火祭坛 Lv.1」。
造型：方形社坛：石台、四根白柱、中央神龛、青瓦小顶，龛顶悬浮一颗浅金谷灵与两道细光环。
尺寸：宽 2.2 m × 高 3.4 m × 深 2.2 m。台基高 0.45 m，龛顶高 2.6 m，悬浮谷灵中心高 3.1 m；光环直径 1.3 m。
朝向：正面（面向敌人的一侧）朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于塔基中心地面。
面数预算：不超过 2400 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 tower_shrine.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Village Shrine Tower Lv.1".
Shape: A square village altar with a stone platform, four white pillars, a central shrine, a small tiled roof, and a pale-gold grain spirit with two thin halos floating above.
Dimensions: 2.2 m W × 3.4 m H × 2.2 m D. 台基高 0.45 m，龛顶高 2.6 m，悬浮谷灵中心高 3.1 m；光环直径 1.3 m。
Orientation: 正面（面向敌人的一侧）朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于塔基中心地面。
Triangle budget: no more than 2400 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file tower_shrine.glb.
```

## 乡勇

### 竹弓手 · `guard_bowman`

**游戏用途**：乡勇 bowman 的基础白模；等级缩放 + 等级珠

| 项 | 值 |
| --- | --- |
| 英文名 | Bamboo Archer |
| 尺寸 (W×H×D) | 0.8 × 1.85 × 0.7 m |
| 比例 | 身高 1.85 m（含斗笠），肩宽 0.55 m，弓高 0.9 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。 |
| 面数预算 | ≤ 1400 三角面 |
| 材质槽 | 米白布衣 / 墨灰裤鞋 / 暖土肤色 / 草编斗笠 / 浅金等级珠 |
| 碰撞 | 无碰撞；占地格 2.2 × 2.2 m。 |
| 导出文件 | `public/assets/whitebox/guard_bowman.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「竹弓手」。
造型：戴斗笠、穿短打的猎户，左手持一张竹弓，背后斜插三支箭；站姿，双脚与肩同宽。
尺寸：宽 0.8 m × 高 1.85 m × 深 0.7 m。身高 1.85 m（含斗笠），肩宽 0.55 m，弓高 0.9 m。
朝向：正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。
面数预算：不超过 1400 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 guard_bowman.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Bamboo Archer".
Shape: A hunter in a straw hat and short jacket, holding a bamboo bow in the left hand with three arrows slung across the back; standing with feet shoulder-width apart.
Dimensions: 0.8 m W × 1.85 m H × 0.7 m D. 身高 1.85 m（含斗笠），肩宽 0.55 m，弓高 0.9 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。
Triangle budget: no more than 1400 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file guard_bowman.glb.
```

### 锄禾客 · `guard_hoeman`

**游戏用途**：乡勇 hoeman 的基础白模；等级缩放 + 等级珠

| 项 | 值 |
| --- | --- |
| 英文名 | Hoe Guard |
| 尺寸 (W×H×D) | 0.9 × 1.8 × 0.8 m |
| 比例 | 身高 1.8 m，锄柄长 0.9 m，锄刃宽 0.3 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。 |
| 面数预算 | ≤ 1300 三角面 |
| 材质槽 | 米白布衣 / 墨灰裤鞋 / 暖土肤色 / 草编斗笠 / 浅金等级珠 |
| 碰撞 | 无碰撞；占地格 2.2 × 2.2 m。 |
| 导出文件 | `public/assets/whitebox/guard_hoeman.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「锄禾客」。
造型：短打庄稼汉，双手斜握一把长柄锄头，锄刃朝前下方，重心略前倾。
尺寸：宽 0.9 m × 高 1.8 m × 深 0.8 m。身高 1.8 m，锄柄长 0.9 m，锄刃宽 0.3 m。
朝向：正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。
面数预算：不超过 1300 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 guard_hoeman.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Hoe Guard".
Shape: A farmhand in a short jacket gripping a long-handled hoe diagonally, blade forward and low, weight slightly forward.
Dimensions: 0.9 m W × 1.8 m H × 0.8 m D. 身高 1.8 m，锄柄长 0.9 m，锄刃宽 0.3 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。
Triangle budget: no more than 1300 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file guard_hoeman.glb.
```

### 田倌 · `guard_fieldhand`

**游戏用途**：乡勇 fieldhand 的基础白模；等级缩放 + 等级珠

| 项 | 值 |
| --- | --- |
| 英文名 | Field Keeper |
| 尺寸 (W×H×D) | 0.9 × 1.75 × 0.8 m |
| 比例 | 身高 1.75 m，竹耙高 0.95 m，秧篮直径 0.35 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。 |
| 面数预算 | ≤ 1300 三角面 |
| 材质槽 | 米白布衣 / 墨灰裤鞋 / 暖土肤色 / 草编斗笠 / 浅金等级珠 |
| 碰撞 | 无碰撞；占地格 2.2 × 2.2 m。 |
| 导出文件 | `public/assets/whitebox/guard_fieldhand.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「田倌」。
造型：背微驼的老农，戴斗笠，一手拿竹耙、一手提一只装秧苗的竹篮，脚边有泥。
尺寸：宽 0.9 m × 高 1.75 m × 深 0.8 m。身高 1.75 m，竹耙高 0.95 m，秧篮直径 0.35 m。
朝向：正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。
面数预算：不超过 1300 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 guard_fieldhand.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Field Keeper".
Shape: A slightly stooped old farmer in a straw hat, one hand holding a bamboo rake, the other carrying a basket of seedlings, with a little mud at his feet.
Dimensions: 0.9 m W × 1.75 m H × 0.8 m D. 身高 1.75 m，竹耙高 0.95 m，秧篮直径 0.35 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。
Triangle budget: no more than 1300 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file guard_fieldhand.glb.
```

### 采药人 · `guard_herbalist`

**游戏用途**：乡勇 herbalist 的基础白模；等级缩放 + 等级珠

| 项 | 值 |
| --- | --- |
| 英文名 | Herbalist |
| 尺寸 (W×H×D) | 0.85 × 1.8 × 1 m |
| 比例 | 身高 1.8 m，药篓高 0.5 m，葫芦高 0.25 m；纵深含药篓约 1.0 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。 |
| 面数预算 | ≤ 1500 三角面 |
| 材质槽 | 米白布衣 / 墨灰裤鞋 / 暖土肤色 / 草编斗笠 / 浅金等级珠 |
| 碰撞 | 无碰撞；占地格 2.2 × 2.2 m。 |
| 导出文件 | `public/assets/whitebox/guard_herbalist.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「采药人」。
造型：背药篓、挎葫芦的山民，药篓里插五束草药，一手捏一株草药。
尺寸：宽 0.85 m × 高 1.8 m × 深 1 m。身高 1.8 m，药篓高 0.5 m，葫芦高 0.25 m；纵深含药篓约 1.0 m。
朝向：正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。
面数预算：不超过 1500 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 guard_herbalist.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Herbalist".
Shape: A mountain herbalist with a herb basket on the back and a gourd at the waist; five herb bundles stick out of the basket and one herb is held in a hand.
Dimensions: 0.85 m W × 1.8 m H × 1 m D. 身高 1.8 m，药篓高 0.5 m，葫芦高 0.25 m；纵深含药篓约 1.0 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。
Triangle budget: no more than 1500 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file guard_herbalist.glb.
```

### 石匠 · `guard_mason`

**游戏用途**：乡勇 mason 的基础白模；等级缩放 + 等级珠

| 项 | 值 |
| --- | --- |
| 英文名 | Stone Mason |
| 尺寸 (W×H×D) | 0.9 × 1.85 × 0.8 m |
| 比例 | 身高 1.85 m，木锤长 0.5 m，脚边石料 0.24 m 见方。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。 |
| 面数预算 | ≤ 1500 三角面 |
| 材质槽 | 米白布衣 / 墨灰裤鞋 / 暖土肤色 / 草编斗笠 / 浅金等级珠 |
| 碰撞 | 无碰撞；占地格 2.2 × 2.2 m。 |
| 导出文件 | `public/assets/whitebox/guard_mason.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「石匠」。
造型：系皮围裙的石匠，右手提木锤、左手握凿子，脚边一块待凿的石料。
尺寸：宽 0.9 m × 高 1.85 m × 深 0.8 m。身高 1.85 m，木锤长 0.5 m，脚边石料 0.24 m 见方。
朝向：正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。
面数预算：不超过 1500 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 guard_mason.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Stone Mason".
Shape: A stone mason in a leather apron, holding a wooden mallet in the right hand and a chisel in the left, with a block of stone at his feet.
Dimensions: 0.9 m W × 1.85 m H × 0.8 m D. 身高 1.85 m，木锤长 0.5 m，脚边石料 0.24 m 见方。
Orientation: 正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。
Triangle budget: no more than 1500 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file guard_mason.glb.
```

### 稻灵 · `guard_ricespirit`

**游戏用途**：乡勇 ricespirit 的基础白模；等级缩放 + 等级珠

| 项 | 值 |
| --- | --- |
| 英文名 | Rice Spirit |
| 尺寸 (W×H×D) | 0.9 × 1.8 × 0.9 m |
| 比例 | 身高 1.8 m（含冠），光环直径 0.92 m，袍摆直径 0.7 m。 |
| 朝向 | 正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。 |
| 面数预算 | ≤ 1800 三角面 |
| 材质槽 | 米白布衣 / 墨灰裤鞋 / 暖土肤色 / 草编斗笠 / 浅金等级珠 |
| 碰撞 | 无碰撞；占地格 2.2 × 2.2 m。 |
| 导出文件 | `public/assets/whitebox/guard_ricespirit.glb`（GLB, glTF 2.0, +Y up） |
| 接入备注 | 子对象命名 Halo 用于旋转 |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「稻灵」。
造型：没有脚的稻穗精灵：米白长袍下摆散成草叶，头顶一圈七束小稻穗，身周一道细光环。光环需可独立旋转。
尺寸：宽 0.9 m × 高 1.8 m × 深 0.9 m。身高 1.8 m（含冠），光环直径 0.92 m，袍摆直径 0.7 m。
朝向：正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。
面数预算：不超过 1800 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 guard_ricespirit.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Rice Spirit".
Shape: A footless rice spirit: rice-white robe that frays into grass blades at the hem, a crown of seven small rice ears, and a thin halo around the body. The halo must be a separate child for rotation.
Dimensions: 0.9 m W × 1.8 m H × 0.9 m D. 身高 1.8 m（含冠），光环直径 0.92 m，袍摆直径 0.7 m。
Orientation: 正面朝 Blender -Y（Front 视图），导出后朝 Three.js +Z；原点位于双脚之间的地面中心。
Triangle budget: no more than 1800 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file guard_ricespirit.glb.
```

## 野兽

### 赤狐 · `enemy_fox`

**游戏用途**：敌人 fox 的基础白模

| 项 | 值 |
| --- | --- |
| 英文名 | Ember Fox |
| 尺寸 (W×H×D) | 1 × 0.9 × 1.8 m |
| 比例 | 肩高 0.55 m，体长 1.2 m，尾长 0.65 m；整体高不超过 0.9 m。 |
| 朝向 | 头朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于四足之间的地面中心。 |
| 面数预算 | ≤ 1100 三角面 |
| 材质槽 | 米白/墨灰皮毛 / 暖土蹄角 / 朱砂或浅金眼睛 |
| 碰撞 | 无碰撞；游戏沿路径移动并做 2D 近似。 |
| 导出文件 | `public/assets/whitebox/enemy_fox.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「赤狐」。
造型：体型轻巧的狐狸：尖耳、长吻、蓬松大尾，四肢细长，眼睛两点朱砂。
尺寸：宽 1 m × 高 0.9 m × 深 1.8 m。肩高 0.55 m，体长 1.2 m，尾长 0.65 m；整体高不超过 0.9 m。
朝向：头朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于四足之间的地面中心。
面数预算：不超过 1100 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 enemy_fox.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Ember Fox".
Shape: A light-built fox with pointed ears, long muzzle, a big bushy tail, slender legs and two vermilion eyes.
Dimensions: 1 m W × 0.9 m H × 1.8 m D. 肩高 0.55 m，体长 1.2 m，尾长 0.65 m；整体高不超过 0.9 m。
Orientation: 头朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于四足之间的地面中心。
Triangle budget: no more than 1100 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file enemy_fox.glb.
```

### 灰狼 · `enemy_wolf`

**游戏用途**：敌人 wolf 的基础白模

| 项 | 值 |
| --- | --- |
| 英文名 | Grey Wolf |
| 尺寸 (W×H×D) | 1.2 × 1.1 × 2.1 m |
| 比例 | 肩高 0.72 m，体长 1.45 m，尾长 0.55 m。 |
| 朝向 | 头朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于四足之间的地面中心。 |
| 面数预算 | ≤ 1300 三角面 |
| 材质槽 | 米白/墨灰皮毛 / 暖土蹄角 / 朱砂或浅金眼睛 |
| 碰撞 | 无碰撞；游戏沿路径移动并做 2D 近似。 |
| 导出文件 | `public/assets/whitebox/enemy_wolf.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「灰狼」。
造型：比狐狸更高大的狼：竖耳、窄胸、长尾下垂，四肢肌肉感更强，眼睛浅金。
尺寸：宽 1.2 m × 高 1.1 m × 深 2.1 m。肩高 0.72 m，体长 1.45 m，尾长 0.55 m。
朝向：头朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于四足之间的地面中心。
面数预算：不超过 1300 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 enemy_wolf.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Grey Wolf".
Shape: A taller wolf with erect ears, a narrow chest, a long lowered tail, stronger legs and pale-gold eyes.
Dimensions: 1.2 m W × 1.1 m H × 2.1 m D. 肩高 0.72 m，体长 1.45 m，尾长 0.55 m。
Orientation: 头朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于四足之间的地面中心。
Triangle budget: no more than 1300 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file enemy_wolf.glb.
```

### 荒角野猪 · `enemy_boar`

**游戏用途**：敌人 bull 的基础白模

| 项 | 值 |
| --- | --- |
| 英文名 | Wild Boar |
| 尺寸 (W×H×D) | 1.6 × 1.4 × 2.4 m |
| 比例 | 肩高 0.95 m，体长 1.7 m，獠牙长 0.3 m。 |
| 朝向 | 头朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于四足之间的地面中心。 |
| 面数预算 | ≤ 1500 三角面 |
| 材质槽 | 米白/墨灰皮毛 / 暖土蹄角 / 朱砂或浅金眼睛 |
| 碰撞 | 无碰撞；游戏沿路径移动并做 2D 近似。 |
| 导出文件 | `public/assets/whitebox/enemy_boar.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「荒角野猪」。
造型：粗壮的野猪：背部隆起、短颈、獠牙上翘、耳朵小而尖，四肢短粗。
尺寸：宽 1.6 m × 高 1.4 m × 深 2.4 m。肩高 0.95 m，体长 1.7 m，獠牙长 0.3 m。
朝向：头朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于四足之间的地面中心。
面数预算：不超过 1500 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 enemy_boar.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "Wild Boar".
Shape: A stocky wild boar with a humped back, short neck, upturned tusks, small pointed ears and short thick legs.
Dimensions: 1.6 m W × 1.4 m H × 2.4 m D. 肩高 0.95 m，体长 1.7 m，獠牙长 0.3 m。
Orientation: 头朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于四足之间的地面中心。
Triangle budget: no more than 1500 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file enemy_boar.glb.
```

### 白鹿王（Boss） · `enemy_stag`

**游戏用途**：敌人 stag 的基础白模；Boss 光环由游戏另加

| 项 | 值 |
| --- | --- |
| 英文名 | White Stag Boss |
| 尺寸 (W×H×D) | 2 × 2.4 × 2.8 m |
| 比例 | 肩高 1.5 m，鹿角尖高 2.4 m，体长 2.0 m。 |
| 朝向 | 头朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于四足之间的地面中心。 |
| 面数预算 | ≤ 1800 三角面 |
| 材质槽 | 米白/墨灰皮毛 / 暖土蹄角 / 朱砂或浅金眼睛 |
| 碰撞 | 无碰撞；游戏沿路径移动并做 2D 近似。 |
| 导出文件 | `public/assets/whitebox/enemy_stag.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「白鹿王（Boss）」。
造型：高大的白鹿王：分叉鹿角、修长四肢、高抬头颈，通体米白，眼睛浅金；脚下有游戏叠加的光环。
尺寸：宽 2 m × 高 2.4 m × 深 2.8 m。肩高 1.5 m，鹿角尖高 2.4 m，体长 2.0 m。
朝向：头朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于四足之间的地面中心。
面数预算：不超过 1800 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 enemy_stag.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "White Stag Boss".
Shape: A tall white stag king with branching antlers, long legs, a raised head and neck, rice-white body and pale-gold eyes; the game adds a boss aura at its feet.
Dimensions: 2 m W × 2.4 m H × 2.8 m D. 肩高 1.5 m，鹿角尖高 2.4 m，体长 2.0 m。
Orientation: 头朝 Blender -Y（Front 视图），导出后在 Three.js 中朝 +Z；原点位于四足之间的地面中心。
Triangle budget: no more than 1800 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file enemy_stag.glb.
```

## 玩家

### 守望者（第三人称） · `player_farmer`

**游戏用途**：俯瞰视角下可见的玩家角色

| 项 | 值 |
| --- | --- |
| 英文名 | First-Person Farmer Avatar |
| 尺寸 (W×H×D) | 0.7 × 1.9 × 0.5 m |
| 比例 | 身高 1.9 m（含斗笠），肩宽 0.54 m，头身比约 1:6。 |
| 朝向 | 角色正脸朝 Blender +Y（Back 视图），导出后在 Three.js 中朝 -Z；原点位于双脚之间的地面中心。 |
| 面数预算 | ≤ 1400 三角面 |
| 材质槽 | 米白上衣 / 墨灰长裤 / 暖土肤色 / 草编斗笠 |
| 碰撞 | 无碰撞；仅视觉。 |
| 导出文件 | `public/assets/whitebox/player_farmer.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「守望者（第三人称）」。
造型：戴斗笠、穿米白短衫与墨灰裤的年轻守望者，背后可加一顶小斗篷；模型需分出头、躯干、双臂、双腿四组，以便走路摆动。
尺寸：宽 0.7 m × 高 1.9 m × 深 0.5 m。身高 1.9 m（含斗笠），肩宽 0.54 m，头身比约 1:6。
朝向：角色正脸朝 Blender +Y（Back 视图），导出后在 Three.js 中朝 -Z；原点位于双脚之间的地面中心。
面数预算：不超过 1400 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 player_farmer.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "First-Person Farmer Avatar".
Shape: A young farmer in a straw hat, rice-white jacket and ink-grey trousers, with an optional short cape; head, torso, two arms and two legs must be separate groups for walking animation.
Dimensions: 0.7 m W × 1.9 m H × 0.5 m D. 身高 1.9 m（含斗笠），肩宽 0.54 m，头身比约 1:6。
Orientation: 角色正脸朝 Blender +Y（Back 视图），导出后在 Three.js 中朝 -Z；原点位于双脚之间的地面中心。
Triangle budget: no more than 1400 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file player_farmer.glb.
```

### 第一人称锄头 · `player_hoe`

**游戏用途**：第一人称手持道具

| 项 | 值 |
| --- | --- |
| 英文名 | First-Person Hoe Viewmodel |
| 尺寸 (W×H×D) | 0.4 × 1 × 0.7 m |
| 比例 | 柄长 0.92 m，刃宽 0.26 m；握把位于柄的 1/3 处。 |
| 朝向 | 按第一人称视图建模：锄刃朝 Blender -Y（画面深处），木柄从右下向左上延伸；原点位于握把中心。 |
| 面数预算 | ≤ 300 三角面 |
| 材质槽 | 木柄 / 墨灰铁刃 / 暖土肤色 |
| 碰撞 | 无碰撞；仅视觉。 |
| 导出文件 | `public/assets/whitebox/player_hoe.glb`（GLB, glTF 2.0, +Y up） |

**Blender MCP 提示词（中文，直接复制）**

```text
用 Blender MCP 创建一个低多边形白模占位资产：「第一人称锄头」。
造型：一把短柄锄：木柄、墨灰铁锄刃、握柄处一只暖土色手。只做右侧近景，不需要完整角色。
尺寸：宽 0.4 m × 高 1 m × 深 0.7 m。柄长 0.92 m，刃宽 0.26 m；握把位于柄的 1/3 处。
朝向：按第一人称视图建模：锄刃朝 Blender -Y（画面深处），木柄从右下向左上延伸；原点位于握把中心。
面数预算：不超过 300 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。
风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。
导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 player_hoe.glb。
```

**Blender MCP prompt (English)**

```text
Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "First-Person Hoe Viewmodel".
Shape: A short-handled hoe: wooden shaft, ink-grey iron blade, and a warm-earth hand gripping the shaft. Only the right-side viewmodel is needed; no full character.
Dimensions: 0.4 m W × 1 m H × 0.7 m D. 柄长 0.92 m，刃宽 0.26 m；握把位于柄的 1/3 处。
Orientation: 按第一人称视图建模：锄刃朝 Blender -Y（画面深处），木柄从右下向左上延伸；原点位于握把中心。
Triangle budget: no more than 300 triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.
Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).
Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file player_hoe.glb.
```

## 3. 一致性检查

- 清单中的每个 id 都在 `src/game/models.ts` 的 `WHITEBOX_BUILDERS` 注册表里有对应构建器；
- `?gallery=1` 白模陈列页按本清单渲染，缺项会在页面和验收脚本中报错；
- 游戏内实际使用的作物/防御塔/乡勇/野兽/环境模型都来自同一注册表，避免「文档有、游戏没有」或反过来。

