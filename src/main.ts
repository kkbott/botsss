import './style.css';
import { Game } from './game/game';

const canvas = document.getElementById('scene');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing WebGL canvas');
}

try {
  new Game(canvas);
} catch (error) {
  console.error('Failed to start Harvest & Hold', error);
  const note = document.getElementById('loading-note');
  if (note) {
    note.textContent = '初始化失败：请刷新页面或换用支持 WebGL2 的浏览器。';
  }
  throw error;
}
