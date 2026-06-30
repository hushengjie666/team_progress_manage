import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const rootDir = resolve(process.env.TM_FRONTEND_DIR ?? join(process.cwd(), "dist"));
const listenHost = process.env.TM_REMOTE_HOST ?? "127.0.0.1";
const listenPort = Number(process.env.TM_REMOTE_PORT ?? 1422);
const syncTarget = new URL(process.env.TM_SYNC_TARGET ?? "http://127.0.0.1:8787");

const apiPrefixes = ["/health", "/auth/", "/sync/", "/team/", "/members"];
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
]);

const isApiRequest = (url) => apiPrefixes.some((prefix) => url === prefix || url.startsWith(prefix));

const sendStatic = (response, filePath) => {
  response.writeHead(200, {
    "content-type": mimeTypes.get(extname(filePath)) ?? "application/octet-stream",
    "cache-control": filePath.endsWith("index.html") ? "no-store" : "public, max-age=31536000, immutable",
  });
  createReadStream(filePath).pipe(response);
};

const resolveStaticPath = (requestUrl) => {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://local").pathname);
  const requestedPath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(rootDir, `.${sep}${requestedPath}`);
  if (!filePath.startsWith(`${rootDir}${sep}`) && filePath !== rootDir) return join(rootDir, "index.html");
  if (existsSync(filePath) && statSync(filePath).isFile()) return filePath;
  return join(rootDir, "index.html");
};

const proxyToSync = (clientRequest, clientResponse) => {
  const upstreamUrl = new URL(clientRequest.url ?? "/", syncTarget);
  const upstreamRequest = httpRequest(
    {
      protocol: syncTarget.protocol,
      hostname: syncTarget.hostname,
      port: syncTarget.port,
      method: clientRequest.method,
      path: `${upstreamUrl.pathname}${upstreamUrl.search}`,
      headers: {
        ...clientRequest.headers,
        host: syncTarget.host,
      },
    },
    (upstreamResponse) => {
      clientResponse.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(clientResponse);
    },
  );
  upstreamRequest.on("error", (error) => {
    clientResponse.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    clientResponse.end(JSON.stringify({ error: `sync proxy failed: ${error.message}` }));
  });
  clientRequest.pipe(upstreamRequest);
};

const server = createServer((request, response) => {
  if (!request.url) {
    response.writeHead(400);
    response.end();
    return;
  }
  if (isApiRequest(new URL(request.url, "http://local").pathname)) {
    proxyToSync(request, response);
    return;
  }
  sendStatic(response, resolveStaticPath(request.url));
});

server.listen(listenPort, listenHost, () => {
  console.log(`TimeManage remote gateway: http://${listenHost}:${listenPort}`);
  console.log(`Static root: ${rootDir}`);
  console.log(`Sync target: ${syncTarget.toString()}`);
});
