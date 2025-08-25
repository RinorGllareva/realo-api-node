import { Router } from "express";
import {
  GetProperties,
  GetProperty,
  PostProperty,
  PutProperty,
  DeleteProperty,
  GetPropertyImages,
  AddPropertyImage,
  UpdatePropertyImages,
  DeletePropertyImage,
} from "../controllers/property.controller.js";

const router = Router();

// Matches: /api/Property/GetProperties
router.get("/GetProperties", GetProperties);

// Matches: /api/Property/GetProperty/{id}
router.get("/GetProperty/:id", GetProperty);

// Matches: /api/Property/PostProperty
router.post("/PostProperty", PostProperty);

// Matches: /api/Property/PutProperty/{id}
router.put("/PutProperty/:id", PutProperty);

// Matches: /api/Property/DeleteProperty/{id}
router.delete("/DeleteProperty/:id", DeleteProperty);

// Matches: /api/Property/GetPropertyImages/{propertyId}
router.get("/GetPropertyImages/:propertyId", GetPropertyImages);

// Matches: /api/Property/AddPropertyImage/{propertyId}
router.post("/AddPropertyImage/:propertyId", AddPropertyImage);

// Matches: /api/Property/UpdatePropertyImages/:propertyId
router.put("/UpdatePropertyImages/:propertyId", UpdatePropertyImages);

// Matches: /api/Property/DeletePropertyImage/{propertyId}/{imageId}
router.delete("/DeletePropertyImage/:propertyId/:imageId", DeletePropertyImage);

export default router;
