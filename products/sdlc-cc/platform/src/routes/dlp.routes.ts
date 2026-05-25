/**
 * DLP Routes - Barrel file
 * Composes all DLP sub-route modules into a single router.
 */

import { Router } from "express";
import scanRoutes from "./dlp-scan.routes";
import rulesRoutes from "./dlp-rules.routes";
import policiesRoutes from "./dlp-policies.routes";
import quarantineRoutes from "./dlp-quarantine.routes";
import adminRoutes from "./dlp-admin.routes";
import extensionsRoutes from "./dlp-extensions.routes";

const router = Router();

router.use(scanRoutes);
router.use(rulesRoutes);
router.use(policiesRoutes);
router.use(quarantineRoutes);
router.use(adminRoutes);
router.use(extensionsRoutes);

export default router;
