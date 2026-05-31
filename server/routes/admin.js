import { Router } from "express";
import { authRequired, adminRequired } from "../middleware/auth.js";
import User from "../models/User.js";

const router = Router();

// All admin routes require authentication + admin role
router.use(authRequired, adminRequired);

// GET /api/admin/users — List all users
router.get("/users", async (req, res) => {
  try {
    const users = await User.find()
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to list users" });
  }
});

// GET /api/admin/users/:id — Get single user
router.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-passwordHash")
      .lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to get user" });
  }
});

// PATCH /api/admin/users/:id — Update user (role, quota, active status)
router.patch("/users/:id", async (req, res) => {
  try {
    const { role, quota, active, name } = req.body;
    const updates = {};

    if (role !== undefined) {
      if (!["teacher", "admin"].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be 'teacher' or 'admin'" });
      }
      updates.role = role;
    }

    if (quota !== undefined) {
      const quotaNum = Number(quota);
      if (isNaN(quotaNum) || quotaNum < 0) {
        return res.status(400).json({ error: "Invalid quota value" });
      }
      updates.quota = quotaNum;
    }

    if (active !== undefined) {
      updates.active = Boolean(active);
    }

    if (name !== undefined) {
      updates.name = String(name).trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-passwordHash").lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update user" });
  }
});

// DELETE /api/admin/users/:id — Deactivate user (soft delete)
router.delete("/users/:id", async (req, res) => {
  try {
    // Prevent self-deactivation
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: "Cannot deactivate your own account" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { active: false } },
      { new: true }
    ).select("-passwordHash").lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ user, message: "User deactivated" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to deactivate user" });
  }
});

// GET /api/admin/stats — System statistics
router.get("/stats", async (req, res) => {
  try {
    const [total, active, admins, teachers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ active: true }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "teacher" }),
    ]);

    const totalQuotaUsed = await User.aggregate([
      { $group: { _id: null, total: { $sum: "$quotaUsed" } } },
    ]);

    res.json({
      stats: {
        users: { total, active, admins, teachers },
        quotaUsed: totalQuotaUsed[0]?.total || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to get stats" });
  }
});

export default router;
