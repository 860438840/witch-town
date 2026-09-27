import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node16',
  format: 'cjs',
  outfile: '../cloudfunctions/game/index.js',
  external: ['wx-server-sdk'],
  banner: { js: '// 由 server/build.mjs 生成，请勿手改。修改 server/src 后运行 npm run build。' },
  logLevel: 'info',
});
