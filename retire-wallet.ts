import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

// Usage: node --env-file=.env --import=tsx retire-wallet.ts <walletId> <sweepToAddress>
//
// Circle's API has no delete/disable/archive endpoint for individual wallets or wallet sets.
// "Retiring" a wallet means: sweep its funds out, then re-tag it (refId prefixed with
// "archived-") so it's easy to filter out of your active wallet pool via listWallets({ refId }).
// The wallet itself continues to exist and can still technically receive/hold funds afterward.

const NATIVE_GAS_RESERVE = '0.01'; // left behind on the native (gas) token to avoid a stuck sweep tx

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
const [walletId, sweepToAddress] = process.argv.slice(2);

if (!apiKey) throw new Error('CIRCLE_API_KEY is not set in .env.');
if (!entitySecret) throw new Error('CIRCLE_ENTITY_SECRET is not set in .env.');
if (!walletId) throw new Error('Usage: retire-wallet.ts <walletId> <sweepToAddress>');
if (!sweepToAddress) throw new Error('Usage: retire-wallet.ts <walletId> <sweepToAddress>');

const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

async function waitForTerminal(txId: string) {
  const terminal = new Set(['COMPLETE', 'FAILED', 'CANCELLED', 'DENIED', 'STUCK']);
  while (true) {
    const { data } = await client.getTransaction({ id: txId });
    const state = data?.transaction?.state;
    if (state && terminal.has(state)) return data?.transaction;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

const walletResponse = await client.getWallet({ id: walletId });
const wallet = walletResponse.data?.wallet;
if (!wallet) {
  throw new Error(`Wallet ${walletId} not found.`);
}

const balanceResponse = await client.getWalletTokenBalance({ id: walletId });
const balances = balanceResponse.data?.tokenBalances ?? [];

for (const balance of balances) {
  const amount = Number(balance.amount);
  if (amount <= 0) continue;

  const sendAmount = balance.token.isNative
    ? (amount - Number(NATIVE_GAS_RESERVE)).toString()
    : balance.amount;

  if (Number(sendAmount) <= 0) {
    console.log(`Skipping ${balance.token.symbol}: not enough above the gas reserve to sweep.`);
    continue;
  }

  console.log(`Sweeping ${sendAmount} ${balance.token.symbol} to ${sweepToAddress}...`);
  const tx = await client.createTransaction({
    walletId,
    tokenId: balance.token.id,
    destinationAddress: sweepToAddress,
    amount: [sendAmount],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  });

  const txId = tx.data?.id;
  if (!txId) {
    console.error(`  createTransaction did not return an id for ${balance.token.symbol}, skipping wait.`);
    continue;
  }

  const finalTx = await waitForTerminal(txId);
  console.log(`  ${balance.token.symbol} sweep ended in state: ${finalTx?.state}`);
  if (finalTx?.state !== 'COMPLETE') {
    console.error(`  Full response: ${JSON.stringify(finalTx, null, 2)}`);
  }
}

const newRefId = `archived-${wallet.refId ?? wallet.id}`;
await client.updateWallet({ id: walletId, refId: newRefId });
console.log(`Wallet ${walletId} refId updated to "${newRefId}".`);
console.log(
  'Reminder: exclude wallets with an "archived-" refId prefix from your active wallet ' +
    'assignment pool — Circle has no API-level way to disable the wallet itself.'
);
