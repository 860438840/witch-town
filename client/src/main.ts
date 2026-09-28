import { App } from './core/app';
import { rect } from './core/geom';
import { bindTouches, createPlatform } from './platform';

const { ctx, screen } = createPlatform();
const app = new App(ctx, screen, (cb) => requestAnimationFrame(() => cb()), () => Date.now());
bindTouches(app);
app.setScene({
  build: () => [
    {
      rect: rect(0, 0, screen.W, screen.H),
      draw: (c) => {
        c.fillStyle = '#1a1326';
        c.fillRect(0, 0, screen.W, screen.H);
        c.fillStyle = '#e8c774';
        c.font = 'bold 28px sans-serif';
        c.textAlign = 'center';
        c.fillText('女巫镇 · 建设中', screen.W / 2, screen.H / 2);
      },
    },
  ],
});
