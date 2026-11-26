import { PrismaClient } from "@prisma/client";
import { seedDemoWorkspace, DEMO } from "../src/lib/demo";

/**
 * Seeds the public demo workspace. Idempotent: safe to run repeatedly.
 *
 *   Owner login: ada@acme.test / password123
 *
 * The demo is deliberately a small real-looking company with requests at
 * different pipeline stages, so the product can be understood before any
 * integration is connected.
 */
const db = new PrismaClient();

async function main() {
  const created = await seedDemoWorkspace();
  if (!created) {
    console.log("Demo workspace already exists - nothing to do.");
    return;
  }
  console.log(`Seeded ${DEMO.companyName}`);
  console.log(`  Owner / BA    ${DEMO.email} / ${DEMO.password}`);
  console.log(`  BA            grace@acme.test / ${DEMO.password}`);
  console.log(`  Stakeholder   stan@acme.test / ${DEMO.password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
