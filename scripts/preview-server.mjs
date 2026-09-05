import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".zip": "application/zip", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8" };

export function createPreviewServer(root = resolve(project, "dist")) {
  return createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const file = resolve(root, `.${path === "/" ? "/index.html" : path}`);
      if (!file.startsWith(root + sep) || !types[extname(file)]) {
        response.writeHead(404).end("Not found");
        return;
      }
      const content = await readFile(file);
      response.writeHead(200, {
        "Content-Type": types[extname(file)],
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      }).end(content);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR") response.writeHead(404).end("Not found");
      else if (error instanceof URIError) response.writeHead(400).end("Bad request");
      else {
        console.error(error);
        response.writeHead(500).end("Preview server error");
      }
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  const { buildSite } = await import("./build.mjs");
  const root = await buildSite();
  createPreviewServer(root).listen(port, "127.0.0.1", () => console.log(`Bananify preview: http://127.0.0.1:${port}`));
}
