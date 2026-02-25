// Group denormalized join rows into Property objects with Images[]
export function rowsToProperties(rows) {
  const map = new Map();

  for (const r of rows) {
    const id = r.PropertyId;
    if (!map.has(id)) {
      map.set(id, {
        id: r.id,
        emriMjekut: r.emriMjekut,
        specialiteti: r.specialiteti,
      })
    }
  }

  return Array.from(map.values());
}
