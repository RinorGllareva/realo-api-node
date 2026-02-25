import { getPool, sql } from "../db/mssql.js";
import { rowsToProperties } from "../utils/shape.js";

export async function GetMjeket(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT p.*
      FROM Users p
      ORDER BY p.id DESC
    `);

    const items = rowsToProperties(result.recordset || []);
    res.json(items);
  } catch (err) {
    console.error("GetMjeket error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function GetMjeku(req, res) {
  const id = Number(req.params.id);
  if (!isValidId(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const pool = await getPool();
    const result = await pool.request().input("id", sql.Int, id).query(`
      SELECT p.*
      FROM Users p
      WHERE p.id = @id
    `);

    const items = rowsToProperties(result.recordset || []);
    if (items.length === 0) return res.status(404).json({ error: "Not found" });

    res.json(items[0]);
  } catch (err) {
    console.error("GetMjeku error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function PostMjeku(req, res) {
  const p = req.body;

  try {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const request = new sql.Request(tx);

      const insert = await request
        .input("EmriMjekut", sql.NVarChar(200), p.title ?? "")
        .input("Specialiteti", sql.NVarChar(sql.MAX), p.description ?? "");

      const newId = insert.recordset[0].PropertyId;

      await tx.commit();
      res.status(200).json({ message: "OK", propertyId: newId });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    console.error("PostProperty error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function PutMjeku(req, res) {
  const id = Number(req.params.id);
  if (!isValidId(id)) return res.status(400).json({ error: "Invalid id" });

  const p = req.body;

  try {
    const pool = await getPool();
    await pool
      .request()
      .input("MjekuID", sql.Int, id)
      .input("Specialiteti", sql.NVarChar(200), p.title ?? "");

    res.json({ message: "Mjeku updated successfully!" });
  } catch (err) {
    console.error("PutProperty error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function DeleteMjeku(req, res) {
  const id = Number(req.params.id);
  if (!isValidId(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const pool = await getPool();
    await pool.request().input("id", sql.Int, id).query(`
      DELETE FROM Users WHERE id=@id;
    `);

    res.status(204).send();
  } catch (err) {
    console.error("DeleteMjeku error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
