export const config = {
  runtime: 'edge',
};

const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
];

export default function handler(request) {
  const country = request.headers.get('x-vercel-ip-country') || 'US';

  let currency = 'USD'; // default
  if (EU_COUNTRIES.includes(country)) {
    currency = 'EUR';
  } else if (country === 'GB') {
    currency = 'GBP';
  }

  return new Response(
    JSON.stringify({ country, currency }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}
