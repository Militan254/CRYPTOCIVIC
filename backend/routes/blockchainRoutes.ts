import { Router } from "express";
import {
  registerVoter,
  castVote,
  getCandidateVotes,
} from "../controllers/blockchainController.js";

const router = Router();

router.post("/register-voter", registerVoter);
router.post("/vote", castVote);
router.get("/candidate/:candidateId/votes", getCandidateVotes);

export default router;
