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

const kit = new AppKit();

console.log(
  `Spending ${amountArg} USDC from the Unified Balance to ${wallet2Address} on Arc_Testnet...`
);

const result = await kit.unifiedBalance.spend({
  from: { adapter, address: wallet1Address },
  to: { adapter, chain: 'Arc_Testnet', address: wallet2Address, recipientAddress: wallet2Address },
  amount: amountArg,
  token: 'USDC',
});

console.log('Spend complete:');
console.log(`  txHash: ${result.txHash}`);
console.log(`  explorer: ${result.explorerUrl}`);
console.log(`  recipient: ${result.recipientAddress}`);
console.log(`  destinationChain: ${result.destinationChain}`);
if (result.allocations) {
  console.log('  allocations pulled from:');
  for (const allocation of result.allocations) {
    console.log(`    ${allocation.amount} from ${allocation.chain} (${allocation.sourceAccount})`);
  }
}
