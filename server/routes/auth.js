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

export default router;
