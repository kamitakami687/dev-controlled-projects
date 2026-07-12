import { createCircleWalletsAdapter } from '@circle-fin/adapter-circle-wallets';

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

if (!apiKey) throw new Error('CIRCLE_API_KEY is not set in .env.');
if (!entitySecret) throw new Error('CIRCLE_ENTITY_SECRET is not set in .env.');

export const adapter = createCircleWalletsAdapter({ apiKey, entitySecret });
