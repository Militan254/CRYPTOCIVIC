
import { Router } from "express";

import {
  getEligibleElections,
  createElection,
  getAllElections,
  getOpenElections,
  getElectionById,
  updateElection,
  activateElection,
  closeElection,
  deleteElection,
} from "../controllers/electionController.js";

import {
  authenticateAdmin,
} from "../middleware/authMiddleware.js";
import { authenticateVoter } from "../middleware/voterAuthMiddleware.js";

const router = Router();

/*
 * Student-facing route
 *
 * Must stay above /:electionId so that
 * "eligible" is not interpreted as an election ID.
 */
router.get(
  "/eligible/:registrationNumber",
  authenticateVoter,
  getEligibleElections
);

router.get(
  "/open",
  getOpenElections
);

/*
 * Admin election-management routes
 */
router.post(
  "/",
  authenticateAdmin,
  createElection
);

router.get(
  "/",
  authenticateAdmin,
  getAllElections
);

/*
 * Specific action routes must come BEFORE
 * /:electionId.
 */
router.patch(
  "/:electionId/activate",
  authenticateAdmin,
  activateElection
);

router.patch(
  "/:electionId/close",
  authenticateAdmin,
  closeElection
);

router.patch(
  "/:electionId",
  authenticateAdmin,
  updateElection
);

router.delete(
  "/:electionId",
  authenticateAdmin,
  deleteElection
);

router.get(
  "/:electionId",
  authenticateAdmin,
  getElectionById
);

export default router;
