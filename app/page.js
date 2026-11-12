import Library from '../components/Library';
import { loadSkills } from '../lib/skills';

/* HOW TO ADD A SKILL
 *   Drop a .md file into content/skills/ and rebuild (or save it while `npm run dev` runs).
 *   No list to edit: every .md file in that folder is picked up automatically.
 *   Order in the sidebar's "Added order" = alphabetical by file name. Prefix names with
 *   01-, 02- to control it. */
export default function Page() {
  return <Library initialFiles={loadSkills()} />;
}
