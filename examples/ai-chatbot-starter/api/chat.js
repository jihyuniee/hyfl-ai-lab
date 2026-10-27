import { createChatHandler } from '../server/chat.js';

// Vercel의 Node.js Function: 서버 환경변수는 이 함수에서 읽습니다.
export const POST = createChatHandler();
