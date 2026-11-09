/**
 * Site automation export — node variant only (Nice One).
 */

import SiteAutomation from "./automators/siteAutomation_node";

export type { SiteAutomationInterface } from "./automators/siteAutomation_node";

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).SiteAutomation = SiteAutomation;
}

export default SiteAutomation;
