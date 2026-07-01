import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

// Load .env from server/ first, then fall back to the project root.
// (drizzle-kit runs from server/, so a root-level .env would otherwise be missed.)
for (const candidate of ['.env', '../.env']) {
  const path = resolve(process.cwd(), candidate);
  if (existsSync(path)) {
    config({ path });
    break;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Create a UTF-8 file named exactly ".env" inside the ' +
      'server/ folder containing:\n' +
      '  DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/e_learning\n' +
      'Note: on Windows, make sure the file is not secretly named ".env.txt".'
  );
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
