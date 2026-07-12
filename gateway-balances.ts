import { AppKit } from '@circle-fin/app-kit';
import { adapter } from './gateway-adapter.js';

const wallet1Address = process.env.CIRCLE_WALLET_ADDRESS;
const wallet2Address = process.env.DESTINATION_ADDRESS;
if (!wallet1Address) throw new Error('CIRCLE_WALLET_ADDRESS is not set in .env.');
if (!wallet2Address) throw new Error('DESTINATION_ADDRESS is not set in .env.');

const walletArg = process.argv[2] ?? '1';
if (walletArg !== '1' && walletArg !== '2') {
  throw new Error(`Wallet must be "1" or "2", got: ${walletArg}`);
}

const walletAddress = walletArg === '1' ? wallet1Address : wallet2Address;

const kit = new AppKit();

const result = await kit.unifiedBalance.getBalances({
  token: 'USDC',
  sources: { adapter, address: walletAddress },
  networkType: 'testnet',
  includePending: true,
});

console.log(`Unified balance for ${walletAddress}`);
console.log(`Total confirmed: ${result.totalConfirmedBalance} USDC`);
console.log(`Total pending: ${result.totalPendingBalance ?? '0'} USDC`);

for (const account of result.breakdown) {
  console.log(`\nDepositor: ${account.depositor}`);
  console.log(`  Confirmed: ${account.totalConfirmed} USDC`);
  console.log(`  Pending: ${account.totalPending ?? '0'} USDC`);
  for (const chain of account.breakdown) {
    console.log(`  - ${chain.chain}: confirmed=${chain.confirmedBalance}, pending=${chain.pendingBalance ?? '0'}`);
    for (const tx of chain.pendingTransactions ?? []) {
      console.log(`      pending tx ${tx.transactionHash}: ${tx.amount} at ${tx.blockTimestamp}`);
    }
  }
}
