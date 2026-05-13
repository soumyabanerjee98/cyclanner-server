import 'dotenv/config';
import crypto from 'crypto';

export const verifyStravaSignature = (
  rawBody: Buffer,
  signatureHeader: string,
) => {
  const secret = process.env.STRAVA_CLIENT_SECRET!;

  // Parse header
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.split('=')),
  );
  console.log("sign parts: ", parts);
  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    return false;
  }

  //  Check timestamp tolerance (5 min)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) {
    console.error('Timestamp outside tolerance');
    return false;
  }

  //  Build signed payload
  const payload = `${timestamp}.${rawBody.toString('utf-8')}`;
  console.log("HMAC payload: ", payload);

  //  Generate HMAC
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  console.log("signatures: sign, expected => ", signature, expected);

  //  Constant-time compare
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};
