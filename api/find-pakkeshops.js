// api/find-pakkeshops.js — Vercel Serverless Function
// Proxies GLS Denmark's ParcelShop SOAP service. Returns JSON list of nearby shops.
// If a street address is given, shops are returned sorted by distance (nearest first).
// Otherwise falls back to all shops in the zipcode.

export default async function handler(req, res) {
  const zipcode = req.query.zipcode || '';
  const street = req.query.street || '';
  const country = req.query.country || 'DK';
  const amount = parseInt(req.query.amount || '10', 10);

  if (!zipcode) {
    return res.status(400).json({ error: 'zipcode required' });
  }

  const useDistance = street && street.length > 0;
  const methodName = useDistance ? 'GetParcelShopDropPoint' : 'GetParcelShopsInZipcode';

  // GLS sometimes mis-parses street + house number; just use the street name (safe even if empty)
  const streetClean = useDistance ? (street.replace(/\s*\d+\w?$/, '').trim() || street) : '';

  const soapBody = useDistance
    ? `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetParcelShopDropPoint xmlns="http://gls.dk/webservices/">
      <street>${escapeXml(streetClean)}</street>
      <zipcode>${escapeXml(zipcode)}</zipcode>
      <countryIso3166A2>${escapeXml(country)}</countryIso3166A2>
      <Amount>${amount}</Amount>
    </GetParcelShopDropPoint>
  </soap:Body>
</soap:Envelope>`
    : `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetParcelShopsInZipcode xmlns="http://gls.dk/webservices/">
      <zipcode>${escapeXml(zipcode)}</zipcode>
      <countryIso3166A2>${escapeXml(country)}</countryIso3166A2>
    </GetParcelShopsInZipcode>
  </soap:Body>
</soap:Envelope>`;

  try {
    const glsRes = await fetch('https://www.gls.dk/webservices_v4/wsShopFinder.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `"http://gls.dk/webservices/${methodName}"`,
        'User-Agent': 'Mozilla/5.0 (compatible; QuartzMolle/1.0)',
      },
      body: soapBody,
    });

    const xml = await glsRes.text();
    console.log('GLS method:', methodName, 'status:', glsRes.status);

    if (!glsRes.ok) {
      console.error('GLS SOAP error', glsRes.status, xml.slice(0, 500));
      return res.status(502).json({ error: 'GLS service error', status: glsRes.status, body: xml.slice(0, 500), shops: [] });
    }

    const shops = [];
    const shopRegex = /<PakkeshopData>([\s\S]*?)<\/PakkeshopData>/g;
    let match;
    while ((match = shopRegex.exec(xml)) !== null) {
      const block = match[1];
      const pick = (tag) => {
        const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].trim() : '';
      };
      const distanceRaw = pick('DistanceMetersAsTheCrowFlies');
      shops.push({
        id: pick('Number'),
        name: pick('CompanyName'),
        address: pick('Streetname'),
        zipcode: pick('ZipCode'),
        city: pick('CityName'),
        country: pick('CountryCode') || country,
        distanceM: distanceRaw ? parseInt(distanceRaw, 10) : null,
      });
    }

    if (useDistance) {
      shops.sort((a, b) => (a.distanceM ?? 999999) - (b.distanceM ?? 999999));
    }

    return res.status(200).json({ shops });
  } catch (err) {
    console.error('Pakkeshop proxy error:', err);
    return res.status(500).json({ error: err.message, shops: [] });
  }
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
