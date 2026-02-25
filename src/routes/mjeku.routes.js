import { Router } from "express";
import {
  GetMjeket,
  GetMjeku,
  PostMjeku,
  PutMjeku,
  DeleteMjeku,
} from "../controllers/Mjeku.js";

const router = Router();

/* ============= API ROUTES ============= */
router.get("/GetMjeket", GetMjeket);
router.get("/GetMjeku/:id", GetMjeku);
router.post("/PostMjeku", PostMjeku);
router.put("/PutMjeku/:id", PutMjeku);
router.delete("/DeleteMjeku/:id", DeleteMjeku);

export default router;
