import fs from 'node:fs';
import path from 'node:path';

/**
 * Generates docs/whitebox-blender-prompts.md from the single source of truth in
 * src/game/whitebox-assets.json. Run with `npm run docs:whitebox`.
 */
const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/game/whitebox-assets.json'), 'utf8'));
const out = path.join(root, 'docs/whitebox-blender-prompts.md');

const categoryOrder = ['environment', 'crop', 'tower', 'guardian', 'enemy', 'player'];
const categoryNames = {
  environment: '环境与建筑',
  crop: '作物',
  tower: '防御塔',
  guardian: '乡勇',
  enemy: '野兽',
  player: '玩家',
};

function promptZh(item) {
  return [
    `用 Blender MCP 创建一个低多边形白模占位资产：「${item.name}」。`,
    `造型：${item.description}`,
    `尺寸：宽 ${item.dimensions.width} m × 高 ${item.dimensions.height} m × 深 ${item.dimensions.depth} m。${item.proportions}`,
    `朝向：${item.orientation}`,
    `面数预算：不超过 ${item.triangles} 个三角面（目标可再低 20%）。平面着色，不要贴图、法线贴图或纹理材质；只用少量纯色材质槽区分结构。`,
    `风格：中国田园水墨素模，意象参考青瓦白墙、梯田、稻穗、竹篱；配色只使用米白（#f2efe6）、墨灰（#4b514c）、暖土（#b09571）、淡青（#8d9f87）和少量朱砂（#a84b38）。`,
    `导出：glTF 2.0 二进制 GLB，+Y up，应用变换，原点位于模型底部几何中心，1 单位 = 1 米；文件命名为 ${item.id}.glb。`,
  ].join('\n');
}

function promptEn(item) {
  return [
    `Create a low-poly white-box placeholder asset for a Chinese pastoral farming game: "${item.en}".`,
    `Shape: ${item.descriptionEn}`,
    `Dimensions: ${item.dimensions.width} m W × ${item.dimensions.height} m H × ${item.dimensions.depth} m D. ${item.proportions}`,
    `Orientation: ${item.orientation}`,
    `Triangle budget: no more than ${item.triangles} triangles (20% lower is better). Flat shading, no textures, no normal maps, no image materials; use only a few flat colour slots to separate structure.`,
    `Style: Chinese pastoral ink-wash white-box; reference whitewashed walls with grey tile roofs, terraced fields, rice ears and bamboo fences; palette limited to rice-paper white (#f2efe6), ink grey (#4b514c), warm earth (#b09571), pale jade (#8d9f87) and a little vermilion (#a84b38).`,
    `Export: binary glTF 2.0 GLB, +Y up, apply transforms, origin at the bottom-centre of the geometry, 1 unit = 1 metre; name the file ${item.id}.glb.`,
  ].join('\n');
}

const lines = [];
lines.push(`# 《穗守》白模占位与 Blender MCP 生成提示词`);
lines.push('');
lines.push(`> 版本：v3 中国田园白模季 · 自动生成自 [\`src/game/whitebox-assets.json\`](../src/game/whitebox-assets.json)。`);
lines.push(`> 生成命令：\`npm run docs:whitebox\`。请勿手工编辑本文件，改清单后重新生成。`);
lines.push('');
lines.push(`## 0. 这份文档解决什么`);
lines.push('');
lines.push(`《穗守》v3 不再加载任何外部 GLB，全部场景物件都是程序化白模（无贴图、平面着色、低多边形）。这样做的原因：`);
lines.push('');
lines.push(`- 没有找到同时满足「中国田园（青瓦白墙、梯田、稻穗、竹篱）」和「可商用许可」的现成素材包；`);
lines.push(`- 宁可用统一的白模占位，也不使用来源不明或许可证不清的资产；`);
lines.push(`- 每个占位物都给出尺寸、比例、朝向、面数预算、风格参考和 GLB 导出参数，方便你之后用 Blender MCP 生成正式模型逐个替换。`);
lines.push('');
lines.push(`**清单规模：${manifest.items.length} 个占位物**，与游戏中的模型 id 一一对应。白模不是最终美术，而是可替换的骨架。`);
lines.push('');
lines.push(`## 1. 通用生成约定`);
lines.push('');
lines.push(`| 项 | 约定 |`);
lines.push(`| --- | --- |`);
lines.push(`| 单位 | 1 Blender 单位 = 1 米；游戏内模型按真实比例构建 |`);
lines.push(`| 朝向 | Three.js 的 +Z 是模型正面，对应 Blender 的 **-Y**（Front 视图）。若模型正脸朝 Three.js -Z（仅玩家角色），对应 Blender **+Y**。 |`);
lines.push(`| 原点 | 模型底部几何中心（树/建筑/角色都落在 y = 0），方便直接放到地块坐标 |`);
lines.push(`| 导出 | glTF 2.0 二进制 **GLB**，+Y up，应用旋转与缩放 |`);
lines.push(`| 面数 | 每项都给出三角面预算；目标是在 2.2 × 2.2 m 地块上远看仍有清晰剪影 |`);
lines.push(`| 材质 | 无贴图、无 UV 纹理、平面着色；每项 2–5 个纯色材质槽，按结构分色即可 |`);
lines.push(`| 命名 | \`<id>.glb\`，例如 \`env_house.glb\`；id 见下表 |`);
lines.push(`| 碰撞 | 不要做碰撞体；游戏用 2D 近似障碍，正式模型只需外观 |`);
lines.push(`| 动画 | 水车轮、稻灵光环、兽径布幡等是独立子对象，提示词中已标注；其余为静态 |`);
lines.push('');
lines.push(`### 配色（唯一允许的调色板）`);
lines.push('');
lines.push(`| 名称 | 色值 | 用途 |`);
lines.push(`| --- | --- | --- |`);
const paletteNames = {
  paper: '米白（白墙、布衣、稻粒）',
  paperShade: '暖白（阴影面、石基）',
  ink: '墨灰（瓦顶、梁柱、眼睛）',
  inkSoft: '中墨（石材、阴影结构）',
  earth: '暖土（土、木、皮肤）',
  straw: '草黄（稻草、斗笠、稻穗）',
  jade: '淡青（植物、竹）',
  vermilion: '朱砂（门、布招、眼睛；少量）',
  glow: '浅金（发光件、等级珠）',
};
for (const [key, label] of Object.entries(paletteNames)) lines.push(`| ${label} | \`${manifest.palette[key]}\` | 结构分色 |`);
lines.push('');
lines.push(`### 白模替换流程（生成之后）`);
lines.push('');
lines.push(`1. 在 Blender 中按对应条目的提示词生成模型，检查朝向、原点和面数；`);
lines.push(`2. 导出为 \`<id>.glb\`，放进 \`游戏/public/assets/whitebox/\`；`);
lines.push(`3. 目前 v3 默认使用程序化白模，**不自动加载** GLB；要做正式替换，需要在 \`main.ts\` / \`models.ts\` 里接入 GLTFLoader，并按 id 替换对应构建器（本季不包含自动替换逻辑，避免把未验证的加载路径混进验收）；`);
lines.push(`4. 运行 \`npm run build\` 和 \`npm run verify\`，确认场景无破面、无悬空、无缩放过大的模型。`);
lines.push('');
lines.push(`> 诚实说明：v3 当前的验收只覆盖**白模占位**；本仓库没有随附正式 GLB，也没有把生成后的模型接入构建。提示词的作用是让你可以自己替换，而不是声称已经替换。`);
lines.push('');
lines.push(`## 2. 清单总表`);
lines.push('');
lines.push(`| # | id | 名称 | 类别 | 尺寸 (W×H×D, m) | 面数预算 | 游戏用途 |`);
lines.push(`| --- | --- | --- | --- | --- | --- | --- |`);
const grouped = new Map(categoryOrder.map((c) => [c, []]));
for (const item of manifest.items) grouped.get(item.category)?.push(item);
let n = 0;
for (const category of categoryOrder) {
  for (const item of grouped.get(category) ?? []) {
    n += 1;
    lines.push(`| ${n} | [\`${item.id}\`](#${item.anchor}) | ${item.name} | ${categoryNames[category]} | ${item.dimensions.width} × ${item.dimensions.height} × ${item.dimensions.depth} | ${item.triangles} | ${item.gameRole} |`);
  }
}
lines.push('');
for (const category of categoryOrder) {
  const entries = grouped.get(category) ?? [];
  if (entries.length === 0) continue;
  lines.push(`## ${categoryNames[category]}`);
  lines.push('');
  for (const item of entries) {
    lines.push(`### ${item.name} · \`${item.id}\``);
    lines.push('');
    lines.push(`**游戏用途**：${item.gameRole}`);
    lines.push('');
    lines.push(`| 项 | 值 |`);
    lines.push(`| --- | --- |`);
    lines.push(`| 英文名 | ${item.en} |`);
    lines.push(`| 尺寸 (W×H×D) | ${item.dimensions.width} × ${item.dimensions.height} × ${item.dimensions.depth} m |`);
    lines.push(`| 比例 | ${item.proportions} |`);
    lines.push(`| 朝向 | ${item.orientation} |`);
    lines.push(`| 面数预算 | ≤ ${item.triangles} 三角面 |`);
    lines.push(`| 材质槽 | ${item.materials.join(' / ')} |`);
    lines.push(`| 碰撞 | ${item.collision} |`);
    lines.push(`| 导出文件 | \`${item.file}\`（GLB, glTF 2.0, +Y up） |`);
    if (item.notes) lines.push(`| 接入备注 | ${item.notes} |`);
    lines.push('');
    lines.push(`**Blender MCP 提示词（中文，直接复制）**`);
    lines.push('');
    lines.push('```text');
    lines.push(promptZh(item));
    lines.push('```');
    lines.push('');
    lines.push(`**Blender MCP prompt (English)**`);
    lines.push('');
    lines.push('```text');
    lines.push(promptEn(item));
    lines.push('```');
    lines.push('');
  }
}
lines.push(`## 3. 一致性检查`);
lines.push('');
lines.push(`- 清单中的每个 id 都在 \`src/game/models.ts\` 的 \`WHITEBOX_BUILDERS\` 注册表里有对应构建器；`);
lines.push(`- \`?gallery=1\` 白模陈列页按本清单渲染，缺项会在页面和验收脚本中报错；`);
lines.push(`- 游戏内实际使用的作物/防御塔/乡勇/野兽/环境模型都来自同一注册表，避免「文档有、游戏没有」或反过来。`);
lines.push('');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${lines.join('\n')}\n`);
console.log(`Wrote ${out} (${manifest.items.length} items, ${lines.length} lines)`);
