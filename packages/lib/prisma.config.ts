import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

// prisma.config.ts is evaluated by the Prisma CLI regardless of the caller's
// cwd, so load the root .env explicitly instead of relying on Prisma's own
// (disabled-when-using-a-config-file) auto-load.
loadEnv({ path: path.resolve(__dirname, '../../.env') })

export default defineConfig({
  schema: '../../prisma/schema.prisma',
  ...(process.env.DIRECT_URL && {
    datasource: {
      url: process.env.DIRECT_URL,
    },
  }),
})
