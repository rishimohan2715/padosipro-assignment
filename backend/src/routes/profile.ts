import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { publicUser } from "./auth";

const router = Router();

router.use(requireAuth);

const ProfileBody = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  mobile: z
    .string()
    .trim()
    .regex(/^\+91[6-9]\d{9}$/, "Mobile must be a valid Indian number in +91XXXXXXXXXX format."),
  address: z.string().trim().min(5, "Address must be at least 5 characters.").max(300),
  // Business Name is optional: PadosiPro's primary users are households, and
  // many customers won't run a business. Collecting it as required would block
  // legitimate signups. If present, enforce a reasonable length.
  businessName: z.string().trim().min(2).max(120).optional().or(z.literal("")),
});

router.get("/me", async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.put("/me", async (req, res, next) => {
  try {
    const data = ProfileBody.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        name: data.name,
        mobile: data.mobile,
        address: data.address,
        businessName: data.businessName && data.businessName.length > 0 ? data.businessName : null,
        profileComplete: true,
      },
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
