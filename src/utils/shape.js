import { preferredImageUrl, hasDatabaseImage } from "./images.js";

export function rowsToProperties(rows) {
  const map = new Map();

  for (const row of rows) {
    const id = row.PropertyId;
    if (!id) continue;

    if (!map.has(id)) {
      map.set(id, {
        propertyId: row.PropertyId,
        title: row.Title,
        description: row.Description,
        address: row.Address,
        city: row.City,
        state: row.State,
        zipCode: row.ZipCode,
        propertyType: row.PropertyType,
        isForSale: !!row.IsForSale,
        isForRent: !!row.IsForRent,
        price: row.Price,
        bedrooms: row.Bedrooms,
        bathrooms: row.Bathrooms,
        squareFeet: row.SquareFeet,
        isAvailable: row.IsAvailable,
        listingStatus: row.ListingStatus,
        listedDate: row.ListedDate,
        soldOrRentedDate: row.SoldOrRentedDate,
        orientation: row.Orientation,
        furniture: row.Furniture,
        heatingSystem: row.HeatingSystem,
        additionalFeatures: row.AdditionalFeatures,
        hasOwnershipDocument: !!row.HasOwnershipDocument,
        spaces: row.Spaces,
        floorLevel: row.FloorLevel,
        country: row.Country,
        neighborhood: row.Neighborhood,
        builder: row.Builder,
        complex: row.Complex,
        exteriorVideo: row.ExteriorVideo,
        interiorVideo: row.InteriorVideo,
        latitude: row.Latitude,
        longitude: row.Longitude,
        floorPlanUrl: row.FloorPlanUrl ?? "",
        virtualTourUrl: row.VirtualTourUrl ?? "",
        virtualTourId: row.VirtualTourId ?? null,
        virtualTourRoomCount: Number(row.VirtualTourRoomCount ?? 0),
        hasInternalVirtualTour: !!row.HasInternalVirtualTour,
        hasPublishedVirtualTour: !!row.HasPublishedVirtualTour,
        images: [],
      });
    }

    if (row.ImageId) {
      map.get(id).images.push({
        imageId: row.ImageId,
        imageUrl: preferredImageUrl(row),
        originalUrl: row.OriginalUrl,
        hasImageData: hasDatabaseImage(row),
        mimeType: row.MimeType,
        width: row.Width,
        height: row.Height,
        sortOrder: row.SortOrder ?? 0,
        propertyId: row.PropertyId,
      });
    }
  }

  return Array.from(map.values()).map((property) => ({
    ...property,
    images: property.images.sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}
