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
			sidebar: [
				{
					label: '전체 과목 목차',
					items: [
						{ label: '과목 첫 화면', link: '/' },
						{
							label: '이해하고 경험하기',
							collapsed: false,
							items: [
								{ label: '1. 인공지능이란 무엇일까?', link: '/part1/ch1/' },
								{ label: '2. AI를 직접 가르쳐보자', link: '/part2/ch4/' },
								{ label: '3. School Image Lab', link: '/project1/' },
							],
						},
						{
							label: '데이터로 세상 읽기',
							collapsed: false,
							items: [
								{ label: '4. 이미지에서 표 데이터로', link: '/data/ch1/' },
								{ label: '5. 서울의 기온은 어떻게 변했을까?', link: '/data-lab/' },
								{ label: '6. My Data Question', link: '/data-project/' },
							],
						},
						{
							label: 'AI와 함께 생각하기',
							collapsed: false,
							items: [
								{ label: '7. 생성형 AI는 어떻게 답을 만들까?', link: '/part3/ch5/' },
								{ label: '8. AI와 함께 생각하는 법', link: '/part3/ch6/' },
								{ label: '9. 해결할 가치가 있는 문제', link: '/part6/' },
							],
						},
						{
							label: '더 나은 세상을 위한 설계',
							collapsed: false,
							items: [
								{ label: '10. AI for a Better World', link: '/project3/' },
								{ label: '11. 핵심 아이디어 표현하기', link: '/project2/' },
								{ label: '12. AI를 책임 있게 사용한다는 것은?', link: '/ethics/' },
								{ label: '13. 처음의 질문으로 돌아가기', link: '/part7/' },
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
			// 왼쪽에는 전체 과목 목차만 제공하고, 페이지별 소제목 목차는 표시하지 않습니다.
		}),
		mdx(),
	],
});
