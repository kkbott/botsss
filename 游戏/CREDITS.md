# 资源来源与许可证清单 · Credits & licenses

本项目历史版本使用的外部美术资源都经过逐项许可证核查，只使用 **CC0 1.0** 素材。
外部资源只作为成品游戏的一部分使用，不单独再分发素材包。所有资源均可用于
商业与非商业项目，CC0 不强制署名；这里仍然保留完整可追溯记录。

> **v3 中国田园白模季（2026-11）**：当前 `游戏/` 构建**不加载任何外部 GLB**，
> 场景、作物、防御塔、乡勇、野兽与玩家全部是 `src/game/models.ts` 里的无贴图
> 程序化白模。下面第 1、2 节的 CC0 文件仍保留在 `public/assets/` 作为历史对照与
> 许可证追溯，但 v3 的运行时与生产构建都不引用它们；如果之后恢复外部素材加载，
> 仍然适用同样的 CC0 许可与署名记录。白模的 36 件占位清单与 Blender MCP 提示词见
> [`docs/whitebox-blender-prompts.md`](docs/whitebox-blender-prompts.md)。
>
> 结论：v3 的视觉资产没有来源不明、许可证不清或仅渲染图的外部文件；白模由纯代码生成。

## 1. Quaternius（CC0 1.0）

上游页面在下载时（2026-11-10）的 License 字段均链接到
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)；具体证据与
快照见 [`public/assets/quaternius/LICENSE-EVIDENCE.md`](public/assets/quaternius/LICENSE-EVIDENCE.md)。
GLB 文件取自公开镜像
[`trebeljahr/quaternius-showcase`](https://github.com/trebeljahr/quaternius-showcase)。

| 资源包 | 上游页面 / 下载镜像 | 许可证 | 本项目使用文件 |
| --- | --- | --- | --- |
| Ultimate Crops Pack | https://quaternius.com/packs/ultimatecrops.html<br>https://github.com/trebeljahr/quaternius-showcase/tree/main/public/glb/crops_pack | CC0 1.0 | `quaternius/crops/Wheat_1..4.glb`、`Pumpkin_1..4.glb`、`Flower_1..4.glb` |
| Ultimate Animated Animal Pack | https://quaternius.com/packs/ultimateanimatedanimals.html<br>https://github.com/trebeljahr/quaternius-showcase/tree/main/public/glb/animals_pack | CC0 1.0 | `Fox.glb`、`Wolf.glb`、`Bull.glb`、`Stag.glb` |
| Ultimate Fantasy RTS | https://quaternius.com/packs/ultimatefantasyrts.html<br>https://github.com/trebeljahr/quaternius-showcase/tree/main/public/glb/real_time_strategy_pack | CC0 1.0 | `WatchTower_FirstAge_Level1..3.glb`、`WatchTower_SecondAge_Level1..3.glb`、`Temple_SecondAge_Level1..3.glb`、`Windmill_FirstAge.glb`、`Rock.glb`、`Rock_Group.glb` |
| Medieval Village Pack | https://quaternius.com/packs/medievalvillage.html<br>https://github.com/trebeljahr/quaternius-showcase/tree/main/public/glb/medieval_village_pack | CC0 1.0 | `House_1.glb`、`MarketStand_1.glb`、`Well.glb`、`Hay.glb`、`Crate.glb`、`Barrel.glb`、`Fence.glb` |
| Ultimate Nature Pack | https://quaternius.com/packs/ultimatenature.html<br>https://github.com/trebeljahr/quaternius-showcase/tree/main/public/glb/nature_pack | CC0 1.0 | `CommonTree_1.glb`、`CommonTree_Autumn_2.glb`、`BirchTree_1.glb`、`Bush_1.glb`、`BushBerries_1.glb` |

修改说明：运行时对材质做了统一色调、对模型做了比例归一化与动画播放；不改动许可证。

## 2. Kenney · Nature Kit 2.1（CC0 1.0）

- 来源：https://kenney.nl/assets/nature-kit
- 许可证原文：[`public/assets/kenney/License.txt`](public/assets/kenney/License.txt)
  （Creative Commons Zero, CC0；允许个人、教育、商业项目使用）。
- 本项目使用文件（全部位于 `public/assets/kenney/`）：
  - 树木：`tree_pineTallA.glb`、`tree_pineRoundA.glb`、`tree_oak.glb`、`tree_small.glb`
  - 岩石/石头：`rock_largeA.glb`、`rock_largeC.glb`、`rock_tallA.glb`
  - 花草：`flower_purpleA.glb`、`flower_yellowA.glb`、`flower_redA.glb`、`grass.glb`、`grass_large.glb`、`mushroom_red.glb`、`mushroom_tan.glb`、`lily_large.glb`
  - 道具：`path_stone.glb`、`path_stoneCircle.glb`、`stump_round.glb`、`log.glb`、`pot_large.glb`、`pot_small.glb`、`statue_column.glb`、`statue_obelisk.glb`、`tent_smallClosed.glb`、`fence_simple.glb`、`fence_gate.glb`、`campfire_logs.glb`、`plant_bush.glb`、`plant_bushDetailed.glb`
- 修改说明：运行时将 unlit 材质转换为受光材质并按项目调色板重着色；不改动许可证。

## 3. 评估但未采用的来源

**CC0Tree**（https://github.com/SkywolfGameStudios/CC0Tree，CC0 1.0）在立项时被优先考察。
其公开仓库只包含 FBX 几何体，而 FBX 内引用的 `base_color_texture` 位图不在仓库中
（只有渲染缩略图），也缺少本项目需要的作物生长阶段与低多边形统一配色。为保证“所有
外部资源都能在构建产物中完整、正确地呈现”和视觉一致性，本项目没有采用 CC0Tree 文件，
也没有将其放入 `public/assets/`；改由 Quaternius + Kenney 的 CC0/GLB 资源承担外部美术。

## 4. 程序化生成兜底清单

以下内容没有外部模型依赖，由 Three.js / WebAudio 代码生成；v3 起它们是**唯一运行时美术**，不再是“兜底”：

- 浮空岛地形、草皮、岩石挂坠、小浮岛、路径飘带、农田土床/木框、石台、守望之种圣坛与光柱、传送门、云朵、太阳光晕。
- v3 中国田园白模：36 件占位物（18 环境/建筑、3 作物、3 塔、6 乡勇、4 野兽、2 玩家），逐项对应 `src/game/whitebox-assets.json` 与 Blender MCP 提示词。
- 作物 4 阶段、塔 3 级、乡勇 3 阶通过同一白模的缩放 + 等级珠表达；正式 GLB 可按清单逐件替换。
- 塔顶的发光符文/旋转光环、敌人脚下色环、Boss 光环。
- 粒子、飘字、屏幕受击闪光、相机反馈。
- 音效与轻量环境音乐全部由 WebAudio 合成，无外部音频素材。
- UI 图标使用系统 emoji；字体使用系统字体栈，无外部字体文件。

## 5. 代码与工具

- [Three.js](https://threejs.org/) — MIT License。
- [Vite](https://vitejs.dev/) — MIT License。
- TypeScript、Playwright 与 npm 依赖的许可证见各自包。
