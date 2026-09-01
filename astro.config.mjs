// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mdx from '@astrojs/mdx';

function stripLiteralDoubleAsterisks() {
	return (tree) => {
		const walk = (node) => {
			if (!node || typeof node !== 'object') return;
			if (node.type === 'text' && typeof node.value === 'string') node.value = node.value.replace(/\*\*/g, '');
			if (Array.isArray(node.children)) for (const child of node.children) walk(child);
		};
		walk(tree);
	};
}

const lockedLessonPaths = [
	'/src/content/docs/data/ch1.mdx',
	'/src/content/docs/data-lab.mdx',
	'/src/content/docs/data-project.mdx',
	'/src/content/docs/project2.mdx',
	'/src/content/docs/project3.mdx',
	'/src/content/docs/ethics/index.mdx',
	'/src/content/docs/part3/ch5.mdx',
	'/src/content/docs/part3/ch6.mdx',
	'/src/content/docs/part6/index.mdx',
	'/src/content/docs/part7/index.mdx',
];

// 현재 수업 진도 이후의 원고는 보존하되, 웹교과서에서는 공개 안내만 표시합니다.
function lockFutureLessons() {
	return (tree, file) => {
		const filePath = String(file.path ?? '').replaceAll('\\\\', '/');
		if (!lockedLessonPaths.some((path) => filePath.endsWith(path))) return;

		tree.children = [
			{ type: 'heading', depth: 2, children: [{ type: 'text', value: '다음 수업에서 공개됩니다' }] },
			{
				type: 'paragraph',
				children: [{ type: 'text', value: '이 단원은 아직 수업 전입니다. 지금은 School Image Lab까지 학습합니다.' }],
			},
			{
				type: 'paragraph',
				children: [
					{ type: 'link', url: '/hyfl-ai-lab/project1/', children: [{ type: 'text', value: 'School Image Lab으로 돌아가기' }] },
				],
			},
		];
	};
}

export default defineConfig({
	site: 'https://jihyuniee.github.io',
	base: '/hyfl-ai-lab',
	markdown: { remarkPlugins: [stripLiteralDoubleAsterisks, lockFutureLessons] },
	integrations: [
		starlight({
			title: '인공지능 원리탐구',
			description: '한영외국어고등학교 2학년 「인공지능 원리탐구」 웹교과서',
			sidebar: [
				{
					label: '교과서 목차',
					items: [
						{ label: '교과서 안내', link: '/' },
						{
							label: 'Ⅰ단원. 인공지능과 기계학습',
							collapsed: false,
							items: [
								{ label: '1. 인공지능이란 무엇일까?', link: '/part1/ch1/' },
								{ label: '2. AI를 직접 가르쳐보자', link: '/part2/ch4/' },
								{ label: '3. School Image Lab', link: '/project1/' },
							],
						},
						{
							label: 'Ⅱ단원. 데이터와 AI 서비스',
							collapsed: false,
							items: [
								{ label: '4. AI와 공공데이터를 연결하다 · 다음에 공개', link: '/data/ch1/' },
								{ label: '5. MCP 데이터 탐정 미션 · 다음에 공개', link: '/data-lab/' },
								{ label: '6. Data to AI Service · 다음에 공개', link: '/data-project/' },
							],
						},
						{
							label: 'Ⅲ단원. 책임 있는 AI와 성찰',
							collapsed: false,
							items: [
								{ label: '7. 선택: 핵심 아이디어 표현하기 · 다음에 공개', link: '/project2/' },
								{ label: '8. AI를 책임 있게 사용한다는 것은? · 다음에 공개', link: '/ethics/' },
								{ label: '9. 처음의 질문으로 돌아가기 · 다음에 공개', link: '/part7/' },
							],
						},
					],
				},
			],
			defaultLocale: 'ko',
			locales: { root: { label: '한국어', lang: 'ko' } },
			customCss: ['./src/styles/custom.css'],
			social: [],
			tableOfContents: false,
			components: {},
		}),
		mdx(),
	],
});
