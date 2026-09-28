import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'neutral',
  target: 'es2017',
  format: 'iife',
  outfile: '../minigame/game.js',
  banner: { js: '// 由 client/build.mjs 生成，请勿手改。修改 client/src 后运行 npm run build。' },
  logLevel: 'info',
});
