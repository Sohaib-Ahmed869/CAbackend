const { auth } = require("../firebase");
const { db } = require("../firebase");

const registerAgent = async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    const user = await auth.createUser({
      email,
      password,
    });

    //store in users collection
    await db.collection("users").doc(user.uid).set({
      firstName,
      lastName,
      email,
      role: "agent",
    });

    res.status(200).json({ message: "Agent registered successfully" });
  } catch (error) {
    console.log(error);
    res.status(401).json({ message: "Error registering agent" });
  }
};

const getCustomersByAgentId = async (req, res) => {
  const { agentId } = req.params;

  try {
    const snapshot = await db
      .collection("users")
      .where("role", "==", "customer")
      .where("agentId", "==", agentId)
      .get();

    // Map over the snapshot to include the document ID as `userId`
    const customers = snapshot.docs.map((doc) => ({
      ...doc.data(),
      userId: doc.id, // Set userId as the document ID
    }));

    res.status(200).json({ customers });
  } catch (error) {
    console.log(error);
    res.status(401).json({ message: "Error fetching customers" });
  }
};

const getApplicationsByAgentId = async (req, res) => {
  const { agentId } = req.params;

  try {
    const snapshot = await db
      .collection("applications")
      .where("agentId", "==", agentId)
      .get();

    // Step 2: Check if any applications exist
    if (snapshot.empty) {
      return res
        .status(404)
        .json({ message: "No applications found for this user" });
    }

    // Step 3: Map over the snapshot to get the applications and fetch related forms
    const applications = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const applicationData = doc.data();

        // Fetch initial screening form data if exists
        const initialFormData = applicationData.initialFormId
          ? (
              await db
                .collection("initialScreeningForms")
                .doc(applicationData.initialFormId)
                .get()
            ).data()
          : null;

        // Fetch student intake form data if exists
        const studentFormData = applicationData.studentFormId
          ? (
              await db
                .collection("studentIntakeForms")
                .doc(applicationData.studentFormId)
                .get()
            ).data()
          : null;

        // Fetch documents form data if exists
        const documentsFormData = applicationData.documentsFormId
          ? (
              await db
                .collection("documents")
                .doc(applicationData.documentsFormId)
                .get()
            ).data()
          : null;

        return {
          id: doc.id,
          ...applicationData,
          initialForm: initialFormData,
          studentForm: studentFormData,
          documentsForm: documentsFormData,
        };
      })
    );

    res.status(200).json({ applications });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


module.exports = {
  registerAgent,
  getCustomersByAgentId,
  getApplicationsByAgentId,
 
};
