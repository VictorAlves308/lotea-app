type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * A small pt-BR relative-time formatter for "pagamentos recentes" — no
 * date library, just what this one feature needs. Strings are still
 * externalized through `t` (dashboard.json), not hardcoded here — this
 * function only decides *which* bucket applies.
 */
export function formatRelativeTime(date: Date, t: Translate, now: Date = new Date()): string {
  const diffMinutes = Math.round((now.getTime() - date.getTime()) / 60_000);

  if (diffMinutes < 1) return t('dashboard:relativeJustNow');
  if (diffMinutes < 60) return t('dashboard:relativeMinutes', { count: diffMinutes });

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return t('dashboard:relativeHours', { count: diffHours });

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return t('dashboard:relativeYesterday');
  if (diffDays < 7) return t('dashboard:relativeDays', { count: diffDays });

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
