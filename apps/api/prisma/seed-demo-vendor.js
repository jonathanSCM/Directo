// Seeder de datos de prueba: borra y recrea al "vendedor demo" con 100
// propiedades + imágenes (Pexels), bajo un plan TEST dedicado (oculto del
// catálogo público). Pensado para correr DENTRO del contenedor de la API,
// donde la conexión a la base es interna (no pasa por el firewall externo):
//
//   docker exec -it <contenedor_api> npm run seed:demo
//
const bcrypt = require('bcrypt');
const { createHash } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const RAW = require('./seed-demo-data.json');

const prisma = new PrismaClient();

const DEMO_EMAIL = 'vendedor.demo@directo.bo';
const DEMO_PASSWORD = '123123123';
const DEMO_PHONE = '77712345';
// Se puede sobreescribir con `PEXELS_API_KEY=... npm run seed:demo` si se
// prefiere no dejar la key en el código (es un script interno, no se manda
// al cliente, pero igual es mejor práctica).
const PEXELS_KEY = process.env.PEXELS_API_KEY || 'dPkKIUVlyHHWtFs0isCzz7Eoe2Of3LxqADytiIfkF38K4jYVbvGx3LUy';
const TEST_PLAN_SLUG = 'test';

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function seededInt(seed, min, max) {
  const h = createHash('md5').update(seed).digest('hex');
  const n = parseInt(h.slice(0, 8), 16);
  return min + (n % (max - min + 1));
}

const OP_MAP = { Venta: 'sale', Alquiler: 'rent', Anticrético: 'anticretico' };
const TYPE_SLUG_MAP = { Casa: 'casa', Departamento: 'departamento', Terreno: 'terreno' };
const ZONE_NAME_OVERRIDES = { 'Zona Centro': 'Centro' };
const QUERIES_BY_TYPE = {
  casa: ['modern house exterior', 'suburban house front', 'house facade'],
  departamento: ['apartment interior living room', 'modern apartment interior', 'condo interior'],
  terreno: ['empty land plot', 'vacant land aerial', 'rural land field'],
};

async function pexelsSearch(query, perPage) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
  if (!res.ok) throw new Error(`Pexels ${res.status} para "${query}"`);
  const data = await res.json();
  return data.photos.map((p) => p.src.large);
}

async function main() {
  const allProps = [];
  for (const zona of RAW.zonas) for (const calle of zona.calles) for (const p of calle.propiedades) allProps.push(p);
  console.log(`Propiedades en el dataset: ${allProps.length}`);

  // 1) Borrar vendedor demo existente (y todo lo suyo)
  const existing = await prisma.users.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    console.log('Borrando usuario demo existente...');
    await prisma.property_images.deleteMany({ where: { properties: { owner_id: existing.id } } });
    await prisma.properties.deleteMany({ where: { owner_id: existing.id } });
    await prisma.subscriptions.deleteMany({ where: { user_id: existing.id } });
    await prisma.payments.deleteMany({ where: { user_id: existing.id } }).catch(() => {});
    await prisma.users.delete({ where: { id: existing.id } });
    console.log('Borrado OK.');
  } else {
    console.log('No existía un vendedor demo previo.');
  }

  // 2) Crear usuario demo
  const password_hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const demoUser = await prisma.users.create({
    data: {
      name: 'Vendedor Demo',
      email: DEMO_EMAIL,
      password_hash,
      phone: DEMO_PHONE,
      city: 'Santa Cruz de la Sierra',
      status: 'active',
      active_role: 'owner',
      email_verified_at: new Date(),
      user_roles: {
        create: [
          { roles: { connect: { name: 'owner' } } },
          { roles: { connect: { name: 'buyer' } } },
        ],
      },
    },
  });
  console.log(`Usuario demo creado: ${demoUser.id} / password: ${DEMO_PASSWORD}`);

  // 3) Buscar o crear el plan TEST (oculto del catálogo público: is_active=false)
  let testPlan = await prisma.subscription_plans.findUnique({ where: { slug: TEST_PLAN_SLUG } });
  if (!testPlan) {
    testPlan = await prisma.subscription_plans.create({
      data: {
        name: 'TEST',
        slug: TEST_PLAN_SLUG,
        description: 'Plan interno solo para datos de prueba (vendedor demo)',
        price: 0,
        currency: 'USD',
        duration_days: 3650,
        included_properties: 100,
        extra_property_price: 0,
        allows_featured: true,
        includes_statistics: true,
        priority_in_results: false,
        is_business: false,
        ad_views: 0,
        is_active: false,
        use_pro_marker: false,
      },
    });
    console.log('Plan TEST creado:', testPlan.id);
  } else {
    console.log('Plan TEST ya existía:', testPlan.id);
  }

  const start = new Date();
  const end = new Date(start.getTime() + testPlan.duration_days * 86_400_000);
  await prisma.subscriptions.create({
    data: {
      user_id: demoUser.id,
      plan_id: testPlan.id,
      status: 'active',
      start_date: start,
      end_date: end,
      property_count: 100,
    },
  });
  console.log('Suscripción TEST activa (cupo 100) creada para el vendedor demo');

  // 4) Resolver zonas y tipos de propiedad
  const zonesInJson = [...new Set(RAW.zonas.map((z) => z.zona))];
  const zoneIdByFullName = {};
  for (const jsonName of zonesInJson) {
    const dbName = ZONE_NAME_OVERRIDES[jsonName] ?? jsonName;
    const zone = await prisma.zones.findFirst({
      where: { name: { equals: dbName, mode: 'insensitive' }, city: { contains: 'Santa Cruz', mode: 'insensitive' } },
    });
    if (!zone) throw new Error(`No se encontró la zona "${dbName}" (json: "${jsonName}")`);
    zoneIdByFullName[jsonName] = zone.id;
  }
  const zoneIdBySlug = {};
  for (const zona of RAW.zonas) zoneIdBySlug[zona.zona_slug] = zoneIdByFullName[zona.zona];

  const typesInJson = [...new Set(allProps.map((p) => p.tipo))];
  const typeIdByJsonName = {};
  for (const tipo of typesInJson) {
    const slug = TYPE_SLUG_MAP[tipo];
    const type = await prisma.property_types.findUnique({ where: { slug } });
    if (!type) throw new Error(`No se encontró property_types con slug "${slug}" para tipo "${tipo}"`);
    typeIdByJsonName[tipo] = type.id;
  }
  console.log('Zonas y tipos resueltos.');

  // 5) Banco de fotos por tipo (Pexels)
  const pool = {};
  for (const [type, queries] of Object.entries(QUERIES_BY_TYPE)) {
    let urls = [];
    for (const q of queries) urls = urls.concat(await pexelsSearch(q, 15));
    pool[type] = [...new Set(urls)];
    console.log(`Pool "${type}": ${pool[type].length} fotos`);
  }

  // 6) Crear las propiedades + imágenes
  let created = 0;
  for (const p of allProps) {
    const title = `${p.tipo} en ${p.direccion_visible}`;
    const baseSlug = slugify(`${title}-${p.codigo}`);
    const isTerreno = p.tipo === 'Terreno';
    const bedrooms = p.dormitorios ?? null;
    const bathrooms = isTerreno ? null : Math.max(1, Math.round((bedrooms ?? 2) * 0.6));
    const areaBase = p.tipo === 'Casa' ? seededInt(p.codigo + 'a', 120, 350)
      : p.tipo === 'Departamento' ? seededInt(p.codigo + 'a', 45, 160)
      : seededInt(p.codigo + 'a', 200, 800);
    const viewsCount = seededInt(p.codigo + 'v', 0, 180);
    const daysAgo = seededInt(p.codigo + 'd', 0, 60);
    const createdAt = new Date(Date.now() - daysAgo * 86_400_000);
    const isFeatured = seededInt(p.codigo + 'f', 0, 9) === 0;
    const description = `${p.detalle}. Cerca de ${p.ref}.`;

    const property = await prisma.properties.create({
      data: {
        owner_id: demoUser.id,
        title,
        slug: baseSlug,
        description,
        property_type_id: typeIdByJsonName[p.tipo],
        zone_id: zoneIdBySlug[p.zona_slug],
        operation: OP_MAP[p.operacion],
        price: p.precio_usd,
        currency: 'USD',
        address: p.direccion_visible,
        latitude: p.lat,
        longitude: p.lng,
        bedrooms,
        bathrooms,
        area_m2: areaBase,
        status: 'published',
        approval_status: 'approved',
        is_featured: isFeatured,
        views_count: viewsCount,
        published_at: createdAt,
        created_at: createdAt,
        updated_at: createdAt,
        whatsapp: DEMO_PHONE,
        contact_phone: DEMO_PHONE,
      },
    });

    const bank = pool[TYPE_SLUG_MAP[p.tipo]] ?? pool.casa;
    const imgCount = seededInt(p.codigo + 'n', 3, 6);
    const imagesData = Array.from({ length: imgCount }, (_, i) => ({
      property_id: property.id,
      url: bank[seededInt(`${p.codigo}-${i}`, 0, bank.length - 1)],
      is_main: i === 0,
      sort_order: i,
    }));
    await prisma.property_images.createMany({ data: imagesData });

    created++;
    if (created % 10 === 0) console.log(`  ...${created} creadas`);
  }

  console.log(`\nListo. Propiedades creadas: ${created}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
