// callController.js
const twilio = require("twilio");
const client = new twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const { db, auth } = require("../firebase");
exports.initiateCall = async (req, res) => {
  try {
    const UserId = req.params.user_id;

    console.log("Initiating call for user:", UserId);

    //get user phone number from database of firebase
    const userCollection = db.collection("users");
    const userDoc = await userCollection.doc(UserId).get();
    const userData = userDoc.data();
    const customerNumber = "+" + userData.phone;

    console.log("User phone number:", customerNumber);

    const supportNumber = "++61415171890"; // Test successful call

    // Start the call
    const call = await client.calls.create({
      twiml: `
        <Response>
          <Say>Hello, this is certified Australia. Our agent wants to connect with you. Please hold.</Say>
          <Dial>${supportNumber}</Dial>
        </Response>
      `,
      to: customerNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
    });

    console.log("Call initiated:", call.sid);

    // Function to poll for call status
    const pollCallStatus = async (callSid) => {
      try {
        const callDetails = await client.calls(callSid).fetch();
        console.log(
          `Current Status: ${callDetails.status}, Duration: ${
            callDetails.duration || "In Progress"
          } seconds`
        );

        if (callDetails.status === "completed") {
          console.log(
            `Call completed. Total duration: ${callDetails.duration} seconds`
          );
        } else if (callDetails.status === "failed") {
          console.log("Call failed or was canceled.");
        } else {
          setTimeout(() => pollCallStatus(callSid), 2000);
        }
      } catch (error) {
        console.error("Error fetching call details:", error);
      }
    };

    // Start polling
    pollCallStatus(call.sid);

    // Respond immediately, while the call is being tracked
    res.status(200).json({ message: "Call initiated and being tracked" });
  } catch (error) {
    console.error("Error initiating call:", error);
    res.status(400).json({ message: "Failed to initiate call", error });
  }
};
