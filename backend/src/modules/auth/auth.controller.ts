import type { Request, Response } from "express";
import { clientIp } from "../../utils/audit";
import * as authService from "./auth.service";

export async function login(req: Request, res: Response) {
  const data = await authService.login(req.body, clientIp(req));
  res.json({ success: true, data });
}

export async function refresh(req: Request, res: Response) {
  const data = await authService.refresh(req.body.refresh);
  res.json({ success: true, data });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.body.refresh);
  res.json({ success: true, data: { message: "Logged out" } });
}

export async function me(req: Request, res: Response) {
  res.json({ success: true, data: req.user });
}
