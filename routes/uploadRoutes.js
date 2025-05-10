import express from "express";
import multer from "multer";
import cloudinary from "../uploadImage/cloudinary.js";// Cloudinary config
import { User } from "../models/User.js"; // Import User model
import authMiddleware from "../middlewares/authMiddleware.js"; // Protect route

const router = express.Router();

// Multer storage setup (temporary storage)
const storage = multer.diskStorage({});
const upload = multer({ storage });

// Route to upload and save user profile image
router.post("/upload-profile", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Upload image to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "user_profiles",
    });



    const userId = req.user.userId; // Get User ID from Token

    // Update User in MongoDB
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profileImage: result.secure_url },
      { new: true }
    ).select("-password"); // Exclude password

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    res.status(500).json({ message: "Image upload failed", error });
  }
});

export default router;
