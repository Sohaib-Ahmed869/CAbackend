// callController.js
const twilio = require("twilio");
const client = new twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
exports.initiateCall = async (req, res) => {
  try {
    const customerNumber = "+15005550007"; // Test successful call
    const supportNumber = "+15005550008"; // Test successful call

    // Start the call
    const call = await client.calls.create({
      twiml: `<Response><Dial>${supportNumber}</Dial></Response>`,
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
    res
      .status(200)
      .json({ message: "Call initiated and being tracked", callSid: call.sid });
  } catch (error) {
    console.error("Error initiating call:", error);
    res.status(400).json({ message: "Failed to initiate call", error });
  }
};
