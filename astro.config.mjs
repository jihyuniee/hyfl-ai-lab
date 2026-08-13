// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://jihyuniee.github.io',
	base: '/hyfl-ai-lab',
	integrations: [
		starlight({
			title: 'HYFL AI Lab',
			description:
				'개념을 이해한다 → 바로 해본다 → 실패한다 → 왜 그런지 생각한다 → 필요한 이론을 다시 배운다 → 개선한다. 실습 중심으로 다시 짠 HYFL 인공지능 수업 자료.',
			defaultLocale: 'ko',
			locales: {
				root: { label: '한국어', lang: 'ko' },
			},
			social: [],
			sidebar: [
				{
					label: 'OT',
					items: [{ label: 'HYFL AI Lab에 오신 것을 환영합니다', slug: 'index' }],
				},
				{
					label: 'Part 1. AI의 세계를 이해하다',
					items: [
						{ label: '1. 인공지능이란 무엇일까?', slug: 'chapter01' },
						{ label: '2. AI는 무엇을 할 수 있을까?', slug: 'chapter02' },
						{ label: '3. AI·머신러닝·딥러닝은 무엇이 다를까?', slug: 'chapter03' },
					],
				},
				{
					label: 'Part 2. 머신러닝을 직접 경험하다',
					items: [{ label: '4. 컴퓨터는 어떻게 학습할까?', slug: 'chapter04' }],
				},
				{
					label: 'Part 3. Project 1 — 나만의 AI 만들기',
					items: [{ label: '나만의 AI 만들기 프로젝트', slug: 'chapter05' }],
				},
				{
					label: 'Part 4. AI와 함께 생각하는 법',
					items: [
						{ label: '5. 생성형 AI는 어떻게 답을 만들까?', slug: 'chapter06' },
						{ label: '6. AI에게 답을 받지 말고, AI와 생각하자', slug: 'chapter07' },
					],
				},
				{
					label: 'Part 5. Project 2 — 공공데이터 × AI 문제 해결',
					items: [{ label: '공공데이터 × AI 문제 해결 프로젝트', slug: 'chapter08' }],
				},
				{
					label: 'Part 6. AI Playground',
					items: [{ label: 'AI Playground', slug: 'chapter09' }],
				},
				{
					label: 'Part 7. AI 시대를 살아가는 우리',
					items: [{ label: 'AI 시대를 살아가는 우리', slug: 'chapter10' }],
				},
			],
		}),
	],
});
