<<<<<<< HEAD
// Group denormalized join rows into Property objects with Images[]
export function rowsToProperties(rows) {
  const map = new Map();

  for (const r of rows) {
    const id = r.PropertyId;
    if (!map.has(id)) {
      map.set(id, {
        propertyId: r.PropertyId,
        title: r.Title,
        description: r.Description,
        address: r.Address,
        city: r.City,
        propertyType: r.PropertyType,
        isForSale: !!r.IsForSale,
        isForRent: !!r.IsForRent,
        price: r.Price,
        bedrooms: r.Bedrooms,
        bathrooms: r.Bathrooms,
        squareFeet: r.SquareFeet,
        furniture: r.Furniture,
        hasOwnershipDocument: !!r.HasOwnershipDocument,
=======
// Group denormalized join rows into Property objects with Images[]
export function rowsToProperties(rows) {
  const map = new Map();

  for (const r of rows) {
    const id = r.PropertyId;
    if (!map.has(id)) {
      map.set(id, {
        propertyId: r.PropertyId,
        title: r.Title,
        description: r.Description,
        address: r.Address,
        city: r.City,
        propertyType: r.PropertyType,
        isForSale: !!r.IsForSale,
        isForRent: !!r.IsForRent,
        price: r.Price,
        bedrooms: r.Bedrooms,
        bathrooms: r.Bathrooms,
        squareFeet: r.SquareFeet,
        furniture: r.Furniture,
        hasOwnershipDocument: !!r.HasOwnershipDocument,
>>>>>>> 6503b2033be2aa4cc2a26c7ffb34e013902ebeeb
        latitude: r.Latitude,
        longitude: r.Longitude,
        floorPlanUrl: r.FloorPlanUrl ?? "",
        virtualTourUrl: r.VirtualTourUrl ?? "",
        images: [],
      });
<<<<<<< HEAD
    }

    if (r.ImageId) {
      map.get(id).images.push({
        imageId: r.ImageId,
        imageUrl: r.ImageUrl,
        propertyId: r.PropertyId,
      });
    }
  }

  return Array.from(map.values());
}
=======
    }

    if (r.ImageId) {
      map.get(id).images.push({
        imageId: r.ImageId,
        imageUrl: r.ImageUrl,
        propertyId: r.PropertyId,
      });
    }
  }

  return Array.from(map.values());
}
>>>>>>> 6503b2033be2aa4cc2a26c7ffb34e013902ebeeb
