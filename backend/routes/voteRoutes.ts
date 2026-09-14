import { Router } from "express";

import {
  castVote,
} from "../controllers/voteController.js";
import { authenticateVoter } from "../middleware/voterAuthMiddleware.js";
import { voteRateLimiter } from "../middleware/rateLimiters.js";

const router = Router();

/*
 * Cast a student vote.
 *
 * POST /api/votes
 *
 * Body:
 * {
 *   "registration_number": "A131G1000224",
 *   "election_id": 2,
 *   "candidate_id": 5
 * }
 */
router.post(
  "/",
  voteRateLimiter,
  authenticateVoter,
  castVote
);

export default router;

