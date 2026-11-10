import './style.css';
import { Game } from './game/game';
import { AssetArt, AssetLibrary, EnvironmentAssets } from './game/assets';
import { ProceduralArt } from './game/models';

const canvasElement = document.getElementById('scene');
if (!(canvasElement instanceof HTMLCanvasElement)) {
  throw new Error('Missing WebGL canvas');
}
const canvas: HTMLCanvasElement = canvasElement;

const loadingFill = document.getElementById('loading-fill');
const loadingNote = document.getElementById('loading-note');

function setLoading(fraction: number, label: string) {
  if (loadingFill) loadingFill.style.width = `${Math.max(2, Math.min(100, fraction * 100)).toFixed(1)}%`;
  if (loadingNote && label) loadingNote.textContent = label;
}

async function boot() {
  const library = new AssetLibrary();
  try {
    await library.loadAll(setLoading);
  } catch (error) {
    console.warn('Asset loading failed; procedural art will be used.', error);
  }
  if (library.errors.length > 0) {
    console.warn(`[assets] ${library.errors.length} file(s) could not be loaded`, library.errors);
  }
  const useAssets = library.size > 0;
  const art = useAssets ? new AssetArt(library) : new ProceduralArt();
  let environment: EnvironmentAssets | null = null;
  try {
    environment = useAssets ? new EnvironmentAssets(library) : null;
  } catch (error) {
    console.warn('Environment asset preparation failed; procedural props will be used.', error);
  }
  (window as unknown as { __harvestAssets?: unknown }).__harvestAssets = {
    loaded: library.size,
    total: library.total,
    errors: [...library.errors],
  };
  if (useAssets && library.errors.length > 0 && loadingNote) {
    loadingNote.textContent = '部分素材加载失败，已启用程序化兜底';
  } else if (!useAssets && loadingNote) {
    loadingNote.textContent = '离线素材不可用，使用程序化低多边形美术';
  }
  new Game(canvas, art, environment);
}

boot().catch((error) => {
  console.error('Failed to start Harvest & Hold', error);
  if (loadingNote) loadingNote.textContent = '初始化失败：请刷新页面或换用支持 WebGL2 的浏览器。';
});
