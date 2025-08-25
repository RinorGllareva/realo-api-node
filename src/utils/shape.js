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
        state: r.State,
        zipCode: r.ZipCode,
        propertyType: r.PropertyType,
        isForSale: !!r.IsForSale,
        isForRent: !!r.IsForRent,
        price: r.Price,
        bedrooms: r.Bedrooms,
        bathrooms: r.Bathrooms,
        squareFeet: r.SquareFeet,
        isAvailable: !!r.IsAvailable,
        orientation: r.Orientation,
        furniture: r.Furniture,
        heatingSystem: r.HeatingSystem,
        additionalFeatures: r.AdditionalFeatures,
        hasOwnershipDocument: !!r.HasOwnershipDocument,
        spaces: r.Spaces,
        floorLevel: r.FloorLevel,
        country: r.Country,
        neighborhood: r.Neighborhood,
        builder: r.Builder,
        complex: r.Complex,
        latitude: r.Latitude,
        longitude: r.Longitude,
        exteriorVideo: r.ExteriorVideo,
        interiorVideo: r.InteriorVideo,
        images: [],
      });
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
