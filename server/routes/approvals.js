import { Router } from "express";
import { authRequired, adminRequired } from "../middleware/auth.js";
import { approveAction, denyAction } from "../middleware/approval.js";
import AIAction from "../models/AIAction.js";

const router = Router();

router.get("/", authRequired, adminRequired, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.approvalState = status;
    const actions = await AIAction.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("approvedBy", "name email")
      .populate("userId", "name email")
      .lean();
    res.json({ actions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/approve", authRequired, adminRequired, async (req, res) => {
  try {
    const action = await approveAction(req.params.id, req.user._id);
    if (!action) return res.status(404).json({ error: "Action not found" });
    res.json({ action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/deny", authRequired, adminRequired, async (req, res) => {
  try {
    const action = await denyAction(req.params.id, req.user._id);
    if (!action) return res.status(404).json({ error: "Action not found" });
    res.json({ action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
