/**
 * Self-hosted Swagger UI and OpenAPI document endpoints.
 *
 * Assets come from `swagger-ui-dist` (npm), not from a CDN, so the browser
 * works offline and inside Docker. No route handler outside this module knows
 * about Swagger UI; the gateway only delegates two paths here.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import type * as http from 'node:http';
import { fastApiBaseUrl, loadOpenApiDocument } from './openapi';

const require = createRequire(import.meta.url);
const SWAGGER_DIST = path.dirname(require.resolve('swagger-ui-dist/package.json'));

const STATIC_ASSETS: Record<string, { file: string; type: string }> = {
  'swagger-ui.css': { file: 'swagger-ui.css', type: 'text/css; charset=utf-8' },
  'swagger-ui-bundle.js': { file: 'swagger-ui-bundle.js', type: 'application/javascript; charset=utf-8' },
  'swagger-ui-standalone-preset.js': { file: 'swagger-ui-standalone-preset.js', type: 'application/javascript; charset=utf-8' },
  'favicon-32x32.png': { file: 'favicon-32x32.png', type: 'image/png' },
  'favicon-16x16.png': { file: 'favicon-16x16.png', type: 'image/png' },
};

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body, null, 2));
}

function html(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Wiki-Forge API — OpenAPI Browser</title>
  <link rel="icon" href="/api/docs/assets/favicon-32x32.png" type="image/png">
  <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css">
  <style>
    body { margin: 0; background: #fafafa; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .wf-header { padding: 12px 20px; background: #1b1f24; color: #fff; font-size: 14px; }
    .wf-header strong { color: #8bd6ff; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div class="wf-header"><strong>Wiki-Forge API</strong> · generata da <code>src/shared/api/contracts.ts</code> · <a style="color:#8bd6ff" href="/api/openapi.json">OpenAPI JSON</a></div>
  <div id="swagger-ui"></div>
  <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
  <script src="/api/docs/assets/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
        docExpansion: 'list',
        filter: true,
        persistAuthorization: true,
        requestInterceptor: function (request) {
          var token = window.localStorage.getItem('wikiforge.token');
          if (token && !request.headers['X-WikiForge-Token']) request.headers['X-WikiForge-Token'] = token;
          var project = window.localStorage.getItem('wikiforge.projectId');
          if (project && !request.headers['X-Project-Id']) request.headers['X-Project-Id'] = project;
          return request;
        }
      });
    };
  </script>
</body>
</html>`;
}

/**
 * Handle documentation routes. Returns false when the request belongs to
 * another component, so the gateway can keep its existing dispatch order.
 */
export async function handleDocsRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (req.method !== 'GET') return false;

  if (pathname === '/api/openapi.json') {
    try {
      sendJson(res, 200, await loadOpenApiDocument());
    } catch (err) {
      sendJson(res, 500, { success: false, error: `OpenAPI generation failed: ${String(err)}` });
    }
    return true;
  }

  if (pathname === '/api/docs' || pathname === '/api/docs/') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Content-Security-Policy': `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' ${fastApiBaseUrl()}`,
    });
    res.end(html());
    return true;
  }

  if (pathname.startsWith('/api/docs/assets/')) {
    const name = pathname.slice('/api/docs/assets/'.length);
    const asset = STATIC_ASSETS[name];
    if (!asset || name.includes('..') || name.includes('/') || name.includes('\\')) {
      sendJson(res, 404, { success: false, error: `Unknown documentation asset: ${name}` });
      return true;
    }
    try {
      const content = await fs.readFile(path.join(SWAGGER_DIST, asset.file));
      res.writeHead(200, { 'Content-Type': asset.type, 'Cache-Control': 'public, max-age=3600' });
      res.end(content);
    } catch (err) {
      sendJson(res, 500, { success: false, error: `Cannot read Swagger UI asset: ${String(err)}` });
    }
    return true;
  }

  return false;
}
