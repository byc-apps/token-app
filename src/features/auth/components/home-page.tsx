import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { routes } from "@/config/routes";

export function HomePage() {
  return (
    <section className="stack">
      <PageHeader title="Home" description="Book a service token or view an existing token." />
      <div>
        <Link className="button button--primary button--student" href={routes.book}>Book token</Link>
      </div>
    </section>
  );
}
