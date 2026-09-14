import { Router } from "express";

import {
  getSchools,
} from "../controllers/schoolController.js";

import {
  authenticateAdmin,
} from "../middleware/authMiddleware.js";

const router = Router();

router.get(
  "/",
  authenticateAdmin,
  getSchools
);

export default router;
