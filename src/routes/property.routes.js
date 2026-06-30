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
const propertyMediaLimitMb = Number(process.env.PROPERTY_MEDIA_UPLOAD_LIMIT_MB || 75);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: propertyMediaLimitMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new Error("Only image files can be uploaded."));
    }
    cb(null, true);
  },
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
