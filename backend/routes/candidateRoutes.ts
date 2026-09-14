import { Router } from "express";

import {
  getElectionCandidates,
  registerCandidate,
  getPendingCandidates,
  updateCandidateApproval,
  getCandidateFile,
  getMyCandidateApplications,
} from "../controllers/candidateController.js";

import {
  authenticateAdmin,
} from "../middleware/authMiddleware.js";

import {
  candidateUpload,
} from "../middleware/candidateUpload.js";
import { candidateSubmissionRateLimiter } from "../middleware/rateLimiters.js";
import { authenticateVoter } from "../middleware/voterAuthMiddleware.js";

const router = Router();

router.get(
  "/mine",
  authenticateVoter,
  getMyCandidateApplications
);

/*
 * Student candidate registration
 *
 * Accepts:
 * - Candidate photo
 * - Motivation video
 * - Fee statement
 * - Previous semester result slip
 *
 * The request must use multipart/form-data.
 */
router.post(
  "/register",
  candidateSubmissionRateLimiter,
  authenticateVoter,
  candidateUpload.fields([
    {
      name: "photo",
      maxCount: 1,
    },
    {
      name: "video",
      maxCount: 1,
    },
    {
      name: "fee_statement",
      maxCount: 1,
    },
    {
      name: "result_slip",
      maxCount: 1,
    },
  ]),
  registerCandidate
);

/*
 * Admin/Super Admin:
 * View candidate applications awaiting review.
 */
router.get(
  "/pending/list",
  authenticateAdmin,
  getPendingCandidates
);

/*
 * Admin/Super Admin:
 * Approve or reject a candidate application.
 */
router.patch(
  "/:candidateId/approval",
  authenticateAdmin,
  updateCandidateApproval
);

router.get(
  "/:candidateId/file/:fileType",
  authenticateAdmin,
  getCandidateFile
);

/*
 * Public:
 * Get approved candidates for an active election.
 *
 * Keep this LAST because /:electionId
 * is a broad parameter route.
 */
router.get(
  "/:electionId",
  getElectionCandidates
);

export default router;
