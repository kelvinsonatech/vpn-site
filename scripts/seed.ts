import { closeDb } from "@/server/db";
import { seedProtocols } from "@/server/protocols/seed";

async function main() {
  const { created, upgraded, mirrored } = await seedProtocols();
  console.log(created.length ? `Created protocols: ${created.join(", ")}` : "No new protocols.");
  console.log(upgraded.length ? `Updated built-in protocols: ${upgraded.join(", ")}` : "Existing protocols are up to date.");
  if (mirrored) console.log(`Added ${mirrored} server protocol row(s) for protocols that use another one's node protocol (FastDNS).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
