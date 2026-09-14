import { Router } from "express";

import {
  getElectionResults,
} from "../controllers/resultController.js";

const router = Router();

/*
 * Live election results.
 *
 * GET /api/results/:electionId
 *
 * The endpoint is intentionally public so the
 * voter-facing application can refresh results
 * without requiring an administrator token.
 */
router.get(
  "/:electionId",
  getElectionResults
);

export default router;

