// api/find-pakkeshops.js — Vercel Serverless Function
// Proxies GLS Denmark's ParcelShop SOAP service. Returns JSON list of nearby shops.
// GLS endpoint: http://www.gls.dk/webservices_v4/wsShopFinder.asmx

export default async function handler(req, res) {
  const zipcode = req.query.zipcode || '';
  const country = req.query.country || 'DK';

  if (!zipcode) {
    return res.status(400).json({ error: 'zipcode required' });
  }

  // GLS SOAP envelope — GetParcelShopsInZipcode returns all pakkeshops for that zip
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetParcelShopsInZipcode xmlns="http://gls.dk/webservices/">
      <zipcode>${zipcode}</zipcode>
      <countryIso3166A2>${country}</countryIso3166A2>
    </GetParcelShopsInZipcode>
  </soap:Body>
</soap:Envelope>`;

  try {
    const glsRes = await fetch('https://www.gls.dk/webservices_v4/wsShopFinder.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://gls.dk/webservices/GetParcelShopsInZipcode"',
        'User-Agent': 'Mozilla/5.0 (compatible; QuartzMolle/1.0)',
      },
      body: soapBody,
    });

    const xml = await glsRes.text();
    console.log('GLS response status:', glsRes.status);
    console.log('GLS response body (first 800 chars):', xml.slice(0, 800));

    if (!glsRes.ok) {
      console.error('GLS SOAP error', glsRes.status, xml.slice(0, 500));
      return res.status(502).json({ error: 'GLS service error', status: glsRes.status, body: xml.slice(0, 500), shops: [] });
    }

    // Parse XML manually (avoid adding dependencies). Each shop looks like:
    // <PakkeshopData>
    //   <Number>...</Number>
    //   <CompanyName>...</CompanyName>
    //   <Streetname>...</Streetname>
    //   <ZipCode>...</ZipCode>
    //   <CityName>...</CityName>
    //   ...
    // </PakkeshopData>
    const shops = [];
    const shopRegex = /<PakkeshopData>([\s\S]*?)<\/PakkeshopData>/g;
    let match;
    while ((match = shopRegex.exec(xml)) !== null) {
      const block = match[1];
      const pick = (tag) => {
        const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].trim() : '';
      };
      shops.push({
        id: pick('Number'),
        name: pick('CompanyName'),
        address: pick('Streetname'),
        zipcode: pick('ZipCode'),
        city: pick('CityName'),
        country: pick('CountryCode') || country,
      });
    }

    return res.status(200).json({ shops });
  } catch (err) {
    console.error('Pakkeshop proxy error:', err);
    return res.status(500).json({ error: err.message, shops: [] });
  }
}
