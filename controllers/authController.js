const { auth } = require("../firebase");
const { getAuth } = require("firebase-admin/auth");

// Customer Login
const customerLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log(email, password);
    const user = await auth.signInWithEmailAndPassword(email, password);

    console.log(user);

    res.status(200).json({ message: "Login successful" });
  } catch (error) {
    res.status(401).json({ message: "Invalid email or password" });
  }
};

module.exports = { customerLogin };
