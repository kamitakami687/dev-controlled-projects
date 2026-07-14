import { encodeFunctionData, keccak256, stringToHex, parseUnits } from 'viem';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const MEMO_CONTRACT = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505';
const USDC_CONTRACT = '0x3600000000000000000000000000000000000000';
const EXPLORER_BASE = 'https://testnet.arcscan.app/tx';
const TERMINAL_STATES = new Set(['COMPLETE', 'FAILED', 'CANCELLED', 'DENIED', 'STUCK']);

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
const wallet1Address = process.env.CIRCLE_WALLET_ADDRESS;
const wallet2Address = process.env.DESTINATION_ADDRESS;

if (!apiKey) throw new Error('CIRCLE_API_KEY is not set in .env.');
if (!entitySecret) throw new Error('CIRCLE_ENTITY_SECRET is not set in .env.');
if (!wallet1Address) throw new Error('CIRCLE_WALLET_ADDRESS is not set in .env.');
if (!wallet2Address) throw new Error('DESTINATION_ADDRESS is not set in .env.');

const amountArg = process.argv[2] ?? '1';
const amount = Number(amountArg);
if (!Number.isFinite(amount) || amount <= 0) {
  throw new Error(`Amount must be a positive number, got: ${amountArg}`);
}

const memoText = process.argv[3] ?? 'test-memo';

const direction = process.argv[4] ?? '1to2';
if (direction !== '1to2' && direction !== '2to1') {
  throw new Error(`Direction must be "1to2" or "2to1", got: ${direction}`);
}

const sourceAddress = direction === '1to2' ? wallet1Address : wallet2Address;
const destinationAddress = direction === '1to2' ? wallet2Address : wallet1Address;

const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

const derivedWallet = await client.deriveWalletByAddress({
  sourceBlockchain: 'ARC-TESTNET',
  walletAddress: sourceAddress,
  targetBlockchain: 'ARC-TESTNET',
});

const walletId = derivedWallet.data?.wallet?.id;
if (!walletId) {
  throw new Error(`Could not resolve wallet ID from source address ${sourceAddress}.`);
}
console.log(`Resolved wallet ID: ${walletId}`);

const amountInMicroUSDC = parseUnits(amountArg, 6);

const transferData = encodeFunctionData({
  abi: [
    {
      name: 'transfer',
      type: 'function',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ type: 'bool' }],
      stateMutability: 'nonpayable',
    },
  ],
  functionName: 'transfer',
  args: [destinationAddress, amountInMicroUSDC],
});

const memoId = keccak256(stringToHex(memoText));
const memoBytes = stringToHex(memoText);

console.log(`Memo text: "${memoText}"`);
console.log(`Memo ID: ${memoId}`);

const transactionResponse = await client.createContractExecutionTransaction({
  walletId,
  contractAddress: MEMO_CONTRACT,
  abiFunctionSignature: 'memo(address,bytes,bytes32,bytes)',
  abiParameters: [USDC_CONTRACT, transferData, memoId, memoBytes],
  fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
});

const txId = transactionResponse.data?.id;
if (!txId) {
  throw new Error('createContractExecutionTransaction did not return a transaction id.');
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
  console.log('Memo transfer complete.');
  console.log(`${EXPLORER_BASE}/${finalTransaction.txHash}`);
} else {
  console.error(`Transaction ended in state ${finalTransaction?.state}. Full response:`);
  console.error(JSON.stringify(finalTransaction, null, 2));
  process.exit(1);
}
