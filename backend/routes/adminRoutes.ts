import { Router } from "express";

import {
  createAdmin,
  importVoters,
  getAdmins,
  updateAdminRole,
  deleteAdmin,
  getAdminOverview,
  createVoter,
} from "../controllers/adminController.js";

import {
  authenticateAdmin,
  requireSuperAdmin,
} from "../middleware/authMiddleware.js";
import { voterImportUpload } from "../middleware/candidateUpload.js";

const router = Router();

// List all administrators
// SUPER_ADMIN only
router.get(
  "/",
  authenticateAdmin,
  requireSuperAdmin,
  getAdmins
);

// Create a new administrator
// SUPER_ADMIN only
router.post(
  "/",
  authenticateAdmin,
  requireSuperAdmin,
  createAdmin
);

// Change an administrator's role
// SUPER_ADMIN only
router.patch(
  "/:adminId/role",
  authenticateAdmin,
  requireSuperAdmin,
  updateAdminRole
);

router.delete(
  "/:adminId",
  authenticateAdmin,
  requireSuperAdmin,
  deleteAdmin
);

router.get(
  "/overview",
  authenticateAdmin,
  requireSuperAdmin,
  getAdminOverview
);

router.post(
  "/voters",
  authenticateAdmin,
  requireSuperAdmin,
  createVoter
);

router.post(
  "/voters/import",
  authenticateAdmin,
  requireSuperAdmin,
  voterImportUpload.single("file"),
  importVoters
);

export default router;

