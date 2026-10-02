import type { Request, Response } from "express";
import { clientIp } from "../../lib/http/clientIp";
import { ok } from "../../presentation/http/respond";
import * as authService from "./auth.service";

export async function login(req: Request, res: Response) {
  ok(res, await authService.login(req.body, clientIp(req)));
}

export async function refresh(req: Request, res: Response) {
  ok(res, await authService.refresh(req.body.refresh));
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.body.refresh);
  ok(res, { message: "Logged out" });
}

export async function me(req: Request, res: Response) {
  ok(res, req.user);
}
