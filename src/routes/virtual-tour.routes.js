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
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
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
