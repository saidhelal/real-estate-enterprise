import { and, eq } from "drizzle-orm";
import { db, numberSequencesTable } from "@workspace/db";
import { formatSequenceSample } from "./presenters";

/**
 * Generate the next document number for a given document type from the number
 * sequence engine, incrementing the sequence. Returns null when no active
 * sequence is configured for the type (caller should fall back to a default).
 */
export async function nextDocumentNumber(documentType: string): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [seq] = await tx
      .select()
      .from(numberSequencesTable)
      .where(
        and(
          eq(numberSequencesTable.documentType, documentType),
          eq(numberSequencesTable.isActive, true),
          eq(numberSequencesTable.isDeleted, false),
        ),
      )
      .for("update");
    if (!seq) return null;
    const code = formatSequenceSample(seq.prefix, seq.nextNumber, seq.padding, seq.resetYearly);
    await tx
      .update(numberSequencesTable)
      .set({ nextNumber: seq.nextNumber + 1 })
      .where(eq(numberSequencesTable.id, seq.id));
    return code;
  });
}
