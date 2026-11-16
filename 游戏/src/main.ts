import './style.css';
import { Game } from './game/game';
import { ProceduralArt } from './game/models';
import { startWhiteboxGallery } from './gallery';

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
  // v3 is a deliberately dependency-free white-box build: no external model
  // requests, no licence ambiguity, no loading failure path. Generated GLBs can
  // replace the placeholders later using the ids in the white-box prompt doc.
  setLoading(0.35, '搭起青瓦白墙的素模…');
  await new Promise((resolve) => window.setTimeout(resolve, 120));
  setLoading(0.8, '铺开梯田与竹篱…');
  await new Promise((resolve) => window.setTimeout(resolve, 120));
  const art = new ProceduralArt();
  (window as unknown as { __harvestAssets?: unknown }).__harvestAssets = {
    mode: 'whitebox',
    loaded: 0,
    total: 0,
    errors: [],
  };
  if (new URLSearchParams(window.location.search).has('gallery')) {
    startWhiteboxGallery(canvas);
    return;
  }
  setLoading(1, '准备就绪');
  new Game(canvas, art, null);
}

boot().catch((error) => {
  console.error('Failed to start Harvest & Hold', error);
  if (loadingNote) loadingNote.textContent = '初始化失败：请刷新页面或换用支持 WebGL2 的浏览器。';
});
