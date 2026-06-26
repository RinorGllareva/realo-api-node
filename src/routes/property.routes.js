import { Router } from "express";
import multer from "multer";
import {
  GetProperties,
  GetProperty,
  PostProperty,
  PutProperty,
  GetPropertyMedia,
  UpdatePropertyMedia,
  DeleteProperty,
  GetFloorPlanImage,
  GetPropertyImages,
  AddPropertyImage,
  ImportPropertyImages,
  UpdatePropertyImages,
  DeletePropertyImage,
  GetPropertyMainImage,
  GetPropertyImage,
  UploadFloorPlanImage,
  UpscalePropertyImage,
  ShareProperty,
} from "../controllers/property.controller.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

/* ============= API ROUTES ============= */
router.get("/GetProperties", GetProperties);
router.get("/GetProperty/:id", GetProperty);
router.post("/PostProperty", PostProperty);
router.put("/PutProperty/:id", PutProperty);
router.get("/UpdatePropertyMedia/:id", GetPropertyMedia);
router.post("/UpdatePropertyMedia/:id", UpdatePropertyMedia);
router.patch("/UpdatePropertyMedia/:id", UpdatePropertyMedia);
router.get("/GetFloorPlanImage/:propertyId", GetFloorPlanImage);
router.post("/UploadFloorPlanImage/:propertyId", upload.single("floorPlan"), UploadFloorPlanImage);
router.delete("/DeleteProperty/:id", DeleteProperty);
router.get("/GetPropertyImages/:propertyId", GetPropertyImages);
router.get("/GetPropertyMainImage/:propertyId", GetPropertyMainImage);
router.get("/GetPropertyImage/:imageId", GetPropertyImage);
router.post("/AddPropertyImage/:propertyId", upload.single("image"), AddPropertyImage);
router.post("/UpscalePropertyImage/:imageId", UpscalePropertyImage);
router.post("/ImportPropertyImages/:propertyId", ImportPropertyImages);
router.put("/UpdatePropertyImages/:propertyId", upload.single("image"), UpdatePropertyImages);
router.delete("/DeletePropertyImage/:propertyId/:imageId", DeletePropertyImage);

/* OG Share endpoint */
router.get("/ShareProperty/:id", ShareProperty);

export default router;
