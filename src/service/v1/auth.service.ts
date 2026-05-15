import AppError from '@/handler/error.handler.js';
import { signToken } from '@/lib/jwt.js';
import { prisma } from '@/lib/prisma.js';
import bcrypt from 'bcrypt';

export const register = async (data: {
  email: string;
  password: string;
  name?: string;
}) => {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existing) throw new AppError('User already exists', 400);

  const hashed = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashed,
      name: data.name ?? null,
    },
  });

  const token = signToken({ userId: user.id });

  return { user, token };
};

export const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) throw new AppError('User not found', 404);

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) throw new AppError('Invalid credentials', 401);

  const token = signToken({ userId: user.id });

  return { user, token };
};
