const HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>excalidraw</title></head>
  <body><div id="root">excalidraw stub</div></body>
</html>`;

Bun.serve({
  port: 8099,
  fetch() {
    return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
  },
});
