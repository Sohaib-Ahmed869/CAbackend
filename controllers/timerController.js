// controllers/timerController.js
const { db } = require("../firebase");

const startTimer = async (req, res) => {
  const { userId } = req.body;
  const date = new Date().toISOString().split("T")[0];
  const docRef = db.collection("timerLogs").doc(`${userId}_${date}`);

  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      const currentData = doc.exists ? doc.data() : { totalTime: 0 };

      transaction.set(
        docRef,
        {
          userId,
          date,
          totalTime: currentData.totalTime,
          lastStartTime: new Date().toISOString(),
          status: "running",
        },
        { merge: true }
      );
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const pauseTimer = async (req, res) => {
  const { userId, elapsed } = req.body;
  const date = new Date().toISOString().split("T")[0];
  const docRef = db.collection("timerLogs").doc(`${userId}_${date}`);

  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) return;

      transaction.update(docRef, {
        totalTime: doc.data().totalTime + elapsed,
        lastStartTime: null,
        status: "paused",
      });
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const pingTimer = async (req, res) => {
  const { userId } = req.body;
  const date = new Date().toISOString().split("T")[0];
  const docRef = db.collection("timerLogs").doc(`${userId}_${date}`);

  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists || doc.data().status !== "running") return;

      const now = new Date();
      const lastStart = new Date(doc.data().lastStartTime);
      const elapsed = Math.floor((now - lastStart) / 1000);

      transaction.update(docRef, {
        totalTime: doc.data().totalTime + elapsed,
        lastStartTime: now.toISOString(),
      });
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// get timer logs
const getAgentTimerLogs = async (req, res) => {
  try {
    // 1. Get all agents
    const agentsSnapshot = await db
      .collection("users")
      .where("type", "==", "agent")
      .get();

    if (agentsSnapshot.empty) {
      return res.status(404).json({ message: "No agents found" });
    }

    const agents = agentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 2. Get query parameters
    const { agentId, date } = req.query;
    const selectedDate = date || new Date().toISOString().split("T")[0];

    // 3. Determine agent IDs to filter
    const agentIds =
      agentId && agentId !== "all"
        ? [agentId]
        : agents.map((agent) => agent.id);

    // 4. Query timer logs
    const logsQuery = db
      .collection("timerLogs")
      .where("userId", "in", agentIds)
      .where("date", "==", selectedDate);

    const logsSnapshot = await logsQuery.get();

    // 5. Combine with agent data
    const logs = logsSnapshot.docs.map((doc) => {
      const logData = doc.data();
      const agent = agents.find((a) => a.id === logData.userId) || {};

      return {
        id: doc.id,
        agentName: agent.name || "Unknown Agent",
        agentEmail: agent.email,
        ...logData,
        date: selectedDate,
      };
    });

    res.status(200).json({
      date: selectedDate,
      totalAgents: agents.length,
      totalLogs: logs.length,
      logs,
    });
  } catch (error) {
    console.error("Error fetching timer logs:", error);
    res.status(500).json({
      message: "Error fetching timer logs",
      error: error.message,
    });
  }
};

module.exports = { startTimer, pauseTimer, pingTimer, getAgentTimerLogs };
