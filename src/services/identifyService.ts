import { prisma } from "../lib/prisma";
import type { Contact, IdentifyRequest, ContactResponse } from "../types";

/**
 * Core identity reconciliation logic.
 */
export async function identify(req: IdentifyRequest): Promise<ContactResponse> {
  const { email, phoneNumber } = req;

  // Normalise incoming values and accept numeric phoneNumber payloads.
  const normalEmail = normalizeEmail(email);
  const normalPhone = normalizePhoneNumber(phoneNumber);

  if (!normalEmail && !normalPhone) {
    throw new Error("At least one of email or phoneNumber must be provided.");
  }

  // ── Step 1: Find all existing (non-deleted) contacts that match by email OR phone ──
  const orConditions: object[] = [];
  if (normalEmail) orConditions.push({ email: normalEmail });
  if (normalPhone) orConditions.push({ phoneNumber: normalPhone });

  const matchedContacts: Contact[] = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: orConditions,
    },
  });

  // ── Step 2: No matches → brand new customer ──
  if (matchedContacts.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email: normalEmail,
        phoneNumber: normalPhone,
        linkPrecedence: "primary",
        linkedId: null,
      },
    });

    return buildResponse(newContact.id, [newContact], []);
  }

  // ── Step 3: Collect all distinct roots (primary contact IDs) ──
  const primaryIds = new Set<number>();

  for (const c of matchedContacts) {
    if (c.linkPrecedence === "primary") {
      primaryIds.add(c.id);
    } else if (c.linkedId !== null) {
      primaryIds.add(c.linkedId);
    }
  }

  // ── Step 4: Fetch all contacts in every matching group ──
  // (primary contact + all secondaries linked to it)
  let allGroupContacts: Contact[] = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        { id: { in: Array.from(primaryIds) } },
        { linkedId: { in: Array.from(primaryIds) } },
      ],
    },
  });

  // ── Step 5: Determine THE oldest primary ──
  const primaries = allGroupContacts.filter(
    (c) => c.linkPrecedence === "primary"
  );

  // Sort ascending by createdAt → oldest first
  primaries.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const thePrimary = primaries[0];
  const demotedPrimaries = primaries.slice(1);

  // ── Step 6: Demote newer primaries → secondary ──
  if (demotedPrimaries.length > 0) {
    const demotedIds = demotedPrimaries.map((c) => c.id);

    // Update the demoted primaries themselves
    await prisma.contact.updateMany({
      where: { id: { in: demotedIds } },
      data: {
        linkPrecedence: "secondary",
        linkedId: thePrimary.id,
        updatedAt: new Date(),
      },
    });

    // Re-parent any secondaries that were linked to the demoted primaries
    await prisma.contact.updateMany({
      where: {
        linkedId: { in: demotedIds },
        deletedAt: null,
      },
      data: {
        linkedId: thePrimary.id,
        updatedAt: new Date(),
      },
    });

    // Re-fetch the full merged group
    allGroupContacts = await prisma.contact.findMany({
      where: {
        deletedAt: null,
        OR: [{ id: thePrimary.id }, { linkedId: thePrimary.id }],
      },
    });
  }

  // ── Step 7: Check if incoming request introduces new information ──
  const existingEmails = new Set(
    allGroupContacts.map((c) => c.email).filter(Boolean)
  );
  const existingPhones = new Set(
    allGroupContacts.map((c) => c.phoneNumber).filter(Boolean)
  );

  const newEmailPresent = normalEmail && !existingEmails.has(normalEmail);
  const newPhonePresent = normalPhone && !existingPhones.has(normalPhone);

  if (newEmailPresent || newPhonePresent) {
    // Create a secondary contact with the new info
    const newSecondary = await prisma.contact.create({
      data: {
        email: normalEmail,
        phoneNumber: normalPhone,
        linkedId: thePrimary.id,
        linkPrecedence: "secondary",
      },
    });
    allGroupContacts.push(newSecondary);
  }

  // ── Step 8: Build and return response ──
  const secondaries = allGroupContacts.filter(
    (c) => c.linkPrecedence === "secondary"
  );

  return buildResponse(thePrimary.id, allGroupContacts, secondaries);
}

function normalizeEmail(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("email must be a string or null.");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhoneNumber(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("phoneNumber must be a finite number, string, or null.");
    }
    return String(value);
  }

  throw new Error("phoneNumber must be a string, number, or null.");
}

/**
 * Construct the response payload from the group of contacts.
 */
function buildResponse(
  primaryId: number,
  allContacts: Contact[],
  secondaries: Contact[]
): ContactResponse {
  // Find the primary record from the group
  const primary = allContacts.find((c) => c.id === primaryId)!;

  // Emails: primary first, then unique secondary emails (preserving insertion order)
  const emailSet = new Set<string>();
  if (primary.email) emailSet.add(primary.email);
  for (const c of secondaries) {
    if (c.email) emailSet.add(c.email);
  }

  // Phones: primary first, then unique secondary phones
  const phoneSet = new Set<string>();
  if (primary.phoneNumber) phoneSet.add(primary.phoneNumber);
  for (const c of secondaries) {
    if (c.phoneNumber) phoneSet.add(c.phoneNumber);
  }

  const secondaryContactIds = secondaries
    .map((c) => c.id)
    .sort((a, b) => a - b);

  return {
    primaryContatctId: primaryId,
    emails: Array.from(emailSet),
    phoneNumbers: Array.from(phoneSet),
    secondaryContactIds,
  };
}
