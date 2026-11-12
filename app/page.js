import Library from '../components/Library';
import { loadSkills } from '../lib/skills';

/* HOW TO ADD A SKILL
 *   Single file: drop a .md into content/skills/.  Folder skill: drop the whole folder (SKILL.md + references/ etc).
 *   No list to edit: every .md file in that folder is picked up automatically.
 *   Order in the sidebar's "Added order" = alphabetical by file name. Prefix names with
 *   01-, 02- to control it. */
export default function Page() {
  return <Library initialSkills={loadSkills()} />;
}
