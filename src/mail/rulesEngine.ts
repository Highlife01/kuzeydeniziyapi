import type { MailListItem, MailRule } from './types';

export function evaluateRules(message: MailListItem, rules: MailRule[] = []): { labels: string[]; shouldStar?: boolean; shouldRead?: boolean; moveTo?: string } {
  const labels: string[] = [];
  let shouldStar = false;
  let shouldRead = false;
  let moveTo: string | undefined = undefined;

  for (const rule of rules) {
    if (rule.enabled === false) continue;
    let targetText = '';
    if (rule.field === 'from') targetText = `${message.from} ${message.fromEmail}`.toLowerCase();
    else if (rule.field === 'to') targetText = `${message.to || ''} ${message.toEmail || ''}`.toLowerCase();
    else if (rule.field === 'subject') targetText = (message.subject || '').toLowerCase();

    const ruleVal = (rule.value || '').trim().toLowerCase();
    if (!ruleVal) continue;

    let matched = false;
    if (rule.field === 'to') {
      const addresses = targetText.split(/[,;]/).map((p) => p.trim());
      if (rule.condition === 'contains') matched = targetText.includes(ruleVal);
      else if (rule.condition === 'equals') matched = addresses.some((a) => a === ruleVal || a.includes(`<${ruleVal}>`));
      else if (rule.condition === 'starts') matched = addresses.some((a) => a.startsWith(ruleVal));
    } else {
      if (rule.condition === 'contains') matched = targetText.includes(ruleVal);
      else if (rule.condition === 'equals') matched = targetText === ruleVal;
      else if (rule.condition === 'starts') matched = targetText.startsWith(ruleVal);
    }

    if (matched) {
      if (rule.action === 'label' && rule.target) {
        if (!labels.includes(rule.target)) labels.push(rule.target);
      } else if (rule.action === 'star') {
        shouldStar = true;
      } else if (rule.action === 'read') {
        shouldRead = true;
      } else if (rule.action === 'move' && rule.target) {
        moveTo = rule.target;
      }
    }
  }

  return { labels, shouldStar, shouldRead, moveTo };
}
