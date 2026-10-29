import { PageHeading } from '../../app/AppShell';
import { EmptyState } from '../../components/ui/EmptyState';

/**
 * A page that exists, is reachable, is permission-checked, and has no feature behind it
 * yet.
 *
 * Every sidebar item needs a destination from the moment the menu renders it, or the shell
 * cannot be navigated and the permission filtering cannot be seen working. These are
 * honest about being unbuilt rather than showing a fake chart: this product is a clinical
 * record system, and a placeholder that looks like data is a placeholder somebody will read
 * as data.
 */
export const PlaceholderPage = ({
  title,
  description,
  next,
}: {
  readonly title: string;
  readonly description: string;
  /** What will be here, named plainly. */
  readonly next: string;
}) => (
  <>
    <PageHeading title={title} description={description} />
    <EmptyState title="Not built yet" body={next} />
  </>
);
