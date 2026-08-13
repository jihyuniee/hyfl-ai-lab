// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mdx from '@astrojs/mdx';

export default defineConfig({
	site: 'https://jihyuniee.github.io',
	base: '/hyfl-ai-lab',
	integrations: [
		starlight({
			title: 'HYFL AI Lab',
			description:
				'한영외국어고등학교 2학년 「인공지능 원리탐구」 학생용 AI Lab Book. 개념을 이해하고, 바로 해보고, 실패에서 배우며, 나만의 AI와 웹서비스를 만듭니다.',
			defaultLocale: 'ko',
			locales: {
				root: { label: '한국어', lang: 'ko' },
			},
			customCss: ['./src/styles/custom.css'],
			social: [],
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 2 },
			components: {
				// keep default Starlight page frame; only styling is overridden
			},
			sidebar: [
				{
					label: 'START',
					items: [{ label: '🏠 HYFL AI Lab 시작하기', slug: 'index' }],
				},
				{
					label: 'Part 1. AI의 세계를 이해하다',
					items: [
						{ label: '1. 인공지능이란 무엇일까?', slug: 'part1/ch1' },
						{ label: '2. AI는 무엇을 할 수 있을까?', slug: 'part1/ch2' },
						{ label: '3. AI·머신러닝·딥러닝은 무엇이 다를까?', slug: 'part1/ch3' },
					],
				},
				{
					label: 'Part 2. 머신러닝을 직접 경험하다',
					items: [{ label: '4. 컴퓨터는 어떻게 학습할까?', slug: 'part2/ch4' }],
				},
				{
					label: '🧪 Project 1',
					items: [{ label: '나만의 이미지 분류 AI 웹앱', slug: 'project1' }],
				},
				{
					label: 'Part 3. AI와 함께 생각하는 법',
					items: [
						{ label: '5. 생성형 AI는 어떻게 답을 만들까?', slug: 'part3/ch5' },
						{ label: '6. AI에게 답을 받지 말고, AI와 생각하자', slug: 'part3/ch6' },
					],
				},
				{
					label: 'Part 4. AI와 함께 만들다',
					items: [{ label: '🧪 Project 2. 생성형 AI와 웹서비스 만들기', slug: 'project2' }],
				},
				{
					label: 'Part 5. 데이터에서 문제를 발견하다',
					items: [{ label: '🧪 Project 3. Data to AI Solution', slug: 'project3' }],
				},
				{
					label: 'Part 6. AI Playground',
					items: [{ label: 'AI Playground', slug: 'part6' }],
				},
				{
					label: 'Part 7. AI 시대를 살아가는 우리',
					items: [{ label: 'AI 시대를 살아가는 우리', slug: 'part7' }],
				},
				{
					label: '🧑‍🏫 교사용',
					items: [
						{ label: '수업 운영 가이드', slug: 'teacher/guide' },
						{ label: '교육과정·개념 연결표', slug: 'teacher/curriculum-map' },
					],
				},
			],
		}),
		mdx(),
	],
});
