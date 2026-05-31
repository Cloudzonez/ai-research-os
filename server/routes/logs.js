import { Router } from "express";
import { getLogStats, queryLogs } from "../services/logger.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const result = await queryLogs(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const stats = await getLogStats();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
