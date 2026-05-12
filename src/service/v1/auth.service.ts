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

  if (existing) throw new Error('User already exists');

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

  if (!user) throw new Error('User not found');

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) throw new Error('Invalid credentials');

  const token = signToken({ userId: user.id });

  return { user, token };
};
