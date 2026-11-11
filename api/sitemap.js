const FIREBASE_PROJECT_ID = 'naijaself';
// Firebase web API keys are public identifiers, not server credentials.
// Firestore security rules still control which documents this endpoint can read.
const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY || 'AIzaSyBDYHSU2rzvp_DusU69LATiUhkzhEGHPQ0';

const escapeXml = value =>
  String(value).replace(/[<>&'"\u0000-\u001F]/g, character => {
    const entities = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&apos;'
    };
    return entities[character] || '';
  });

export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    return response.status(405).send('Method not allowed');
  }

  try {
    const endpoint =
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;

    const firestoreResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'businesses' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'EQUAL',
              value: { stringValue: 'approved' }
            }
          },
          select: {
            fields: [
              { fieldPath: 'name' },
              { fieldPath: 'createdAt' }
            ]
          }
        }
      })
    });

    if (!firestoreResponse.ok) {
      const details = await firestoreResponse.text();
      console.error('Sitemap Firestore query failed:', firestoreResponse.status, details);
      return response.status(502).send('Unable to retrieve approved business listings');
    }

    const rows = await firestoreResponse.json();
    const businessUrls = rows
      .filter(row => row.document && row.document.name)
      .map(row => {
        const document = row.document;
        const id = document.name.split('/').pop();
        const createdAt = document.fields?.createdAt?.timestampValue;
        const lastModified = document.updateTime || createdAt;
        const lastmod = lastModified
          ? `<lastmod>${escapeXml(new Date(lastModified).toISOString())}</lastmod>`
          : '';

        return `<url><loc>https://naijashelf.vercel.app/business/${encodeURIComponent(id)}</loc>${lastmod}<changefreq>weekly</changefreq><priority>0.7</priority></url>`;
      });

    const urls = [
      '<url><loc>https://naijashelf.vercel.app/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>',
      ...businessUrls
    ];

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      urls.join('') +
      '</urlset>';

    response.setHeader('Content-Type', 'application/xml; charset=utf-8');
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    if (request.method === 'HEAD') return response.status(200).end();
    return response.status(200).send(xml);
  } catch (error) {
    console.error('Sitemap generation failed:', error);
    return response.status(500).send('Unable to generate sitemap');
  }
}
