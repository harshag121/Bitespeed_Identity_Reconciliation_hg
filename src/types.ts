export interface IdentifyRequest {
  email?: string | null;
  phoneNumber?: string | number | null;
}

export interface ContactResponse {
  primaryContatctId: number; // Note: typo is intentional per spec
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

export interface IdentifyResponse {
  contact: ContactResponse;
}

export interface Contact {
  id: number;
  phoneNumber: string | null;
  email: string | null;
  linkedId: number | null;
  linkPrecedence: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
