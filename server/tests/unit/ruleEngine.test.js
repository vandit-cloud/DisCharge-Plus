import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/services/ruleEngine.js';
import { RED_FLAG_RULES } from '../../src/rules/redFlagRules.js';

const plan = (protocol, redFlags = []) => ({ followUpProtocol: protocol, redFlags });
const log = (symptoms, severity = 2) => ({ symptoms, severity });

// For every rule: one report where it fires and one close call where it doesn't.
const CASES = {
  GEN_CHEST_PAIN: { fires: [log(['CHEST_PAIN'], 1), plan('general')], quiet: [log(['DIZZY'], 1), plan('general')] },
  GEN_CONFUSION: { fires: [log(['CONFUSION']), plan('diabetes')], quiet: [log(['DIZZY']), plan('diabetes')] },
  GEN_BREATHLESS_SEVERE: { fires: [log(['BREATHLESS'], 4), plan('general')], quiet: [log(['BREATHLESS'], 3), plan('general')] },
  GEN_FAINTING: { fires: [log(['FAINTING']), plan('general')], quiet: [log(['DIZZY']), plan('general')] },
  GEN_PLAN_RED_FLAG: { fires: [log(['DIZZY']), plan('general', ['DIZZY'])], quiet: [log(['DIZZY']), plan('general', ['FEVER'])] },
  GEN_SEVERITY_5: { fires: [log(['DIZZY'], 5), plan('general')], quiet: [log(['DIZZY'], 4), plan('general')] },
  GEN_VOMITING_SEVERE: { fires: [log(['VOMITING'], 4), plan('general')], quiet: [log(['VOMITING'], 3), plan('general')] },
  GEN_FEVER: { fires: [log(['FEVER'], 3), plan('general')], quiet: [log(['FEVER'], 2), plan('general')] },
  GEN_BREATHLESS: { fires: [log(['BREATHLESS'], 1), plan('general')], quiet: [log(['DIZZY'], 1), plan('general')] },
  CARD_BREATHLESS_SEV3: { fires: [log(['BREATHLESS'], 3), plan('cardiac')], quiet: [log(['BREATHLESS'], 3), plan('diabetes')] },
  CARD_FLUID_OVERLOAD: { fires: [log(['SWELLING_LEGS', 'BREATHLESS'], 1), plan('ckd')], quiet: [log(['SWELLING_LEGS'], 1), plan('cardiac')] },
  CARD_SWELLING: { fires: [log(['SWELLING_LEGS']), plan('cardiac')], quiet: [log(['SWELLING_LEGS']), plan('general')] },
  CARD_DIZZY: { fires: [log(['DIZZY'], 3), plan('cardiac')], quiet: [log(['DIZZY'], 2), plan('cardiac')] },
  DM_HYPO_SIGNS: { fires: [log(['SHAKY_SWEATY']), plan('diabetes')], quiet: [log(['SHAKY_SWEATY']), plan('cardiac')] },
  DM_HYPERGLYCAEMIC_CRISIS: { fires: [log(['EXTREME_THIRST', 'VOMITING']), plan('diabetes')], quiet: [log(['EXTREME_THIRST']), plan('diabetes')] },
  DM_THIRST: { fires: [log(['EXTREME_THIRST']), plan('diabetes')], quiet: [log(['EXTREME_THIRST']), plan('general')] },
  DM_WOUND: { fires: [log(['WOUND_PROBLEM']), plan('diabetes')], quiet: [log(['WOUND_PROBLEM']), plan('general')] },
  CKD_LOW_URINE: { fires: [log(['LOW_URINE']), plan('ckd')], quiet: [log(['LOW_URINE']), plan('general')] },
  CKD_VOMITING: { fires: [log(['VOMITING']), plan('ckd')], quiet: [log(['VOMITING']), plan('cardiac')] },
  SURG_WOUND_FEVER: { fires: [log(['WOUND_PROBLEM', 'FEVER'], 1), plan('post_surgical')], quiet: [log(['WOUND_PROBLEM'], 1), plan('post_surgical')] },
  SURG_FEVER: { fires: [log(['FEVER'], 3), plan('post_surgical')], quiet: [log(['FEVER'], 2), plan('post_surgical')] },
  SURG_WOUND: { fires: [log(['WOUND_PROBLEM']), plan('post_surgical')], quiet: [log(['WOUND_PROBLEM']), plan('diabetes')] },
};

describe('rule table', () => {
  it('has a test case for every rule, and unique IDs', () => {
    const ids = RED_FLAG_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(CASES).sort()).toEqual([...ids].sort());
  });

  it('cites a source for every rule', () => {
    for (const rule of RED_FLAG_RULES) expect(rule.source, rule.id).toMatch(/\w{5,}/);
  });

  for (const [id, { fires, quiet }] of Object.entries(CASES)) {
    it(`${id} fires when it should and not otherwise`, () => {
      expect(evaluate(...fires).triggeredRules).toContain(id);
      expect(evaluate(...quiet).triggeredRules).not.toContain(id);
    });
  }
});

describe('evaluate', () => {
  it('AC-8: chest pain after a cardiac discharge is an emergency', () => {
    expect(evaluate(log(['CHEST_PAIN'], 1), plan('cardiac', ['BREATHLESS'])).tier).toBe('emergency');
  });

  it('AC-9: the highest matched tier wins and every match is kept', () => {
    // CARD_SWELLING (teleconsult) + CARD_BREATHLESS_SEV3 (urgent) + GEN_BREATHLESS (teleconsult)
    const result = evaluate(log(['SWELLING_LEGS', 'BREATHLESS'], 3), plan('cardiac'));
    expect(result.tier).toBe('urgent');
    expect(result.triggeredRules).toEqual(expect.arrayContaining(['CARD_SWELLING', 'CARD_BREATHLESS_SEV3', 'GEN_BREATHLESS']));
  });

  it('AC-10: no match means self_care with no rules', () => {
    expect(evaluate(log(['DIZZY'], 1), plan('general'))).toEqual({ tier: 'self_care', triggeredRules: [] });
  });

  it('without a plan only the rules for all protocols apply', () => {
    expect(evaluate(log(['CHEST_PAIN']), null).tier).toBe('emergency');
    expect(evaluate(log(['LOW_URINE']), null)).toEqual({ tier: 'self_care', triggeredRules: [] });
  });
});
