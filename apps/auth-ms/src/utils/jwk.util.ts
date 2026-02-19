import { readFileSync } from 'fs';
import { importSPKI, exportJWK, type JWK } from 'jose';
import { join } from 'path';

export async function publicKeyToJwk(): Promise<JWK> {
  const pem = readFileSync(
    join(__dirname, '../../public/certs/public.pem'),
    'utf8',
  );
  const key = await importSPKI(pem, 'RS256');
  return exportJWK(key);
}
