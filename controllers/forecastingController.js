// controllers/forecastingController.js
const { db } = require("../firebase");
const moment = require("moment-timezone");
const { TIME_ZONES } = require("../utils/timeZoneConstants");

// Get comprehensive forecasting data
const getForecastingData = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      forecastPeriod = 12, // months
      includePaymentPlans = true,
      includeDirectDebits = true,
      includePartialPayments = true,
    } = req.query;

    // Set default date range if not provided
    const defaultStartDate = moment().startOf("month").toDate();
    const defaultEndDate = moment()
      .add(parseInt(forecastPeriod), "months")
      .endOf("month")
      .toDate();

    const start = startDate ? new Date(startDate) : defaultStartDate;
    const end = endDate ? new Date(endDate) : defaultEndDate;

    // Fetch all applications
    const applicationsSnapshot = await db.collection("applications").get();
    const applications = applicationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter out archived applications
    const activeApplications = applications.filter((app) => !app.archive);

    // Initialize forecasting data structure
    const forecastData = {
      summary: {
        totalExpectedRevenue: 0,
        totalReceivables: 0,
        totalDirectDebitRevenue: 0,
        totalPaymentPlanRevenue: 0,
        totalPartialPaymentRevenue: 0,
        averageMonthlyRevenue: 0,
        riskAssessment: {
          lowRisk: 0,
          mediumRisk: 0,
          highRisk: 0,
        },
      },
      monthlyBreakdown: [],
      receivables: {
        overdue: [],
        upcoming: [],
        paymentPlans: [],
        directDebits: [],
      },
      riskAnalysis: {
        byPaymentMethod: {},
        byTimeframe: {},
        byAmount: {},
      },
    };

    // Process each application for forecasting
    for (const application of activeApplications) {
      await processApplicationForecasting(
        application,
        forecastData,
        start,
        end
      );
    }

    // Generate monthly breakdown
    generateMonthlyBreakdown(forecastData, start, end);

    // Calculate summary statistics
    calculateSummaryStatistics(forecastData);

    // Perform risk analysis
    performRiskAnalysis(forecastData);

    res.status(200).json({
      success: true,
      data: forecastData,
      metadata: {
        startDate: start,
        endDate: end,
        totalApplicationsAnalyzed: activeApplications.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating forecasting data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate forecasting data",
      error: error.message,
    });
  }
};

// Process individual application for forecasting
const processApplicationForecasting = async (
  application,
  forecastData,
  startDate,
  endDate
) => {
  const currentDate = moment();

  // Handle Payment Plans
  if (application.paymentPlanEnabled && application.paymentPlan) {
    await processPaymentPlanForecasting(
      application,
      forecastData,
      startDate,
      endDate
    );
  }

  // Handle Partial Payments (2-part payment scheme)
  else if (application.partialScheme) {
    await processPartialPaymentForecasting(
      application,
      forecastData,
      startDate,
      endDate
    );
  }

  // Handle Direct Debit (non-payment plan)
  else if (application.autoDebit?.enabled) {
    await processDirectDebitForecasting(
      application,
      forecastData,
      startDate,
      endDate
    );
  }

  // Handle Regular Unpaid Applications
  else if (!application.paid && !application.full_paid) {
    await processUnpaidApplicationForecasting(
      application,
      forecastData,
      startDate,
      endDate
    );
  }
};

// Process payment plan forecasting
const processPaymentPlanForecasting = async (
  application,
  forecastData,
  startDate,
  endDate
) => {
  const paymentPlan = application.paymentPlan;

  if (!paymentPlan.paymentSchedule || paymentPlan.status === "COMPLETED")
    return;

  const pendingPayments = paymentPlan.paymentSchedule.filter(
    (payment) => payment.status === "PENDING"
  );

  for (const payment of pendingPayments) {
    const dueDate = moment(payment.dueDate);

    if (dueDate.isBetween(startDate, endDate, null, "[]")) {
      const receivable = {
        applicationId: application.applicationId || application.id,
        type: "payment_plan",
        amount: parseFloat(payment.amount) || 0,
        dueDate: dueDate.toDate(),
        paymentNumber: payment.paymentNumber,
        isDirectDebit: paymentPlan.directDebit?.enabled || false,
        riskLevel: calculateRiskLevel(application, payment, dueDate),
        customerInfo: {
          name: `${application.user?.firstName || ""} ${
            application.user?.lastName || ""
          }`.trim(),
          email: application.user?.email,
          phone: application.user?.phone,
        },
      };

      if (receivable.isDirectDebit) {
        forecastData.receivables.directDebits.push(receivable);
      } else {
        forecastData.receivables.paymentPlans.push(receivable);
      }
    }
  }
};

// Process partial payment forecasting
const processPartialPaymentForecasting = async (
  application,
  forecastData,
  startDate,
  endDate
) => {
  // If first payment not made yet
  if (!application.paid) {
    const estimatedDueDate = moment().add(7, "days"); // Estimate 7 days for first payment

    if (estimatedDueDate.isBetween(startDate, endDate, null, "[]")) {
      forecastData.receivables.upcoming.push({
        applicationId: application.applicationId || application.id,
        type: "partial_payment_1",
        amount: parseFloat(application.payment2) || 0,
        dueDate: estimatedDueDate.toDate(),
        riskLevel: calculateRiskLevel(application, null, estimatedDueDate),
        customerInfo: {
          name: `${application.user?.firstName || ""} ${
            application.user?.lastName || ""
          }`.trim(),
          email: application.user?.email,
          phone: application.user?.phone,
        },
      });
    }
  }

  // If first payment made but second payment pending
  if (
    application.paid &&
    !application.full_paid &&
    application.payment2Deadline
  ) {
    const secondPaymentDate = moment(application.payment2Deadline);

    if (secondPaymentDate.isBetween(startDate, endDate, null, "[]")) {
      const receivable = {
        applicationId: application.applicationId || application.id,
        type: "partial_payment_2",
        amount:
          parseFloat(application.payment1) ||
          parseFloat(application.price) * 0.5 ||
          0,
        dueDate: secondPaymentDate.toDate(),
        isDirectDebit: application.autoDebit?.enabled || false,
        riskLevel: calculateRiskLevel(application, null, secondPaymentDate),
        customerInfo: {
          name: `${application.user?.firstName || ""} ${
            application.user?.lastName || ""
          }`.trim(),
          email: application.user?.email,
          phone: application.user?.phone,
        },
      };

      if (receivable.isDirectDebit) {
        forecastData.receivables.directDebits.push(receivable);
      } else {
        forecastData.receivables.upcoming.push(receivable);
      }
    }
  }
};

// Process direct debit forecasting (non-payment plan)
const processDirectDebitForecasting = async (
  application,
  forecastData,
  startDate,
  endDate
) => {
  if (
    application.autoDebit?.status === "SCHEDULED" &&
    application.autoDebit?.dueDate
  ) {
    const dueDate = moment(application.autoDebit.dueDate);

    if (dueDate.isBetween(startDate, endDate, null, "[]")) {
      forecastData.receivables.directDebits.push({
        applicationId: application.applicationId || application.id,
        type: "direct_debit",
        amount: parseFloat(application.autoDebit.amountDue) || 0,
        dueDate: dueDate.toDate(),
        isDirectDebit: true,
        riskLevel: "low", // Direct debits typically have lower risk
        customerInfo: {
          name: `${application.user?.firstName || ""} ${
            application.user?.lastName || ""
          }`.trim(),
          email: application.user?.email,
          phone: application.user?.phone,
        },
      });
    }
  }
};

// Process unpaid application forecasting
const processUnpaidApplicationForecasting = async (
  application,
  forecastData,
  startDate,
  endDate
) => {
  const createdDate = moment(application.status?.[0]?.time);
  const daysSinceCreation = moment().diff(createdDate, "days");

  // Estimate payment probability based on age and status
  let estimatedPaymentDate;
  let riskLevel;

  if (daysSinceCreation <= 7) {
    estimatedPaymentDate = moment().add(14, "days");
    riskLevel = "medium";
  } else if (daysSinceCreation <= 30) {
    estimatedPaymentDate = moment().add(30, "days");
    riskLevel = "high";
  } else {
    estimatedPaymentDate = moment().add(60, "days");
    riskLevel = "high";
  }

  if (estimatedPaymentDate.isBetween(startDate, endDate, null, "[]")) {
    const price = parseFloat(application.price) || 0;
    const discount = parseFloat(application.discount) || 0;
    const discountedPrice = price - discount;

    forecastData.receivables.upcoming.push({
      applicationId: application.applicationId || application.id,
      type: "full_payment",
      amount: discountedPrice,
      dueDate: estimatedPaymentDate.toDate(),
      riskLevel: riskLevel,
      daysSinceCreation: daysSinceCreation,
      customerInfo: {
        name: `${application.user?.firstName || ""} ${
          application.user?.lastName || ""
        }`.trim(),
        email: application.user?.email,
        phone: application.user?.phone,
      },
    });
  }
};

// Calculate risk level for a payment
const calculateRiskLevel = (application, payment, dueDate) => {
  const now = moment();
  const daysUntilDue = dueDate.diff(now, "days");

  // Factors affecting risk
  let riskScore = 0;

  // Time-based risk
  if (daysUntilDue < 0) riskScore += 3; // Overdue
  else if (daysUntilDue <= 7) riskScore += 2; // Due soon
  else if (daysUntilDue <= 30) riskScore += 1; // Due within month

  // Contact attempts risk
  if (application.contactAttempts >= 3) riskScore += 2;
  else if (application.contactAttempts >= 1) riskScore += 1;

  // Payment history risk
  if (application.partialScheme && !application.paid) riskScore += 1;

  // Application age risk
  const createdDate = moment(application.status?.[0]?.time);
  const daysSinceCreation = now.diff(createdDate, "days");
  if (daysSinceCreation > 60) riskScore += 2;
  else if (daysSinceCreation > 30) riskScore += 1;

  // Convert score to risk level
  if (riskScore <= 2) return "low";
  if (riskScore <= 4) return "medium";
  return "high";
};

// Generate monthly breakdown
const generateMonthlyBreakdown = (forecastData, startDate, endDate) => {
  const months = [];
  const current = moment(startDate).startOf("month");
  const end = moment(endDate).endOf("month");

  while (current.isSameOrBefore(end)) {
    const monthStart = current.clone().startOf("month");
    const monthEnd = current.clone().endOf("month");

    const monthData = {
      month: current.format("YYYY-MM"),
      monthName: current.format("MMMM YYYY"),
      expectedRevenue: 0,
      directDebitRevenue: 0,
      paymentPlanRevenue: 0,
      regularPaymentRevenue: 0,
      riskBreakdown: { low: 0, medium: 0, high: 0 },
      paymentCount: 0,
    };

    // Calculate revenue for this month from all receivables
    [
      ...forecastData.receivables.directDebits,
      ...forecastData.receivables.paymentPlans,
      ...forecastData.receivables.upcoming,
    ].forEach((receivable) => {
      const receivableDate = moment(receivable.dueDate);

      if (receivableDate.isBetween(monthStart, monthEnd, null, "[]")) {
        monthData.expectedRevenue += receivable.amount;
        monthData.paymentCount++;

        // Categorize by type
        if (receivable.isDirectDebit || receivable.type === "direct_debit") {
          monthData.directDebitRevenue += receivable.amount;
        } else if (receivable.type.includes("payment_plan")) {
          monthData.paymentPlanRevenue += receivable.amount;
        } else {
          monthData.regularPaymentRevenue += receivable.amount;
        }

        // Risk breakdown
        monthData.riskBreakdown[receivable.riskLevel] += receivable.amount;
      }
    });

    months.push(monthData);
    current.add(1, "month");
  }

  forecastData.monthlyBreakdown = months;
};

// Calculate summary statistics
const calculateSummaryStatistics = (forecastData) => {
  const allReceivables = [
    ...forecastData.receivables.directDebits,
    ...forecastData.receivables.paymentPlans,
    ...forecastData.receivables.upcoming,
  ];

  forecastData.summary.totalExpectedRevenue = allReceivables.reduce(
    (sum, r) => sum + r.amount,
    0
  );
  forecastData.summary.totalReceivables = allReceivables.length;

  forecastData.summary.totalDirectDebitRevenue =
    forecastData.receivables.directDebits.reduce((sum, r) => sum + r.amount, 0);

  forecastData.summary.totalPaymentPlanRevenue =
    forecastData.receivables.paymentPlans.reduce((sum, r) => sum + r.amount, 0);

  forecastData.summary.totalPartialPaymentRevenue = allReceivables
    .filter((r) => r.type.includes("partial_payment"))
    .reduce((sum, r) => sum + r.amount, 0);

  // Calculate average monthly revenue
  if (forecastData.monthlyBreakdown.length > 0) {
    forecastData.summary.averageMonthlyRevenue =
      forecastData.monthlyBreakdown.reduce(
        (sum, month) => sum + month.expectedRevenue,
        0
      ) / forecastData.monthlyBreakdown.length;
  }

  // Risk assessment - initialize if undefined
  if (!forecastData.summary.riskAssessment.lowRisk)
    forecastData.summary.riskAssessment.lowRisk = 0;
  if (!forecastData.summary.riskAssessment.mediumRisk)
    forecastData.summary.riskAssessment.mediumRisk = 0;
  if (!forecastData.summary.riskAssessment.highRisk)
    forecastData.summary.riskAssessment.highRisk = 0;

  allReceivables.forEach((receivable) => {
    const amount = parseFloat(receivable.amount) || 0;
    const riskKey = receivable.riskLevel + "Risk";
    if (forecastData.summary.riskAssessment[riskKey] !== undefined) {
      forecastData.summary.riskAssessment[riskKey] += amount;
    }
  });
};

// Perform detailed risk analysis
const performRiskAnalysis = (forecastData) => {
  const allReceivables = [
    ...forecastData.receivables.directDebits,
    ...forecastData.receivables.paymentPlans,
    ...forecastData.receivables.upcoming,
  ];

  // Risk by payment method
  forecastData.riskAnalysis.byPaymentMethod = {
    directDebit: { total: 0, low: 0, medium: 0, high: 0 },
    paymentPlan: { total: 0, low: 0, medium: 0, high: 0 },
    regular: { total: 0, low: 0, medium: 0, high: 0 },
  };

  allReceivables.forEach((receivable) => {
    let category = "regular";
    if (receivable.isDirectDebit || receivable.type === "direct_debit") {
      category = "directDebit";
    } else if (receivable.type.includes("payment_plan")) {
      category = "paymentPlan";
    }

    forecastData.riskAnalysis.byPaymentMethod[category].total +=
      receivable.amount;
    forecastData.riskAnalysis.byPaymentMethod[category][receivable.riskLevel] +=
      receivable.amount;
  });

  // Risk by timeframe (next 30, 60, 90+ days)
  const now = moment();
  forecastData.riskAnalysis.byTimeframe = {
    next30Days: { total: 0, low: 0, medium: 0, high: 0 },
    next60Days: { total: 0, low: 0, medium: 0, high: 0 },
    beyond90Days: { total: 0, low: 0, medium: 0, high: 0 },
  };

  allReceivables.forEach((receivable) => {
    const daysUntilDue = moment(receivable.dueDate).diff(now, "days");
    let timeframe;

    if (daysUntilDue <= 30) timeframe = "next30Days";
    else if (daysUntilDue <= 60) timeframe = "next60Days";
    else timeframe = "beyond90Days";

    forecastData.riskAnalysis.byTimeframe[timeframe].total += receivable.amount;
    forecastData.riskAnalysis.byTimeframe[timeframe][receivable.riskLevel] +=
      receivable.amount;
  });
};

// Get overdue payments
const getOverduePayments = async (req, res) => {
  try {
    const overduePayments = [];
    const now = moment();

    // Get all applications with payment plans
    const applicationsSnapshot = await db
      .collection("applications")
      .where("paymentPlanEnabled", "==", true)
      .get();

    const applications = applicationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    for (const application of applications) {
      if (application.paymentPlan?.paymentSchedule) {
        const overdueScheduledPayments =
          application.paymentPlan.paymentSchedule.filter((payment) => {
            const dueDate = moment(payment.dueDate);
            return payment.status === "PENDING" && dueDate.isBefore(now);
          });

        overdueScheduledPayments.forEach((payment) => {
          overduePayments.push({
            applicationId: application.applicationId || application.id,
            type: "payment_plan",
            amount: parseFloat(payment.amount) || 0,
            dueDate: payment.dueDate,
            paymentNumber: payment.paymentNumber,
            daysPastDue: now.diff(moment(payment.dueDate), "days"),
            customerInfo: {
              name: `${application.user?.firstName || ""} ${
                application.user?.lastName || ""
              }`.trim(),
              email: application.user?.email,
              phone: application.user?.phone,
            },
          });
        });
      }
    }

    // Get applications with overdue partial payments
    const partialPaymentSnapshot = await db
      .collection("applications")
      .where("partialScheme", "==", true)
      .where("paid", "==", true)
      .where("full_paid", "==", false)
      .get();

    partialPaymentSnapshot.docs.forEach((doc) => {
      const application = doc.data();
      if (application.payment2Deadline) {
        const dueDate = moment(application.payment2Deadline);
        if (dueDate.isBefore(now)) {
          overduePayments.push({
            applicationId: application.applicationId || doc.id,
            type: "partial_payment_2",
            amount: parseFloat(application.payment2) || 0,
            dueDate: application.payment2Deadline,
            daysPastDue: now.diff(dueDate, "days"),
            customerInfo: {
              name: `${application.user?.firstName || ""} ${
                application.user?.lastName || ""
              }`.trim(),
              email: application.user?.email,
              phone: application.user?.phone,
            },
          });
        }
      }
    });

    // Sort by days past due (most overdue first)
    overduePayments.sort((a, b) => b.daysPastDue - a.daysPastDue);

    res.status(200).json({
      success: true,
      data: overduePayments,
      totalOverdue: overduePayments.length,
      totalOverdueAmount: overduePayments.reduce((sum, p) => sum + p.amount, 0),
    });
  } catch (error) {
    console.error("Error getting overdue payments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get overdue payments",
      error: error.message,
    });
  }
};

// Export forecasting data to CSV
const exportForecastingData = async (req, res) => {
  try {
    const { type = "all" } = req.query;

    // Get forecasting data (reuse the main function logic)
    const forecastResult = await getForecastingData(req, res);

    // This would typically be handled differently in a real implementation
    // For now, we'll return the data in a format suitable for CSV export

    res.status(200).json({
      success: true,
      message:
        "Use the main forecasting endpoint and convert to CSV on frontend",
    });
  } catch (error) {
    console.error("Error exporting forecasting data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export forecasting data",
      error: error.message,
    });
  }
};

module.exports = {
  getForecastingData,
  getOverduePayments,
  exportForecastingData,
};
