/**
 * npm run gold:pull — copies the XAUUSD minute history from the
 * `data-xauusd` branch (built in GitHub Actions) into data/gold/m1.
 * Plain git traffic: nothing is downloaded from market-data sites here.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const dest = 'data/gold';
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

run('git', ['fetch', '--depth', '1', 'origin', 'data-xauusd']);
rmSync(`${dest}/m1`, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
run('git', ['archive', '--format=tar', '-o', `${dest}/m1.tar`, 'FETCH_HEAD', 'm1']);
run('tar', ['-xf', `${dest}/m1.tar`, '-C', dest]);
rmSync(`${dest}/m1.tar`);
console.log(run('git', ['show', 'FETCH_HEAD:fetch-log.txt']).split('\n').filter(l => /^\d{4}-\d{2}:/.test(l)).slice(-3).join('\n'));
console.log(`gold minute data ready in ${dest}/m1`);
