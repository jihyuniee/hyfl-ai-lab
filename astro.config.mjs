// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mdx from '@astrojs/mdx';

function stripLiteralDoubleAsterisks() {
	return (tree) => {
		const walk = (node) => {
			if (!node || typeof node !== 'object') return;

			if (node.type === 'text' && typeof node.value === 'string') {
				node.value = node.value.replace(/\*\*/g, '');
			}

			if (Array.isArray(node.children)) {
				for (const child of node.children) walk(child);
			}
		};

		walk(tree);
	};
}

export default defineConfig({
	site: 'https://jihyuniee.github.io',
	base: '/hyfl-ai-lab',
	markdown: {
		remarkPlugins: [stripLiteralDoubleAsterisks],
	},
	integrations: [
		starlight({
			title: '인공지능 원리탐구',
			description: '한영외국어고등학교 2학년 「인공지능 원리탐구」 웹교과서',
			sidebar: [],
			defaultLocale: 'ko',
			locales: { root: { label: '한국어', lang: 'ko' } },
			customCss: ['./src/styles/custom.css'],
			social: [],
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 2 },
			components: {},
			// 전체 목차는 첫 페이지에만 제공합니다. 각 단원은 본문과 이전·다음 링크에 집중합니다.
		}),
		mdx(),
	],
});
