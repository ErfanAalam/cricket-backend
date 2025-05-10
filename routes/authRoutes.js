import express from "express";
import { User, OtpRequest } from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import twilio from "twilio";
import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";
import authMiddleware from "../middlewares/authMiddleware.js";
import { findUserByPhone, findOtpByPhone, createNewUser } from "../services/actions.js";

dotenv.config();

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const twilioClient = twilio(accountSid, authToken);

const deleteAllReferrals = async (mobile) => {
  await User.updateOne({ mobile }, { $set: { referralCodes: [] } });
  console.log("All Referrals Are Refreshed");
};









// Send OTP
router.post("/send-otp", async (req, res) => {
  const { mobile, resetPassword } = req.body;
  console.log("recieved data:", mobile, resetPassword)

  // Validate mobile number is provided
  if (!mobile) {
    return res.status(400).json({ message: "Mobile number is required" });
  }

  try {
    const gen_otp = Math.floor(100000 + Math.random() * 900000).toString();

    if (!resetPassword) {
      let result = await findUserByPhone(mobile);
      // console.log("User data:", user);
      if (result.success) {
        console.log("otp request for new user signup")
        res.status(409).json({ message: "User already exists" });
        return
      }
    }
    console.log("otp request for reset password")

    let data = await findOtpByPhone(mobile)
    console.log("data: ", data)
    if (data.code === 200) {
      let result = await OtpRequest.deleteOne({ phone: mobile })
      if (result.deletedCount > 0) {
        console.log("Deleted existing OTP record");
      }
    }

    const formattedMobile = mobile.startsWith('+91') ? mobile : `+91${mobile}`;
    console.log("Formatted Mobile Number:", formattedMobile);
    // console.log("checkpoint 1")
    // Save new OTP record
    const otp = new OtpRequest({
      phone: formattedMobile,
      otp: gen_otp
    });

    await otp.save();


    // console.log("checkpoint 2")
    // Send OTP via Twilio
    const message = await twilioClient.messages.create({
      body: `Your OTP is: ${gen_otp}`,
      from: twilioNumber,
      to: formattedMobile // Use formatted number
    });

    res.status(200).json({ message: "OTP sent successfully" });

  } catch (err) {
    console.error("Error sending OTP:", err);
    res.status(500).json({
      message: "Error sending OTP",
      error: err.message,
      details: "Please ensure mobile number is in correct format (+[country code][number])"
    });
  }
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
  const { name, mobile, password, new_password, otp, referralCode } = req.body;
  console.log("Received Data:", name, mobile, password, new_password, otp, referralCode);

  console.log("checkpoint 1")

  try {
    const data = await OtpRequest.findOne({ phone: mobile });
    console.log(data)

    if (!data || data.otp != otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    console.log("checkpoint 2")
    if (new_password) {
      // If the user is resetting their password
      const user = await User.findOne({ mobile });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const hashedPassword = await bcrypt.hash(new_password, 10);
      user.password = hashedPassword;
      await user.save();

      console.log("checkpoint 3")
      res.status(201).json({ message: "Password reset successfully" });
      return;
    }
    // create a new user after verifying the OTP
    console.log("creating new user...")
    const newUser = await createNewUser(name, mobile, password,referralCode);
    if (newUser.success) {
      res.status(201).json({ message: "OTP verified and NEW USER created successfully" });
    }else if (!newUser.success && newUser.code == 403) {
        res.status(403).json({ message: "Invalid Referral Code" });
    } else {
      res.status(newUser.code).json({ message: "Error Inserting New User" });
    }

  } catch (err) {
    res.status(500).json({ message: "Error verifying OTP" });
  }
});

// Set Password
// router.post("/set-password", async (req, res) => {
//   const { mobile, password } = req.body;
//
//   try {
//     const user = await User.findOne({ mobile });
//     if (!user || !user.isVerified) {
//       return res.status(400).json({ message: "User not verified" });
//     }
//
//     const hashedPassword = await bcrypt.hash(password, 10);
//     user.password = hashedPassword;
//     await user.save();
//
//     res.json({ message: "Password set successfully" });
//   } catch (err) {
//     res.status(500).json({ message: "Error setting password" });
//   }
// });

// Login User
router.post("/login", async (req, res) => {
  const { mobile, password } = req.body;
  // console.log("/login : Received mobile number - ", mobile)

  try {
    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    console.log("user id", user._id)

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    user.isLoggedIn = true;
    
    res.json({ token, message: "Login successful" });
  } catch (err) {
    res.status(500).json({ message: "Error logging in" });
  }
});


router.get("/admin-login", async (req, res) => {
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const token = authHeader.split(" ")[1];

    // Verify JWT Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Find user by ID in MongoDB
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.status(200).json({ message: "Admin login successful" });
  }
  catch (err) {
    console.error("❌ Error fetching user data:", err);
    res.status(500).json({ message: "Error fetching user data" });
  }
}
)

router.post("/google-login", async (req, res) => {
  const { tokenId } = req.body;

  if (!tokenId) {
    return res.status(400).json({ message: "Token ID is required" });
  }

  try {
    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    if (!ticket) {
      console.error("Invalid Google token");
      return res.status(401).json({ message: "Invalid Google token" });
    }

    const { email, name, sub } = ticket.getPayload(); // Extract user details

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        email,
        name,
        googleId: sub,
        isVerified: false,
      });
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, message: "Google Sign-In successful" });
  } catch (error) {
    console.error("Google Authentication Error:", error);
    res
      .status(500)
      .json({ message: "Google authentication failed", error: error.message });
  }
});

router.post("/forgot-password/sendOtp", async (req, res) => {
  const { mobile } = req.body;

  try {
    // Check if user exists
    let user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    await user.save();

    // Send OTP via Twilio
    const messsage = await twilioClient.messages.create({
      body: `Your password reset OTP is: ${otp}`,
      from: twilioNumber,
      to: mobile,
    });

    res.json({ message: "OTP sent successfully for password reset" });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ message: "Error sending OTP", error: err.message });
  }
});

router.post("/change-password", async (req, res) => {
  const { mobile, newPassword } = req.body;

  try {
    // Find the user by mobile number
    const user = await User.findOne({ mobile });
    if (!user) {
      return res.json({ message: "User not found" });
    }

    // Check if old password is correct
    // const isMatch = await bcrypt.compare(oldPassword, user.password);
    // if (!isMatch) {
    //   return res.json({ message: "Incorrect old password" });
    // }

    // console.log(user)

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Error changing password:", err);
    res.json({ message: "Server error" });
  }
});

router.get("/user", authMiddleware, async (req, res) => {
  // console.log("/user invoked", req)
  try {
    if (!req.user || !req.user.userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No user data in token" });
    }

    const userId = req.user.userId;

    // Find user by ID in MongoDB
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    console.error("❌ Error fetching user data:", err);
    res.status(500).json({ message: "Error fetching user data" });
  }
});

// For the user who logged in using Google SignIn
router.post("/verify-mobile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ message: "Mobile number is required" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.otp = otp;
    await user.save();

    const message = await twilioClient.messages.create({
      body: `Your OTP is: ${otp}`,
      from: twilioNumber,
      to: mobile,
    });

    res.json({ message: "OTP sent succesfully" });
  } catch (err) {

    res.status(500).json({ message: "Error Sending otp" });
  }
});

router.post("/verify-mobile-otp", authMiddleware, async (req, res) => {
  try {
    console.log("Received Data:", req.body); // ✅ Check what is actually coming in

    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { otp, mobile } = req.body;

    if (!otp || !mobile) {  // ✅ Ensure both values exist
      return res.status(400).json({ message: "OTP and mobile are required" });
    }

    console.log(`Stored OTP: ${user.otp}, Received OTP: ${otp}`); // ✅ Log comparison values

    if (user.otp.toString() !== otp.toString()) { // ✅ Ensure correct comparison
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.mobile = mobile;
    user.isVerified = true;
    user.otp = null;
    await user.save();

    res.json({ message: "Phone verified successfully" });
  } catch (err) {
    console.error("❌ Error verifying OTP:", err);
    res.status(500).json({ message: "Error verifying OTP" });
  }
});

router.post('/add-referral-code',authMiddleware, async(req,res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No user data in token" });
    }
    const userId = req.user.userId;
    const {referralCode} = req.body;
    if(!referralCode){
      res.status(404).json({ message: "No Referral Code Found" });
    }
    const user = await User.findOne({_id:userId});
    if(!user){
      res.status(404).json({ message: "No Such User Found" });
    }
    user.referralCodes.push(referralCode);
    await user.save();
    res.status(200).json({ message: "Added Referral Code" });
  } catch (error) {
    res.status(500).json({ message: error });
  }
})

export default router;
