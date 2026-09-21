/**

 * Pushes EXPO_PUBLIC_SUPABASE_* from apps/mobile/.env into EAS environments.

 * Does not print secret values. Requires `npx eas-cli login`.

 */

const { readFileSync, existsSync } = require('node:fs');

const { join } = require('node:path');

const { spawnSync } = require('node:child_process');



const envPath = join(__dirname, '..');

const file = join(envPath, '.env');

if (!existsSync(file)) {

  console.error('Missing apps/mobile/.env — copy from .env.example first.');

  process.exit(1);

}



const env = Object.fromEntries(

  readFileSync(file, 'utf8')

    .split(/\r?\n/)

    .map((line) => line.trim())

    .filter((line) => line && !line.startsWith('#') && line.includes('='))

    .map((line) => {

      const at = line.indexOf('=');

      return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^["']|["']$/g, '')];

    }),

);



const url = env.EXPO_PUBLIC_SUPABASE_URL;

const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const fieldApi = env.EXPO_PUBLIC_HUNTOS_API_URL;

if (!url || !anon) {

  console.error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set in .env');

  process.exit(1);

}



const environments = ['preview', 'production'];



function pushEnv(name, value, visibility) {

  for (const environment of environments) {

    const result = spawnSync(

      'npx',

      [

        'eas-cli',

        'env:set',

        '--name',

        name,

        '--value',

        value,

        '--environment',

        environment,

        '--visibility',

        visibility,

        '--non-interactive',

      ],

      { cwd: envPath, stdio: ['ignore', 'pipe', 'pipe'], shell: true, encoding: 'utf8' },

    );

    if (result.status !== 0) {

      const err = String(result.stderr || result.stdout || '');

      console.error(`Failed to set ${name} for ${environment}:`, err.trim() || `exit ${result.status}`);

      process.exit(result.status ?? 1);

    }

    console.log(`Set EAS env ${name} on ${environment} (${visibility}).`);

  }

}



pushEnv('EXPO_PUBLIC_SUPABASE_URL', url, 'plaintext');

pushEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', anon, 'sensitive');

if (fieldApi) {

  pushEnv('EXPO_PUBLIC_HUNTOS_API_URL', fieldApi.replace(/\/$/, ''), 'plaintext');

} else {

  console.log('EXPO_PUBLIC_HUNTOS_API_URL not set — Score/Terrain stay unknown on Play until it is.');

}

console.log('EAS environments ready. .env was not committed.');


