'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const {
  REPO_ROOT,
  EXIT_LOCKED,
  EXIT_IDENTITY,
  LockError,
  IdentityError,
  resolveExecutionIdentity,
  acquireLock,
  releaseLock,
} = require('./run-code-lock.cjs');

const EXIT_USAGE = EXIT_IDENTITY;
const REPORT_REL = path.join('e2e', 'reports', 'generate-report.cjs');

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
    this.exitCode = EXIT_USAGE;
  }
}

function parseArgs(argv) {
  const opts = {
    report: false,
    strict: false,
    onFailure: false,
    lockOnly: false,
    playArgs: [],
    tail: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      opts.tail = argv.slice(i + 1);
      break;
    }
    if (arg.startsWith('--code-')) {
      if (arg === '--code-report') opts.report = true;
      else if (arg === '--code-report-strict') opts.strict = true;
      else if (arg === '--code-report-on-failure') opts.onFailure = true;
      else if (arg === '--code-lock-only') opts.lockOnly = true;
      else throw new UsageError(`flag desconhecida: ${arg}`);
      continue;
    }
    opts.playArgs.push(arg);
  }
  if (opts.lockOnly) {
    if (opts.report || opts.strict || opts.onFailure) {
      throw new UsageError('--code-lock-only é exclusivo e não combina com flags de relatório');
    }
    if (!opts.tail || opts.tail.length === 0) {
      throw new UsageError('--code-lock-only exige comando após --');
    }
    if (opts.playArgs.length > 0) {
      throw new UsageError('--code-lock-only não aceita argumentos antes de --');
    }
    return opts;
  }
  if (opts.tail) opts.playArgs.push(...opts.tail);
  return opts;
}

function printIdentity(identity) {
  console.log(
    `[C.O.D.E.] execução runId=${identity.runId} tentativa=${identity.runAttempt} workflow=${identity.workflowId}`
  );
}

function exitFrom(result) {
  if (result.error) return 127;
  if (typeof result.status === 'number') return result.status;
  return 1;
}

function runNodeScript(args, env) {
  return spawnSync('node', args, { stdio: 'inherit', cwd: REPO_ROOT, env });
}

function runPlaywright(playArgs, env) {
  return spawnSync('npx', ['playwright', 'test', ...playArgs], {
    stdio: 'inherit',
    cwd: REPO_ROOT,
    env,
  });
}

function main(argv) {
  const opts = parseArgs(argv);
  const identity = resolveExecutionIdentity();
  let handle = null;
  let runExit = 0;
  const childEnv = {
    ...process.env,
    CODE_EXECUTION_RUN_ID: identity.runId,
    CODE_EXECUTION_RUN_ATTEMPT: String(identity.runAttempt),
    CODE_EXECUTION_WORKFLOW_ID: identity.workflowId,
  };

  try {
    handle = acquireLock(identity);
    printIdentity(identity);

    if (opts.lockOnly) {
      runExit = exitFrom(
        spawnSync(opts.tail[0], opts.tail.slice(1), {
          stdio: 'inherit',
          cwd: REPO_ROOT,
          env: childEnv,
        })
      );
    } else {
      runExit = exitFrom(runPlaywright(opts.playArgs, childEnv));
      const gate = opts.onFailure || runExit === 0;
      if (gate && (opts.report || opts.strict)) {
        const diagnostics = [];
        if (opts.strict) diagnostics.push([REPORT_REL, '--strict']);
        else if (opts.report) diagnostics.push([REPORT_REL]);
        let diagExit = 0;
        for (const args of diagnostics) {
          const code = exitFrom(runNodeScript(args, childEnv));
          if (diagExit === 0 && code !== 0) diagExit = code;
        }
        if (runExit === 0) runExit = diagExit;
      }
    }
  } finally {
    if (handle) {
      try {
        releaseLock(handle);
      } catch (err) {
        if (err instanceof LockError || err instanceof IdentityError) {
          console.error(`[C.O.D.E.] liberação do lock recusada: ${err.message}`);
          if (runExit === 0) runExit = EXIT_LOCKED;
        } else {
          throw err;
        }
      }
    }
  }
  return runExit;
}

let code = 0;
try {
  code = main(process.argv.slice(2));
} catch (err) {
  if (err instanceof LockError || err instanceof IdentityError || err instanceof UsageError) {
    const kind =
      err instanceof LockError ? 'lock' : err instanceof IdentityError ? 'identidade' : 'uso';
    console.error(`[C.O.D.E.] ${kind}: ${err.message}`);
    code = err.exitCode;
  } else {
    console.error(err && err.stack ? err.stack : String(err));
    code = 1;
  }
}
process.exit(code);
