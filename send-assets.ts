import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const ARC_TESTNET_TOKENS: Record<string, string> = {
  USDC: '0x3600000000000000000000000000000000000000',
  EURC: '0x89b50855aa3be2f677cd6303cec089b5f319d72a',
};
const EXPLORER_BASE = 'https://testnet.arcscan.app/tx';
const TERMINAL_STATES = new Set(['COMPLETE', 'FAILED', 'CANCELLED', 'DENIED', 'STUCK']);

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
const wallet1Address = process.env.CIRCLE_WALLET_ADDRESS;
const blockchain = process.env.CIRCLE_WALLET_BLOCKCHAIN;
const wallet2Address = process.env.DESTINATION_ADDRESS;

if (!apiKey) throw new Error('CIRCLE_API_KEY is not set in .env.');
if (!entitySecret) throw new Error('CIRCLE_ENTITY_SECRET is not set in .env.');
if (!wallet1Address) throw new Error('CIRCLE_WALLET_ADDRESS is not set in .env.');
if (!blockchain) throw new Error('CIRCLE_WALLET_BLOCKCHAIN is not set in .env.');
if (!wallet2Address) throw new Error('DESTINATION_ADDRESS is not set in .env.');

const amountArg = process.argv[2] ?? '0.5';
const amount = Number(amountArg);
if (!Number.isFinite(amount) || amount <= 0) {
  throw new Error(`AMOUNT must be a positive number, got: ${amountArg}`);
}

const direction = process.argv[3] ?? '1to2';
if (direction !== '1to2' && direction !== '2to1') {
  throw new Error(`Direction must be "1to2" or "2to1", got: ${direction}`);
}

const tokenSymbol = process.argv[4] ?? 'USDC';
const tokenAddress = ARC_TESTNET_TOKENS[tokenSymbol];
if (!tokenAddress) {
  throw new Error(`Token must be one of ${Object.keys(ARC_TESTNET_TOKENS).join(', ')}, got: ${tokenSymbol}`);
}

const walletAddress = direction === '1to2' ? wallet1Address : wallet2Address;
const destinationAddress = direction === '1to2' ? wallet2Address : wallet1Address;

const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

const derivedWallet = await client.deriveWalletByAddress({
  sourceBlockchain: blockchain,
  walletAddress,
  targetBlockchain: blockchain,
});

const walletId = derivedWallet.data?.wallet?.id;
if (!walletId) {
  throw new Error(`Could not resolve wallet ID from source address ${walletAddress}.`);
}
console.log(`Resolved wallet ID: ${walletId}`);
console.log(`Sending token: ${tokenSymbol} (${tokenAddress})`);

const transactionResponse = await client.createTransaction({
  blockchain,
  walletAddress,
  destinationAddress,
  amount: [amountArg],
  tokenAddress,
  fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
});

const txId = transactionResponse.data?.id;
if (!txId) {
  throw new Error('createTransaction did not return a transaction id.');
}
console.log(`Transaction submitted: ${txId} (initial state: ${transactionResponse.data?.state})`);

let finalTransaction;
while (true) {
  const { data } = await client.getTransaction({ id: txId });
  const transaction = data?.transaction;
  const state = transaction?.state;
  console.log(`Polling transaction ${txId}: state=${state}`);

  if (state && TERMINAL_STATES.has(state)) {
    finalTransaction = transaction;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

if (finalTransaction?.state === 'COMPLETE') {
  console.log('Transfer complete.');
  console.log(`${EXPLORER_BASE}/${finalTransaction.txHash}`);
} else {
  console.error(`Transaction ended in state ${finalTransaction?.state}. Full response:`);
  console.error(JSON.stringify(finalTransaction, null, 2));
  if (finalTransaction?.state === 'FAILED') {
    console.error(
      'FAILED usually means insufficient balance for amount + gas, or an on-chain revert. ' +
        'Fund the wallet at https://faucet.circle.com/ if balance is the cause.'
    );
  }
  if (finalTransaction?.state === 'DENIED') {
    console.error(
      'DENIED means Circle Compliance Engine blocked this transfer (e.g. sanctioned/high-risk address).'
    );
  }
  process.exit(1);
}

const balanceResponse = await client.getWalletTokenBalance({ id: walletId });
console.log('\nCurrent token balances:');
for (const balance of balanceResponse.data?.tokenBalances ?? []) {
  console.log(`  ${balance.token.symbol ?? balance.token.name}: ${balance.amount}`);
}

const outboundResponse = await client.listTransactions({
  walletIds: [walletId],
  txType: 'OUTBOUND',
});
console.log('\nRecent outbound transactions:');
for (const tx of outboundResponse.data?.transactions ?? []) {
  console.log(`  ${EXPLORER_BASE}/${tx.txHash}`);
  console.log(`    destination: ${tx.destinationAddress}`);
  console.log(`    amount: ${tx.amounts?.join(', ')}`);
  console.log(`    state: ${tx.state}`);
  console.log(`    date: ${tx.createDate}`);
}
