import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	root: 'src/editors',
	plugins: [svelte()],
	resolve: {
		alias: {
			$lib: resolve('./src/lib'),
			$editors: resolve('./src/editors')
		}
	},
	build: {
		outDir: resolve('./dist/cli/editors'),
		emptyOutDir: true,
		rollupOptions: {
			input: {
				'hat-builder': resolve('./src/editors/hat-builder.html'),
				'animation-editor': resolve('./src/editors/animation-editor.html')
			}
		}
	}
});
