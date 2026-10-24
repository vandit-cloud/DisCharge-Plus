import { TIERS } from '../models/enums.js';
import { RED_FLAG_RULES } from '../rules/redFlagRules.js';

/**
 * Checks a symptom report against every rule for the patient's protocol.
 *
 * - All matching rule IDs are returned, so every alert can be explained rule by rule.
 * - The tier is the HIGHEST tier among the matches: after discharge a missed danger sign costs
 *   far more than an unneeded call. No match -> 'self_care'.
 * - With no active plan, only the rules for all protocols ('*') apply.
 *
 * @param {{ symptoms: string[], severity: number }} log
 * @param {{ followUpProtocol: string, redFlags: string[] } | null} plan
 * @returns {{ tier: string, triggeredRules: string[] }}
 */
export function evaluate(log, plan, rules = RED_FLAG_RULES) {
  const protocol = plan?.followUpProtocol;
  const matched = rules.filter(
    (rule) =>
      (rule.protocols.includes('*') || rule.protocols.includes(protocol)) && rule.when(log, plan),
  );
  const tier = matched.reduce(
    (highest, rule) => (TIERS.indexOf(rule.tier) > TIERS.indexOf(highest) ? rule.tier : highest),
    'self_care',
  );
  return { tier, triggeredRules: matched.map((rule) => rule.id) };
}
