<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	let { children }: { children: Snippet } = $props();
</script>

<nav>
	<a href="{base}/" class:active={$page.url.pathname === `${base}/`}>stickmen</a>
	<a href="{base}/editors" class:active={$page.url.pathname.startsWith(`${base}/editors`)}>editors</a>
</nav>

{@render children()}

<style>
	:global(body) {
		margin: 0;
		background: #0c0c0c;
		color: #e0e0e0;
		font-family: 'Inter', system-ui, sans-serif;
	}

	nav {
		display: flex;
		gap: 1.5rem;
		align-items: center;
		padding: 0.75rem 2rem;
		border-bottom: 1px solid #1a1a1a;
		background: #0c0c0c;
	}

	nav a {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.8rem;
		color: #555;
		text-decoration: none;
		letter-spacing: 0.05em;
		transition: color 0.15s;
	}

	nav a:hover,
	nav a.active {
		color: #e0e0e0;
	}
</style>
