import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

/** 打包图鉴页：一个自带脚本的 HTML，输出到 gallery/out/（不提交）。
 *  gallery.ts 画所有图；screens.ts 把真实的界面场景画在手机尺寸上。 */
const bundle = async (entry) => {
  const out = await build({ entryPoints: [entry], bundle: true, format: 'iife', target: 'es2017', write: false, logLevel: 'info' });
  return out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
};
const gallery = await bundle('gallery/gallery.ts');
const screens = await bundle('gallery/screens.ts');
const html = `<title>女巫镇图鉴</title>
<style>
  :root { color-scheme: dark; }
  body { background: #0d0a14; color: #e9dcb8; font-family: -apple-system, "PingFang SC", sans-serif; margin: 0; padding: 16px; }
  h2 { color: #e8c774; font-size: 16px; margin: 24px 0 8px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; max-width: 100%; overflow-x: auto; }
  figure { margin: 0; display: grid; gap: 2px; justify-items: center; }
  figcaption { font-size: 11px; color: #8a7fa3; }
</style>
<main></main>
<script>${gallery}</script>
<h2>真实界面（手机尺寸）</h2>
<div id="screens" class="row"></div>
<script>${screens}</script>
`;
mkdirSync('gallery/out', { recursive: true });
writeFileSync('gallery/out/gallery.html', html);
console.log('gallery/out/gallery.html');
