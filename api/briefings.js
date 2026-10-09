import { db } from "hatchable";

export const access = "public";
export const methods = ["POST"];

function validOwnerKey(value) {
  return typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value);
}

export default async function (req, res) {
  const body = req.body || {};
  const ownerKey = body.ownerKey;
  const action = body.action;
  if (!validOwnerKey(ownerKey)) return res.status(400).json({ error: "A valid private workspace key is required." });

  try {
    if (action === "save") {
      const briefing = body.briefing;
      if (!briefing || typeof briefing !== "object" || !Array.isArray(briefing.items) || !Array.isArray(briefing.decisions)) {
        return res.status(400).json({ error: "A valid briefing is required." });
      }
      const title = String(body.title || "Conversation briefing").slice(0, 120);
      const recap = String(briefing.recap || "").slice(0, 2000);
      const result = await db.query(
        "INSERT INTO saved_briefings (owner_key, title, recap, briefing) VALUES ($1, $2, $3, $4::jsonb) RETURNING id, title, recap, created_at",
        [ownerKey, title, recap, JSON.stringify(briefing)]
      );
      return res.status(201).json({ saved: result.rows[0] });
    }

    if (action === "list") {
      const result = await db.query(
        "SELECT id, title, recap, created_at FROM saved_briefings WHERE owner_key = $1 ORDER BY created_at DESC LIMIT 50",
        [ownerKey]
      );
      return res.json({ briefings: result.rows || [] });
    }

    if (action === "get") {
      const id = String(body.id || "");
      const result = await db.query(
        "SELECT id, title, recap, briefing, created_at FROM saved_briefings WHERE owner_key = $1 AND id = $2 LIMIT 1",
        [ownerKey, id]
      );
      if (!result.rows || !result.rows.length) return res.status(404).json({ error: "Saved briefing not found." });
      return res.json({ saved: result.rows[0] });
    }

    if (action === "delete") {
      const id = String(body.id || "");
      await db.query(
        "DELETE FROM saved_briefings WHERE owner_key = $1 AND id = $2",
        [ownerKey, id]
      );
      return res.json({ deleted: true });
    }

    return res.status(400).json({ error: "Unsupported action. Use save, list, get, or delete." });
  } catch (err) {
    console.log("Saved briefing database operation failed", String(err && err.message || err));
    return res.status(500).json({ error: "The database could not complete that request." });
  }
}