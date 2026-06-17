import { createApp } from './app.js';
import { env } from './env.js';
import { pool } from './db/index.js';

async function main() {
  // verify DB connectivity before accepting traffic
  try {
    await pool.query('SELECT 1');
    console.log('✓ Connected to PostgreSQL');
  } catch (err) {
    console.error('✗ Could not connect to PostgreSQL. Check DATABASE_URL in server/.env');
    console.error(err);
    process.exit(1);
  }

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`✓ e-learning API listening on http://localhost:${env.port}/api`);
    console.log(`  CORS origin: ${env.corsOrigin}`);
  });
}

main();
