import { Router, Request, Response } from "express";
import { identify } from "../services/identifyService";
import type { IdentifyRequest } from "../types";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const body: IdentifyRequest = req.body;

    // Validate: at least one field must be present
    if (
      body.email === undefined &&
      body.phoneNumber === undefined
    ) {
      res.status(400).json({
        error: "Request body must contain at least one of: email, phoneNumber",
      });
      return;
    }

    const contact = await identify(body);
    res.status(200).json({ contact });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

export default router;
