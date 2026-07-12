import { AppKit } from '@circle-fin/app-kit';
import { adapter } from './gateway-adapter.js';

const wallet1Address = process.env.CIRCLE_WALLET_ADDRESS;
const wallet2Address = process.env.DESTINATION_ADDRESS;
if (!wallet1Address) throw new Error('CIRCLE_WALLET_ADDRESS is not set in .env.');
if (!wallet2Address) throw new Error('DESTINATION_ADDRESS is not set in .env.');

const amountArg = process.argv[2] ?? '1';
const amount = Number(amountArg);
if (!Number.isFinite(amount) || amount <= 0) {
  throw new Error(`Amount must be a positive number, got: ${amountArg}`);
}

const walletArg = process.argv[3] ?? '1';
if (walletArg !== '1' && walletArg !== '2') {
  throw new Error(`Wallet must be "1" or "2", got: ${walletArg}`);
}

const walletAddress = walletArg === '1' ? wallet1Address : wallet2Address;

const kit = new AppKit();

console.log(
  `Depositing ${amountArg} USDC from ${walletAddress} (Arc_Testnet) into the Unified Balance...`
);

const result = await kit.unifiedBalance.deposit({
  from: { adapter, chain: 'Arc_Testnet', address: walletAddress },
  amount: amountArg,
  token: 'USDC',
});

console.log('Deposit complete:');
console.log(`  amount: ${result.amount} ${result.token}`);
console.log(`  depositedBy: ${result.depositedBy}`);
console.log(`  depositedTo (Gateway account): ${result.depositedTo}`);
console.log(`  chain: ${result.chain}`);
console.log(`  txHash: ${result.txHash}`);
console.log(`  explorer: ${result.explorerUrl}`);
