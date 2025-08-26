import { checkAndSendSponsorshipNotifications } from '../services/sponsorshipNotificationService';

/**
 * Script to check for new legislation sponsorships and send email notifications
 * This should be run daily via a cron job or scheduled task
 */
async function runSponsorshipNotificationCheck() {
  console.log(`Starting sponsorship notification check at ${new Date().toISOString()}`);

  try {
    await checkAndSendSponsorshipNotifications();
    console.log(`Successfully completed sponsorship notification check at ${new Date().toISOString()}`);
    process.exit(0);
  } catch (error) {
    console.error('Error running sponsorship notification check:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  runSponsorshipNotificationCheck();
}

export { runSponsorshipNotificationCheck };
