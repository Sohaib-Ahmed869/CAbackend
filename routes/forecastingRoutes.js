// routes/forecastingRoutes.js
const express = require("express");
const router = express.Router();
const {
  getForecastingData,
  getOverduePayments,
  exportForecastingData,
} = require("../controllers/forecastingController");

// Import middleware for authentication (adjust path as needed)
// const { authenticateAdmin } = require('../middleware/auth');

/**
 * @route GET /api/forecasting/data
 * @desc Get comprehensive forecasting data including receivables and direct debits
 * @access Admin
 * @params {string} startDate - Start date for forecasting (optional)
 * @params {string} endDate - End date for forecasting (optional)
 * @params {number} forecastPeriod - Number of months to forecast (default: 12)
 * @params {boolean} includePaymentPlans - Include payment plan forecasting (default: true)
 * @params {boolean} includeDirectDebits - Include direct debit forecasting (default: true)
 * @params {boolean} includePartialPayments - Include partial payment forecasting (default: true)
 */
router.get("/data", getForecastingData);

/**
 * @route GET /api/forecasting/overdue
 * @desc Get all overdue payments across all payment types
 * @access Admin
 */
router.get("/overdue", getOverduePayments);

/**
 * @route GET /api/forecasting/export
 * @desc Export forecasting data in various formats
 * @access Admin
 * @params {string} type - Export type: 'all', 'receivables', 'direct_debits', 'payment_plans'
 * @params {string} format - Export format: 'csv', 'excel' (future implementation)
 */
router.get("/export", exportForecastingData);

/**
 * @route GET /api/forecasting/summary
 * @desc Get quick summary of forecasting metrics
 * @access Admin
 */
router.get("/summary", async (req, res) => {
  try {
    // Reuse main forecasting function but return only summary
    const mockReq = { query: { forecastPeriod: 3 } };
    const mockRes = {
      status: () => ({ json: (data) => data }),
      json: (data) => data,
    };

    // You might want to create a separate function for just summary data
    res.status(200).json({
      message:
        "Use /data endpoint with summary flag or create dedicated summary function",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get forecasting summary",
      error: error.message,
    });
  }
});

/**
 * @route GET /api/forecasting/risk-analysis
 * @desc Get detailed risk analysis for receivables
 * @access Admin
 */
router.get("/risk-analysis", async (req, res) => {
  try {
    // This could be extracted from the main forecasting function
    // or implemented as a separate specialized function
    res.status(200).json({
      message: "Risk analysis is included in the main /data endpoint",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get risk analysis",
      error: error.message,
    });
  }
});

/**
 * @route GET /api/forecasting/payment-plans
 * @desc Get forecasting data specifically for payment plans
 * @access Admin
 */
router.get("/payment-plans", async (req, res) => {
  try {
    const modifiedReq = {
      ...req,
      query: {
        ...req.query,
        includeDirectDebits: false,
        includePartialPayments: false,
      },
    };

    await getForecastingData(modifiedReq, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get payment plan forecasting",
      error: error.message,
    });
  }
});

/**
 * @route GET /api/forecasting/direct-debits
 * @desc Get forecasting data specifically for direct debits
 * @access Admin
 */
router.get("/direct-debits", async (req, res) => {
  try {
    const modifiedReq = {
      ...req,
      query: {
        ...req.query,
        includePaymentPlans: false,
        includePartialPayments: false,
      },
    };

    await getForecastingData(modifiedReq, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get direct debit forecasting",
      error: error.message,
    });
  }
});

module.exports = router;
