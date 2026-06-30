import { Router } from "express";
import multer from "multer";
import {
  AddHotspot,
  AddRoom,
  CreateOrUpdateTour,
  DeleteHotspot,
  DeleteRoom,
  GetPanorama,
  GetTourByProperty,
  UpdateHotspots,
  UpdateRooms,
} from "../controllers/virtual-tour.controller.js";

const router = Router();
const panoramaLimitMb = Number(process.env.PANORAMA_UPLOAD_LIMIT_MB || 100);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: panoramaLimitMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new Error("Only panorama image files can be uploaded."));
    }
    cb(null, true);
  },
});

router.get("/GetByProperty/:propertyId", GetTourByProperty);
router.post("/CreateOrUpdate/:propertyId", CreateOrUpdateTour);
router.post("/AddRoom/:propertyId", upload.single("panorama"), AddRoom);
router.put("/UpdateRooms/:tourId", UpdateRooms);
router.delete("/DeleteRoom/:roomId", DeleteRoom);
router.post("/AddHotspot/:fromRoomId", AddHotspot);
router.put("/UpdateHotspots/:roomId", UpdateHotspots);
router.delete("/DeleteHotspot/:hotspotId", DeleteHotspot);
router.get("/GetPanorama/:roomId", GetPanorama);

export default router;
