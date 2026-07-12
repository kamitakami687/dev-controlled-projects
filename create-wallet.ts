import { appendFileSync } from 'node:fs';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

if (!apiKey) {
  throw new Error('CIRCLE_API_KEY is not set in .env.');
}
if (!entitySecret) {
  throw new Error('CIRCLE_ENTITY_SECRET is not set in .env.');
}

const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

const walletSetResponse = await client.createWalletSet({
  name: 'My First Dev-Controlled Wallet Set',
});

const walletSetId = walletSetResponse.data?.walletSet?.id;
if (!walletSetId) {
  throw new Error('Wallet set creation did not return an id.');
}

console.log('Wallet set response:', walletSetResponse.data);

const walletResponse = await client.createWallets({
  walletSetId,
  blockchains: ['ARC-TESTNET'],
  count: 1,
  accountType: 'EOA',
});

console.log('Wallet response:', walletResponse.data);

const wallet = walletResponse.data?.wallets?.[0];
if (!wallet?.address) {
  throw new Error('Wallet creation did not return an address.');
}

appendFileSync(
  './.env',
  `CIRCLE_WALLET_ADDRESS=${wallet.address}\nCIRCLE_WALLET_BLOCKCHAIN=ARC-TESTNET\n`
);
console.log('.env updated with CIRCLE_WALLET_ADDRESS and CIRCLE_WALLET_BLOCKCHAIN.');
