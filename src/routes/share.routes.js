// share.routes.js
import { Router } from "express";
import { ShareProperty } from "../controllers/property.controller.js";

const router = Router();

// IMPORTANT: this must return HTML, not JSON
router.get("/property/:id", ShareProperty);

export default router;
