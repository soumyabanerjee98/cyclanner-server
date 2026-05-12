export const safeParse = (text: string) => {
  try {
    let parsed = JSON.parse(text);

    while (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }

    return parsed;
  } catch {
    return null;
  }
};

export const cleanJSON = (text: string) => {
  if (!text) return '';

  return (
    text
      .replace(/```json/g, '')
      .replace(/```/g, '')

      // smart quotes
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")

      // ALL dash types (CRITICAL FIX)
      .replace(/[\u2010-\u2015\u2212]/g, '-')

      // convert ranges safely (IMPORTANT NEW FIX)
      .replace(/(\d)\s*-\s*(\d)/g, '$1-$2')

      // fix weird spaces
      .replace(/[\u00A0\u202F\u2007\u2009]/g, ' ')

      // normalize approx symbol
      .replace(/≈/g, '~')

      .trim()
  );
};
