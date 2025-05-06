// controllers/taskController.js
const { db } = require("../firebase");
const NodeCache = require("node-cache");

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
          "applicationId",
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
//
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

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds
let appIdCache = {
  data: null,
  timestamp: null,
};
const getColorLabel = (colorValue) => {
  const colorMap = {
    red: "Hot Lead",
    orange: "Warm Lead",
    gray: "Cold Lead",
    yellow: "Proceeded With Payment",
    lightblue: "Impacted Student",
    pink: "Agent",
    green: "Completed",
    white: "Default",
  };
  return colorMap[colorValue] || "N/A";
};

const getAppIDs = async (req, res) => {
  try {
    // Check cache validity
    // if (appIdCache.data && Date.now() - appIdCache.timestamp < CACHE_TTL) {
    //   console.log("Returning cached application data");
    //   return res.status(200).json(appIdCache.data);
    // }

    // Fetch fresh data from Firestore
    const applicationsRef = db.collection("applications");
    const snapshot = await applicationsRef.get();

    // Process applications in parallel
    const applicationPromises = [];
    snapshot.forEach((doc) => {
      const appData = doc.data();
      const processingPromise = (async () => {
        try {
          // Extract application data
          const applicationId = appData.applicationId;
          const id = appData.id;
          const userId = appData.userId;
          const currentStatus = appData.currentStatus; // Original status field
          const color = appData.color || "white"; // Default to white if color is not set
          const leadStatus = getColorLabel(color); // Get lead status based on color
          const createdAt = doc.createTime.toDate().toISOString();

          if (!applicationId || !userId) return null;

          // Fetch user document with field validation
          const userDoc = await db.collection("users").doc(userId).get();
          const applicantName = userDoc.exists
            ? `${userDoc.data().firstName || ""} ${
                userDoc.data().lastName || ""
              }`.trim()
            : "Unknown";

          return {
            id,
            applicationId,
            applicantName,
            createdAt,
            leadStatus, // Add new lead status based on color
            color, // Include color for reference
            userId, // Include if needed
          };
        } catch (error) {
          console.error(`Error processing application ${doc.id}:`, error);
          return null;
        }
      })();

      applicationPromises.push(processingPromise);
    });

    // Wait for all promises and filter out nulls
    const applicationData = (await Promise.all(applicationPromises)).filter(
      Boolean
    );

    // Update cache with new data structure
    appIdCache = {
      data: applicationData,
      timestamp: Date.now(),
    };

    // Set cache headers
    res.set("Cache-Control", "public, max-age=600");
    res.status(200).json(applicationData);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};
const getApplicationDetails = async (req, res) => {
  const { applicationId } = req.params;

  try {
    // Step 1: Fetch the main application document
    const applicationRef = db.collection("applications").doc(applicationId);
    const doc = await applicationRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const applicationData = doc.data();

    // Step 2: Extract related form IDs from the application
    const formIds = {
      initialFormId: applicationData.initialFormId,
      studentFormId: applicationData.studentFormId,
      documentsFormId: applicationData.documentsFormId,
    };

    // Step 3: Fetch all related forms and user in parallel
    const [
      initialFormSnapshot,
      studentFormSnapshot,
      documentsFormSnapshot,
      userSnapshot,
    ] = await Promise.all([
      formIds.initialFormId
        ? db
            .collection("initialScreeningForms")
            .doc(formIds.initialFormId)
            .get()
        : Promise.resolve(null),
      formIds.studentFormId
        ? db.collection("studentIntakeForms").doc(formIds.studentFormId).get()
        : Promise.resolve(null),
      formIds.documentsFormId
        ? db.collection("documents").doc(formIds.documentsFormId).get()
        : Promise.resolve(null),
      // Fetch user data
      db.collection("users").doc(applicationData.userId).get(),
    ]);

    // Step 4: Build the response with renamed form keys and user data
    const response = {
      ...applicationData,
      isf: initialFormSnapshot?.exists ? initialFormSnapshot.data() : null,
      sif: studentFormSnapshot?.exists ? studentFormSnapshot.data() : null,
      document: documentsFormSnapshot?.exists
        ? documentsFormSnapshot.data()
        : null,
      user: userSnapshot.exists ? userSnapshot.data() : null,
    };

    // Step 5: Return the enriched application data (matching getApplications structure)
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching application",
      error: error.message,
    });
  }
};
module.exports = {
  createTask,
  getAppIDs,
  updateTaskDetails,
  updateTaskStatus,
  getAllTasks,
  getApplicationDetails,
};
