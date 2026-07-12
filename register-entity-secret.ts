import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';

const ENV_PATH = './.env';
const RECOVERY_DIR = './recovery';

const apiKey = process.env.CIRCLE_API_KEY;
if (!apiKey) {
  throw new Error('CIRCLE_API_KEY is not set. Add it to .env before running this script.');
}

const envContents = readFileSync(ENV_PATH, 'utf8');
if (/^CIRCLE_ENTITY_SECRET=/m.test(envContents)) {
  throw new Error(
    'CIRCLE_ENTITY_SECRET already exists in .env. Refusing to overwrite an existing entity secret.'
  );
}

const entitySecret = randomBytes(32).toString('hex');
console.log('Generated a new 32-byte entity secret.');

mkdirSync(RECOVERY_DIR, { recursive: true });

const response = await registerEntitySecretCiphertext({
  apiKey,
  entitySecret,
  recoveryFileDownloadPath: RECOVERY_DIR,
});

if (!response.data?.recoveryFile) {
  throw new Error('Registration response did not include a recovery file.');
}

console.log('Entity secret registered with Circle.');
console.log(`Recovery file saved under: ${RECOVERY_DIR}/ (see the "Recovery file written to" line above for the exact filename)`);

appendFileSync(ENV_PATH, `CIRCLE_ENTITY_SECRET=${entitySecret}\n`);
console.log('.env updated with CIRCLE_ENTITY_SECRET.');

console.log(
  '\nIMPORTANT: Copy the recovery file and entity secret into a secrets manager now. ' +
    'The recovery file can only be downloaded once.'
);
