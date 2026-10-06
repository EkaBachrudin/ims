import { Router, type RequestHandler } from "express";
import multer from "multer";
import { asyncHandler } from "../../lib/asyncHandler";
import { Errors } from "../../lib/errors";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import {
  createDocumentSchema,
  idParamSchema,
  ingestSchema,
  listChunkSchema,
  listDocumentSchema,
  updateDocumentSchema,
} from "./knowledge.schema";
import * as controller from "./knowledge.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const uploadSingle: RequestHandler = (req, res, next) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : "Upload gagal";
      return next(Errors.validation(message));
    }
    next();
  });
};

export const knowledgeRouter = Router();
knowledgeRouter.use(authenticate, requireRole("SUPER_ADMIN"));

knowledgeRouter.get("/documents", validate(listDocumentSchema), asyncHandler(controller.list));

knowledgeRouter.post(
  "/documents",
  uploadSingle,
  validate(createDocumentSchema),
  asyncHandler(controller.create),
);

knowledgeRouter.get("/documents/:id", validate(idParamSchema), asyncHandler(controller.detail));

knowledgeRouter.patch(
  "/documents/:id",
  validate(updateDocumentSchema),
  asyncHandler(controller.update),
);

knowledgeRouter.delete("/documents/:id", validate(idParamSchema), asyncHandler(controller.remove));

knowledgeRouter.get("/stats", asyncHandler(controller.stats));

knowledgeRouter.get("/chunks", validate(listChunkSchema), asyncHandler(controller.chunks));

knowledgeRouter.post("/ingest", validate(ingestSchema), asyncHandler(controller.ingest));

knowledgeRouter.get("/ingest/status", asyncHandler(controller.ingestStatus));
