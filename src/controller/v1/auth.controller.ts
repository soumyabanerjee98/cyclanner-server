import { authService } from '@/service/index.js';
import type { Request, Response } from 'express';

export const register = async (req: Request, res: Response, next: Function) => {
  try {
    const result = await authService.register(req.body);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: Function) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};
