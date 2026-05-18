import { Request, Response, NextFunction } from 'express';
import { getDashboardData, getWeakKeys } from './analytics.service';

export async function handleGetDashboard(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await getDashboardData(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function handleGetWeakKeys(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await getWeakKeys(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
