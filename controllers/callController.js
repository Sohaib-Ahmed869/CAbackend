const twilio = require("twilio");
const client = new twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Controller to handle call initiation
exports.makeCall = async (req, res) => {
  const { applicationId } = req.body;
  const customerPhoneNumber = "+61455236622 "; // Retrieve from DB based on applicationId
  console.log('spoke1')
  try {
    const call = await client.calls.create({
      url: `${process.env.SERVER_URL}/api/call/ivr-welcome`, // URL to TwiML instructions
      to: customerPhoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
    });
    console.log('spoke2')
    res.send({ status: "call initiated", callSid: call.sid });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// Controller to handle IVR welcome
exports.ivrWelcome = (req, res) => {
  try {
    const twiml = new client.twiml.VoiceResponse();
    console.log('spoke3', twiml)
    twiml.say(
      "Hello, this is Certified Australia. Press 1 for Certification, or press 0 to cancel."
    );

    console.log('spoke')

    // Gather user input
    twiml.gather({
      action: `${process.env.SERVER_URL}/api/call/handle-ivr-response`,
      numDigits: 1,
      timeout: 5,
    });

    res.type("text/xml");
    res.send(twiml.toString());
  } catch (error) {
    console.log('hello')
    console.log(error)
    res.status(500).send({ error: error.message });
  }
};

// Controller to handle IVR response
exports.handleIvrResponse = (req, res) => {
  try {
    const digits = req.body.Digits;
    const twiml = new client.twiml.VoiceResponse();

    if (digits === "1") {
      // Forward call to another person for certification
      twiml.dial(process.env.ACTUAL_PERSON_PHONE_NUMBER); // Person who will handle certifications
    } else if (digits === "0") {
      // Hang up the call and respond with call rejected
      twiml.say("You have chosen to cancel. Goodbye.");
      twiml.hangup();
    } else {
      // Invalid input, replay the message
      twiml.redirect(`${process.env.SERVER_URL}/api/ivr-welcome`);
    }

    res.type("text/xml");
    res.send(twiml.toString());
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};
