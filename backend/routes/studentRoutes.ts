import { Router } from "express";
import {
  getStudentEligibility,
  loginStudent,
  completeStudentPasswordSetup,
  resendStudentVerificationCode,
  requestPasswordReset,
  completePasswordReset,
} from "../controllers/studentController.js";
import {
  authenticationRateLimiter,
  verificationRateLimiter,
} from "../middleware/rateLimiters.js";
import { authenticateVoter } from "../middleware/voterAuthMiddleware.js";

const router = Router();

router.post(
  "/login",
  authenticationRateLimiter,
  loginStudent
);

router.post(
  "/password-setup",
  verificationRateLimiter,
  completeStudentPasswordSetup
);

router.post(
  "/verification-code/resend",
  verificationRateLimiter,
  resendStudentVerificationCode
);

router.post(
  "/password-reset/request",
  authenticationRateLimiter,
  requestPasswordReset
);

router.post(
  "/password-reset/complete",
  verificationRateLimiter,
  completePasswordReset
);

router.get(
  "/:registrationNumber",
  authenticateVoter,
  getStudentEligibility
);

export default router;

