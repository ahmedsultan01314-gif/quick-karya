import {
  deleteAccountAndAssociatedData,
  enforceFirestoreSecurityAndCleanup
} from '../src/firebase';

function parseArgs(argv: string[]) {
  let email = '';
  let userId = '';
  let workerId = '';
  let phone = '';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' && argv[i + 1]) {
      email = argv[++i];
    } else if (arg.startsWith('--email=')) {
      email = arg.slice('--email='.length);
    } else if (arg === '--user-id' && argv[i + 1]) {
      userId = argv[++i];
    } else if (arg.startsWith('--user-id=')) {
      userId = arg.slice('--user-id='.length);
    } else if (arg === '--worker-id' && argv[i + 1]) {
      workerId = argv[++i];
    } else if (arg.startsWith('--worker-id=')) {
      workerId = arg.slice('--worker-id='.length);
    } else if (arg === '--phone' && argv[i + 1]) {
      phone = argv[++i];
    } else if (arg.startsWith('--phone=')) {
      phone = arg.slice('--phone='.length);
    } else if (!arg.startsWith('--') && arg.includes('@') && !email) {
      email = arg;
    }
  }

  return { email, userId, workerId, phone };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.email && !args.userId && !args.workerId && !args.phone) {
    console.error(
      'Usage: npx tsx scripts/delete-account.ts --email <email> [--user-id <uid>] [--worker-id <id>] [--phone <10digits>]'
    );
    process.exit(1);
  }

  console.log('Running Quick Karya account deletion for:', JSON.stringify(args));
  const deletionReport = await deleteAccountAndAssociatedData(args);
  const cleanupReport = await enforceFirestoreSecurityAndCleanup({ force: true });

  console.log('Deletion Report:', JSON.stringify(deletionReport, null, 2));
  console.log(
    'Post-Cleanup Summary:',
    JSON.stringify(
      {
        usersScanned: cleanupReport.usersScanned,
        usersRetained: cleanupReport.usersRetained,
        deletedMockOrInvalidUsers: cleanupReport.deletedMockOrInvalidUsers,
        workersScanned: cleanupReport.workersScanned,
        workersRetained: cleanupReport.workersRetained,
        errors: cleanupReport.errors
      },
      null,
      2
    )
  );

  process.exit(deletionReport.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Account deletion failed:', err);
  process.exit(1);
});
