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

const getAllTasks = async (req, res) => {
  try {
    const snapshot = await db.collection("tasks").get();
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
