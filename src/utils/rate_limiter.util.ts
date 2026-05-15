import rateLimit from 'express-rate-limit';

export const apiLimiter = (params: {
  minutes: number;
  maxRequests: number;
  message: string;
}) =>
  rateLimit({
    windowMs: params.minutes * 60 * 1000, // specified minutes
    max: params.maxRequests, // Limit each IP to the specified number of requests per `windowMs`
    message: params.message,
    standardHeaders: 'draft-7', // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    validate: { xForwardedForHeader: false },
  });
