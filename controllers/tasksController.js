// controllers/taskController.js
const { db } = require("../firebase");

const createTask = async (req, res) => {
  try {
    const { title, agentName } = req.body;

    const newTask = {
      title,
      status: "todo",
      createdBy: agentName,
      createdAt: new Date().toISOString(),
      assignedTo: "",
      priority: "medium",
      description: "",
      checklist: [],
      comments: [],
      dueDate: null,
    };

    const docRef = await db.collection("tasks").add(newTask);
    res.status(201).json({ id: docRef.id, ...newTask });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateTaskDetails = async (req, res) => {
  try {
    const { taskId } = req.params;
    let updates = req.body;
    const { agentName, role } = req.body;

    const taskRef = db.collection("tasks").doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return res.status(404).json({ message: "Task not found" });
    }

    const taskData = taskDoc.data();

    // Authorization checks
    if (role === "agent") {
      // Prevent agents from modifying manager-created tasks not assigned to them
      if (
        taskData.createdBy === "manager" &&
        taskData.assignedTo !== agentName
      ) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Prevent agents from changing assignment or creator
      delete updates.assignedTo;
      delete updates.createdBy;

      // Allow updates only on limited fields if it's their own task
      if (taskData.createdBy === agentName) {
        const allowedFields = [
          "title",
          "description",
          "priority",
          "dueDate",
          "checklist",
          "comments",
        ];
        updates = Object.keys(updates)
          .filter((key) => allowedFields.includes(key))
          .reduce((obj, key) => {
            obj[key] = updates[key];
            return obj;
          }, {});
      }
    }

    await taskRef.update(updates);
    res.status(200).json({ id: taskId, ...updates });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, agentName, role } = req.body;

    const taskRef = db.collection("tasks").doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return res.status(404).json({ message: "Task not found" });
    }

    const taskData = taskDoc.data();

    // Authorization check
    if (
      role === "agent" &&
      taskData.createdBy === "manager" &&
      taskData.assignedTo !== agentName
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await taskRef.update({ status });
    res.status(200).json({ message: "Status updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// const getAllTasks = async (req, res) => {
//   try {
//     const snapshot = await db.collection("tasks").get();
//     const tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
//     res.status(200).json(tasks);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };
const getAllTasks = async (req, res) => {
  try {
    let query = db.collection("tasks");
    const { range, startDate, endDate } = req.query;

    let startDateFilter;
    let endDateFilter = new Date().toISOString(); // Default to current time

    // Handle predefined ranges
    if (range) {
      const now = new Date();
      switch (range) {
        case "1week": {
          const start = new Date(now);
          start.setDate(start.getDate() - 7);
          startDateFilter = start.toISOString();
          break;
        }
        case "15days": {
          const start = new Date(now);
          start.setDate(start.getDate() - 15);
          startDateFilter = start.toISOString();
          break;
        }
        case "1month": {
          const start = new Date(now);
          start.setDate(start.getDate() - 30);
          startDateFilter = start.toISOString();
          break;
        }
        default: {
          const start = new Date(now);
          start.setDate(start.getDate() - 7);
          startDateFilter = start.toISOString();
          break;
        }
      }
    }
    // Handle custom date range
    else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          message: "Invalid date format. Use ISO strings (e.g., YYYY-MM-DD).",
        });
      }

      // Adjust to start and end of day in UTC
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);

      startDateFilter = start.toISOString();
      endDateFilter = end.toISOString();
    }
    // Default to last 1 week
    else {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      startDateFilter = start.toISOString();
    }

    // Apply filters to Firestore query
    query = query
      .where("createdAt", ">=", startDateFilter)
      .where("createdAt", "<=", endDateFilter);

    const snapshot = await query.get();
    const tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
module.exports = {
  createTask,
  updateTaskDetails,
  updateTaskStatus,
  getAllTasks,
};
