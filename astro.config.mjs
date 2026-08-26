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

export default defineConfig({
	site: 'https://jihyuniee.github.io',
	base: '/hyfl-ai-lab',
	markdown: { remarkPlugins: [stripLiteralDoubleAsterisks] },
	integrations: [
		starlight({
			title: '인공지능 원리탐구',
			description: '한영외국어고등학교 2학년 「인공지능 원리탐구」 웹교과서',
			sidebar: [
				{
					label: '전체 과목 목차',
					items: [
						{ label: '과목 첫 화면', link: '/' },
						{
							label: 'AI를 직접 경험하기',
							collapsed: false,
							items: [
								{ label: '1. 인공지능이란 무엇일까?', link: '/part1/ch1/' },
								{ label: '2. AI를 직접 가르쳐보자', link: '/part2/ch4/' },
								{ label: '3. School Image Lab', link: '/project1/' },
							],
						},
						{
							label: '데이터에서 서비스까지',
							collapsed: false,
							items: [
								{ label: '4. 데이터 파일을 직접 열어보자', link: '/data/ch1/' },
								{ label: '5. 공공데이터 분석 미션', link: '/data-lab/' },
								{ label: '6. Data to AI Service', link: '/data-project/' },
							],
						},
						{
							label: '표현하고 책임 있게 판단하기',
							collapsed: false,
							items: [
								{ label: '7. 선택: 핵심 아이디어 표현하기', link: '/project2/' },
								{ label: '8. AI를 책임 있게 사용한다는 것은?', link: '/ethics/' },
								{ label: '9. 처음의 질문으로 돌아가기', link: '/part7/' },
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
