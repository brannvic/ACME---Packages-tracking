import { spawnSync } from 'node:child_process';

// Los valores TEST_DB_* evitan heredar por accidente la base de desarrollo.
const resultado = spawnSync(process.execPath, ['--test', '--test-concurrency=1', 'test/integration/monolito.test.cjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1',
    DB_PORT: process.env.TEST_DB_PORT ?? '55432',
    DB_NAME: process.env.TEST_DB_NAME ?? 'acme_test',
    DB_USER: process.env.TEST_DB_USER ?? 'acme',
    DB_PASSWORD: process.env.TEST_DB_PASSWORD ?? 'acme_desarrollo',
  },
});
if (resultado.error) console.error(resultado.error);
process.exitCode = resultado.status ?? 1;
