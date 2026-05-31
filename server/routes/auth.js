import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { generateToken, authRequired } from "../middleware/auth.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password, name, schoolId, role, language } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "email, password, and name are required" });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      schoolId: schoolId || null,
      role: role || "teacher",
      language: language || "zh",
    });

    const token = generateToken(user);

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        language: user.language,
        quota: user.quota,
        quotaUsed: user.quotaUsed,
      },
      token,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.active) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = generateToken(user);

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        language: user.language,
        quota: user.quota,
        quotaUsed: user.quotaUsed,
        schoolId: user.schoolId,
      },
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message || "Login failed" });
  }
});

router.get("/me", authRequired, (req, res) => {
  res.json({ user: req.user });
});

// PATCH /api/auth/profile — Update own profile
router.patch("/profile", authRequired, async (req, res) => {
  try {
    const { name, language } = req.body;
    const updates = {};

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ error: "Name cannot be empty" });
      updates.name = trimmed;
    }

    if (language !== undefined) {
      if (!["zh", "en"].includes(language)) {
        return res.status(400).json({ error: "Language must be 'zh' or 'en'" });
      }
      updates.language = language;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-passwordHash").lean();

    res.json({ user });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: err.message || "Profile update failed" });
  }
});

// POST /api/auth/change-password — Change own password
router.post("/change-password", authRequired, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ error: err.message || "Password change failed" });
  }
});

export default router;
