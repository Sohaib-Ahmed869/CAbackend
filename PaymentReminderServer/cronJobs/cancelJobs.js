const cancelJobs = (applicationId, activeJobs) => {
  const emailJob = activeJobs.get(`email-${applicationId}`);
  const paymentJob = activeJobs.get(`payment-${applicationId}`);
  let cancelled = 0;

  if (emailJob) {
    console.log(`🗑️ Cancelling email job for ${applicationId}`);
    emailJob.cancel();
    cancelled++;
  }

  if (paymentJob) {
    console.log(`🗑️ Cancelling payment job for ${applicationId}`);
    paymentJob.cancel();
    cancelled++;
  }

  activeJobs.delete(`email-${applicationId}`);
  activeJobs.delete(`payment-${applicationId}`);

  if (cancelled > 0) {
    console.log(
      `✅ Cancelled ${cancelled} jobs for application ${applicationId}`
    );
  } else {
    console.log(`ℹ️ No active jobs found to cancel for ${applicationId}`);
  }

  return cancelled;
};
module.exports = cancelJobs;
