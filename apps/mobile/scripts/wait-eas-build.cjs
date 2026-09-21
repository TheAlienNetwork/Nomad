const { spawnSync } = require('node:child_process');

const id = process.argv[2];
if (!id) {
  console.error('Usage: node wait-eas-build.cjs <build-id>');
  process.exit(1);
}

function statusOf() {
  const result = spawnSync(
    'npx',
    ['eas-cli', 'build:view', id, '--json'],
    { encoding: 'utf8', shell: true, cwd: require('node:path').join(__dirname, '..') },
  );
  const match = result.stdout.match(/\{[\s\S]*\}\s*$/);
  if (!match) {
    throw new Error((result.stderr || result.stdout || 'no json').slice(0, 400));
  }
  return JSON.parse(match[0]);
}

const pending = new Set(['NEW', 'IN_QUEUE', 'IN_PROGRESS']);

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  let build = statusOf();
  console.log(build.status);
  while (pending.has(build.status)) {
    await wait(90_000);
    build = statusOf();
    console.log(build.status);
  }
  if (build.artifacts?.buildUrl) console.log(build.artifacts.buildUrl);
  if (build.status !== 'FINISHED') process.exit(1);
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
