import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const patterns = [
  /\b192\.168\.\d{1,3}\.\d{1,3}\b/,
  /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  /\b172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/,
  /\b[a-z0-9.-]+\.ts\.net\b/i,
  /\/home\/[^/\s]+\/workspace\//,
];
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const failures = [];
for (const path of files) {
  const data = readFileSync(path);
  if (data.includes(0)) continue;
  if (patterns.some((pattern) => pattern.test(data.toString('utf8')))) failures.push(path);
}
if (failures.length) {
  console.error(
    'Keep private deployment information outside public application source. Review:',
    ...failures,
  );
  process.exitCode = 1;
} else console.log('Public source contains no private address, DNS or workspace literals.');
