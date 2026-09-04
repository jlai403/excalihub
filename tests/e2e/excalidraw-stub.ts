const SCENE = [
  { type: "rectangle", x: 180, y: 140, width: 200, height: 140, fill: "rgba(131,104,255,0.12)", stroke: "#8364ff", strokeWidth: 2 },
  { type: "ellipse", x: 440, y: 190, width: 130, height: 90, fill: "rgba(218,112,214,0.15)", stroke: "#da70d6", strokeWidth: 2 },
  { type: "diamond", x: 250, y: 360, width: 160, height: 110, fill: "rgba(0,161,255,0.12)", stroke: "#1ba1ff", strokeWidth: 2 },
  { type: "line", x1: 700, y1: 150, x2: 840, y2: 300, stroke: "#fe9b10", strokeWidth: 3 },
  { type: "text", x: 560, y: 420, text: "Hello from my-project", stroke: "#999999", fontSize: 22 },
];

const JS = `
(() => {
  const url = new URL(location.href);
  const theme = url.searchParams.get('theme');
  if (theme === 'dark') {
    document.body.classList.add('theme--dark');
    document.documentElement.classList.add('theme--dark');
  }

  const scene = ${JSON.stringify(SCENE)};
  localStorage.setItem('excalidraw', JSON.stringify(scene));
  localStorage.setItem('excalidraw-state', JSON.stringify({ name: null, viewBackgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff' }));

  const canvas = document.querySelector('#excalidraw-canvas');
  canvas.width = 900;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const el of scene) {
      ctx.beginPath();
      ctx.lineWidth = el.strokeWidth || 2;
      ctx.strokeStyle = el.stroke;
      if (el.type === 'rectangle') {
        ctx.fillStyle = el.fill;
        ctx.rect(el.x, el.y, el.width, el.height);
        ctx.fill();
        ctx.stroke();
      } else if (el.type === 'ellipse') {
        ctx.fillStyle = el.fill;
        ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (el.type === 'diamond') {
        ctx.fillStyle = el.fill;
        ctx.moveTo(el.x + el.width / 2, el.y);
        ctx.lineTo(el.x + el.width, el.y + el.height / 2);
        ctx.lineTo(el.x + el.width / 2, el.y + el.height);
        ctx.lineTo(el.x, el.y + el.height / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (el.type === 'line') {
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
      } else if (el.type === 'text') {
        ctx.font = '22px "Cascadia Code", ui-monospace, monospace';
        ctx.fillStyle = el.stroke;
        ctx.fillText(el.text, el.x, el.y);
      }
    }
  };
  draw();
  window.addEventListener('resize', draw);
})();
`;

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Excalidraw</title>
    <style>
      html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; }
      html {
        --background: 220 23% 95%;
        --foreground: 234 16% 35%;
        --border: 223 16% 83%;
      }
      html.theme--dark {
        --background: 240 21% 15%;
        --foreground: 226 64% 88%;
        --border: 237 16% 23%;
      }
      body {
        background: hsl(var(--background));
        color: hsl(var(--foreground));
      }
      body.theme--dark {
        background: hsl(var(--background));
        color: hsl(var(--foreground));
      }
      .excalidraw {
        position: relative;
        height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .excalidraw-ui-top-left {
        position: absolute;
        top: 12px;
        left: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 10;
      }
      [data-testid="main-menu-trigger"] {
        width: 36px;
        height: 36px;
        border: 1px solid rgba(120,120,120,0.3);
        border-radius: 8px;
        background: rgba(0,0,0,0.04);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      body.theme--dark [data-testid="main-menu-trigger"] {
        background: rgba(255,255,255,0.08);
      }
      .excalidraw-canvas-wrap {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      canvas {
        background: #ffffff;
        border-radius: 4px;
        box-shadow: 0 2px 16px rgba(0,0,0,0.06);
      }
      .theme--dark canvas {
        background: #1e1e1e;
      }
      .excalidraw-toolbar {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 6px;
        padding: 6px 8px;
        border: 1px solid rgba(120,120,120,0.3);
        border-radius: 8px;
        background: rgba(255,255,255,0.9);
      }
      .theme--dark .excalidraw-toolbar { background: rgba(30,30,30,0.9); }
      .excalidraw-toolbar span {
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 4px;
        opacity: 0.7;
      }
    </style>
  </head>
  <body>
    <div class="excalidraw">
      <div class="excalidraw-ui-top-left">
        <button aria-label="Menu" data-testid="main-menu-trigger">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
      </div>
      <div class="excalidraw-canvas-wrap">
        <canvas id="excalidraw-canvas"></canvas>
      </div>
      <div class="excalidraw-toolbar">
        <span>Select</span>
        <span>Rectangle</span>
        <span>Diamond</span>
        <span>Ellipse</span>
        <span>Arrow</span>
        <span>Text</span>
      </div>
    </div>
    <script>${JS}</script>
  </body>
</html>`;

Bun.serve({
  port: 8099,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }
    return new Response(HTML, { headers: { "Content-Type": "text/html" } });
  },
});