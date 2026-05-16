import jwt from "jsonwebtoken";
import { config } from "../config.js";
import User from "../models/User.js";

export function generateToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    config.authSecret,
    { expiresIn: "7d" }
  );
}

export async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, config.authSecret);
    const user = await User.findById(payload.id).select("-passwordHash").lean();
    if (!user || !user.active) {
      return res.status(401).json({ error: "User not found or deactivated" });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function adminRequired(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export function authOptional(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, config.authSecret);
    User.findById(payload.id)
      .select("-passwordHash")
      .lean()
      .then((user) => {
        req.user = user && user.active ? user : null;
        next();
      })
      .catch(() => {
        req.user = null;
        next();
      });
  } catch {
    req.user = null;
    next();
  }
}
