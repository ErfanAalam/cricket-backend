// find user by transactionId
import { OtpRequest, User } from "../models/User.js";
import bcrypt from "bcryptjs";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SECRET_KEY = 0xa3b1c2d3n;

function base62Encode(num) {
  let encoded = "";
  const base = 62n;
  num = BigInt(num);
  while (num > 0n) {
    encoded = BASE62[Number(num % base)] + encoded;
    num = num / base;
  }
  return encoded.padStart(8, "0");
}
function base62Decode(str) {
  let num = 0n;
  const base = 62n;
  for (let char of str) {
    const value = BigInt(BASE62.indexOf(char));
    num = num * base + value;
  }
  return num;
}
function encrypt(phoneNumber) {
  if (!/^\d{12}$/.test(phoneNumber)) {
    throw new Error("Phone number must be exactly 10 digits.");
  }
  const num = BigInt(phoneNumber);
  const obfuscated = num ^ SECRET_KEY;
  return base62Encode(obfuscated);
}
function decrypt(cipherText) {
  if (!/^[0-9A-Za-z]{8}$/.test(cipherText)) {
    throw new Error("Cipher text must be exactly 8 base62 characters.");
  }
  const decoded = base62Decode(cipherText);
  const original = decoded ^ SECRET_KEY;
  return original.toString().padStart(10, "0");
}
function generateAlphaCode() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const findUserByPhone = async (phone) => {
  try {
    const user = await User.findOne({ mobile: phone });
    if (!user) {
      return { success: false, code: 404, message: "User not found" };
    }

    return { success: true, code: 200, data: user };
  } catch (error) {
    console.error("Error finding user by phone:", error);
    return {
      success: false,
      code: 500,
      message: "Error finding user by phone",
    };
  }
};

const findOtpByPhone = async (phone) => {
  try {
    const otp = await OtpRequest.findOne({ phone });
    if (!otp) {
      return { success: false, code: 404, message: "OTP not found" };
    }
    return { success: true, code: 200, data: otp };
  } catch (error) {
    console.error("Error finding OTP:", error);
    return { success: false, code: 500, message: "Error finding OTP" };
  }
};

const createNewUser = async (name, mobile, password, referralCode) => {
  try {
    // Check if user already exists
    let user = await findUserByPhone(mobile);
    if (user.code == 200) {
      return { success: false, code: 409, message: "User already exists" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // CRST-0GDt8GQT-A7F
    let newUser;
    if (referralCode) {
      const validReferral = await findReferral(referralCode);
      if (!validReferral) {
        return { success: false, code: 403 };
      }
      newUser = new User({
        name,
        mobile,
        password: hashedPassword,
        referredBy: referralCode,
        referralCodes: [],
      });
    } else {
      newUser = new User({
        name,
        mobile,
        password: hashedPassword,
        referralCodes: [],
      });
    }
    await newUser.save();
    return { success: true, code: 201, data: newUser };
  } catch (err) {
    console.error("Error creating user:", err);
    return { success: false, code: 400 };
  }
};

const findReferral = async (referralCode) => {
  try {
    const phone = `+${decrypt(referralCode.split("-")[1])}`;

    const user = await User.findOne({
      mobile: phone,
      referralCodes: referralCode,
    });

    if (!user) {
      console.log("No user found with this referral code");
      return {
        success: false,
        message: "User not found or referral code does not exist",
      };
    }

    await User.updateOne(
      { mobile: phone },
      { $pull: { referralCodes: referralCode }, $inc: { totalReferrals: 1 } }
    );

    console.log("Referral code removed and totalReferrals incremented");
    return true;
  } catch (err) {
    return { success: false, message: "Server error", error: err };
  }
};

const deleteOldOtpRequests = async () => {
  try {
    await OtpRequest.deleteMany({});

    console.log(`Deleted all OTP Requests in the DB`);
  } catch (error) {
    console.error("Error deleting old OTP requests:", error);
  }
};

const deleteOldReferrals = async () => {
  try {
    await User.updateMany({}, { $unset: { referralCodes: [] } });
    console.log(`Deleted all users with no referral codes in the DB`);
  } catch (error) {
    console.error("Error deleting old OTP requests:", error);
  }
};

// utils/paymentHelpers.js
function isTransactionTimedOut(transactionTime) {
  const now = Date.now();
  return now - new Date(transactionTime).getTime() > 3 * 60 * 1000;
}

function mapCashfreeStatus(cfStatus, isTimeout) {
  if (cfStatus === "PAID") return "SUCCESS";
  if (cfStatus === "ACTIVE") return isTimeout ? "FAILED" : "PENDING";
  return "FAILED";
}

export {
  findUserByPhone,
  findOtpByPhone,
  createNewUser,
  deleteOldOtpRequests,
  deleteOldReferrals,
  mapCashfreeStatus,
  isTransactionTimedOut
};

