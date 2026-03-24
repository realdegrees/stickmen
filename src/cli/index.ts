#!/usr/bin/env node

import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { ChildProcess } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

const EDITORS_DIR = resolve(__dirname, 'editors');

// Chrome profile in tmp — persists within a system session, lost on reboot
const CHROME_PROFILE_DIR = join(tmpdir(), 'stickmen-chrome');

const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html',
	'.js':   'application/javascript',
	'.css':  'text/css',
	'.svg':  'image/svg+xml',
	'.json': 'application/json',
	'.png':  'image/png',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
};

// Each editor gets its own fixed port so both can run simultaneously.
// Fixed ports keep localStorage consistent across sessions.
const EDITOR_PORTS: Record<string, number> = {
	'hat-builder':       19830,
	'animation-editor':  19831,
	'animation-builder': 19831, // alias
};

const EDITORS: Record<string, string> = {
	'hat-builder':       'hat-builder.html',
	'animation-editor':  'animation-editor.html',
	'animation-builder': 'animation-editor.html', // alias
};

// ── Browser detection ──────────────────────────────────────────────

function chromeCandidates(): string[] {
	switch (process.platform) {
		case 'darwin':
			return [
				'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
				'/Applications/Chromium.app/Contents/MacOS/Chromium',
				'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
			];
		case 'win32':
			return ['chrome', 'msedge', 'chromium'];
		default:
			return ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
	}
}

function findChrome(): string | null {
	for (const candidate of chromeCandidates()) {
		try {
			if (candidate.startsWith('/')) {
				if (existsSync(candidate)) return candidate;
			} else {
				const cmd = process.platform === 'win32' ? 'where' : 'which';
				execFileSync(cmd, [candidate], { stdio: 'ignore' });
				return candidate;
			}
		} catch { /* try next */ }
	}
	return null;
}

/**
 * Open URL in Chrome app-mode with an isolated profile so we own the process.
 * Returns the child process, or null if spawn failed.
 */
function openChromeApp(url: string, chrome: string): ChildProcess | null {
	try {
		mkdirSync(CHROME_PROFILE_DIR, { recursive: true });
		const child = spawn(chrome, [
			`--app=${url}`,
			'--window-size=960,720',
			`--user-data-dir=${CHROME_PROFILE_DIR}`,
		], { stdio: 'ignore' }); // no detach — we want to track it
		return child;
	} catch {
		return null;
	}
}

async function openDefault(url: string): Promise<boolean> {
	try {
		const open = await import('open');
		await open.default(url);
		return true;
	} catch {
		return false;
	}
}

// ── Server ─────────────────────────────────────────────────────────

function startServer(htmlFile: string, port: number): Promise<ReturnType<typeof createServer>> {
	return new Promise((resolve, reject) => {
		const server = createServer((req, res) => {
			let urlPath = req.url?.split('?')[0] ?? '/';
			if (urlPath === '/') urlPath = `/${htmlFile}`;

			const filePath = join(EDITORS_DIR, urlPath);
			if (!filePath.startsWith(EDITORS_DIR)) {
				res.writeHead(403); res.end('Forbidden'); return;
			}

			try {
				const data = readFileSync(filePath);
				res.writeHead(200, {
					'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
					'Cache-Control': 'no-cache',
				});
				res.end(data);
			} catch {
				res.writeHead(404); res.end('Not found');
			}
		});

		server.once('error', (err: NodeJS.ErrnoException) => {
			if (err.code === 'EADDRINUSE') {
				reject(new Error('EADDRINUSE'));
			} else {
				reject(err);
			}
		});

		server.once('listening', () => resolve(server));
		server.listen(port, '127.0.0.1');
	});
}

// ── Main ───────────────────────────────────────────────────────────

function usage(): void {
	console.log(`
  stickmen <editor>

  Available editors:
    animation-editor   Open the animation keyframe editor
    hat-builder        Open the hat shape builder

  Examples:
    stickmen animation-editor
    stickmen hat-builder
`);
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const editor = args[0];

	if (!editor || editor === '--help' || editor === '-h') {
		usage();
		process.exit(editor ? 0 : 1);
	}

	const htmlFile = EDITORS[editor];
	if (!htmlFile) {
		console.error(`Unknown editor: "${editor}"\n`);
		usage();
		process.exit(1);
	}

	if (!existsSync(join(EDITORS_DIR, htmlFile))) {
		console.error(`  Editor files not found at ${EDITORS_DIR}`);
		console.error('  This may mean the package was not built correctly.');
		process.exit(1);
	}

	const port = EDITOR_PORTS[editor];
	const url  = `http://127.0.0.1:${port}`;

	// Start server — fail immediately if port is taken
	let server: ReturnType<typeof createServer>;
	try {
		server = await startServer(htmlFile, port);
	} catch (err) {
		if ((err as Error).message === 'EADDRINUSE') {
			console.error(`\n  Port ${port} is already in use.`);
			console.error(`  The ${editor} may already be running — visit ${url}\n`);
		} else {
			console.error(`\n  Failed to start server: ${(err as Error).message}\n`);
		}
		process.exit(1);
	}

	console.log(`\n  stickmen ${editor}`);
	console.log(`  ${url}`);
	console.log(`\n  Note: editor saves are stored in a temp directory (${CHROME_PROFILE_DIR})`);
	console.log('        and may be lost on system restart\n');

	// Try Chrome app-mode (isolated process, bidirectional lifecycle)
	const chrome   = findChrome();
	let chromeChild: ChildProcess | null = null;
	let launched   = false;

	if (chrome) {
		const launchTime = Date.now();
		chromeChild = openChromeApp(url, chrome);

		if (chromeChild) {
			launched = true;
			console.log(`  Opened in app mode (${chrome.split('/').pop()})`);

			chromeChild.on('exit', () => {
				// If Chrome exits within 1.5s, the profile was locked (another instance)
				// or it failed to start — keep the server running and warn
				if (Date.now() - launchTime < 1500) {
					console.log('\n  Chrome could not open a new window (profile may be locked).');
					console.log('  Another editor instance may already be running.');
					console.log(`  Visit ${url} in your browser, or stop the other instance first.\n`);
					chromeChild = null;
					return;
				}
				// Normal close — window was closed by the user
				console.log('\n  Browser closed, stopping server.');
				server.close();
				process.exit(0);
			});
		}
	}

	// Fall back to default browser (no lifecycle link possible)
	if (!launched) {
		launched = await openDefault(url);
		if (launched) console.log('  Opened in default browser');
	}

	if (!launched) {
		console.log('  Could not open browser — visit the URL above manually');
	}

	console.log('  Press Ctrl+C to stop\n');

	const shutdown = () => {
		chromeChild?.kill();
		server.close();
		process.exit(0);
	};

	process.on('SIGINT',  shutdown);
	process.on('SIGTERM', shutdown);
}

main();
