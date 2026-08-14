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
			description:
				'한영외국어고등학교 2학년 「인공지능 원리탐구」 웹교과서',
			defaultLocale: 'ko',
			locales: {
				root: { label: '한국어', lang: 'ko' },
			},
			customCss: ['./src/styles/custom.css'],
			social: [],
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 2 },
			components: {},
			sidebar: [
				{
					label: '교과서',
					items: [
						{ label: '처음으로 · 전체 목차', slug: 'index' },
						{ label: '선생님께 질문하기', slug: 'question' },
					],
				},
				{
					label: 'Part 1. AI의 세계를 이해하다',
					items: [
						{ label: '1. 인공지능이란 무엇일까?', slug: 'part1/ch1' },
						{ label: '2. 생활 속 AI는 어떻게 작동할까?', slug: 'part1/ch2' },
						{ label: '3. AI·머신러닝·딥러닝은 무엇이 다를까?', slug: 'part1/ch3' },
					],
				},
				{
					label: 'Part 2. 머신러닝을 직접 경험하다',
					items: [{ label: '4. 컴퓨터는 어떻게 학습할까?', slug: 'part2/ch4' }],
				},
				{
					label: 'Project 1',
					items: [{ label: '티처블머신 프로젝트', slug: 'project1' }],
				},
				{
					label: 'Part 3. 생성형 AI를 이해하고 활용하다',
					items: [
						{ label: '5. 생성형 AI는 어떻게 답을 만들까?', slug: 'part3/ch5' },
						{ label: '6. 생성형 AI를 제대로 활용하는 방법', slug: 'part3/ch6' },
					],
				},
				{
					label: 'Project 2',
					items: [{ label: '문제해결 프로젝트', slug: 'project2' }],
				},
				{
					label: 'Project 3',
					items: [{ label: '나만의 웹앱 만들기', slug: 'project3' }],
				},
				{
					label: '더 살펴보기',
					items: [
						{ label: 'AI Playground', slug: 'part6' },
						{ label: 'AI 시대의 책임과 인간의 역할', slug: 'part7' },
					],
				},
			],
		}),
		mdx(),
	],
});
