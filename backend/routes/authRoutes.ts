import { Router } from "express";
import { loginAdmin, loginSuperAdmin } from "../controllers/authController.js";
import { authenticationRateLimiter } from "../middleware/rateLimiters.js";

const router = Router();

router.post("/login", authenticationRateLimiter, loginAdmin);
router.post("/super-admin/login", authenticationRateLimiter, loginSuperAdmin);

export default router;
