// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mdx from '@astrojs/mdx';

export default defineConfig({
	site: 'https://jihyuniee.github.io',
	base: '/hyfl-ai-lab',
	integrations: [
		starlight({
			title: '인공지능 원리탐구',
			description: '한영외국어고등학교 2학년 「인공지능 원리탐구」 웹교과서',
			defaultLocale: 'ko',
			locales: { root: { label: '한국어', lang: 'ko' } },
			customCss: ['./src/styles/custom.css'],
			social: [],
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 2 },
			components: {},
			sidebar: [
				{ label: 'START · WHY', items: [
					{ label: '왜 우리는 AI를 배우는가?', slug: 'index' },
					{ label: '선생님께 질문하기', slug: 'question' },
				]},
				{ label: '1. UNDERSTAND · AI를 이해하다', items: [
					{ label: '1. 인공지능이란 무엇일까?', slug: 'part1/ch1' },
					{ label: '2. 생활 속 AI는 어떻게 작동할까?', slug: 'part1/ch2' },
					{ label: '3. AI·머신러닝·딥러닝', slug: 'part1/ch3' },
					{ label: '4. 컴퓨터는 어떻게 학습할까?', slug: 'part2/ch4' },
				]},
				{ label: '2. EXPERIENCE · 직접 경험하다', items: [
					{ label: 'Mini Project. AI Learning Lab', slug: 'project1' },
				]},
				{ label: '3. COLLABORATE · AI와 함께 일하다', items: [
					{ label: '5. 생성형 AI는 어떻게 답을 만들까?', slug: 'part3/ch5' },
					{ label: '6. AI에게 일을 맡기는 방법', slug: 'part3/ch6' },
				]},
				{ label: '4. DISCOVER · 문제를 발견하다', items: [
					{ label: '좋은 AI는 좋은 문제에서 시작한다', slug: 'part6' },
				]},
				{ label: '5. DESIGN · 해결책을 기획하다', items: [
					{ label: 'Final Project. AI for a Better World', slug: 'project3' },
				]},
				{ label: '6. PROTOTYPE · 아이디어를 보여주다', items: [
					{ label: 'Vibe Coding 맛보기', slug: 'project2' },
				]},
				{ label: 'FINISH · 다시 처음의 질문으로', items: [
					{ label: 'AI 시대를 살아가는 우리', slug: 'part7' },
				]},
			],
		}),
		mdx(),
	],
});
