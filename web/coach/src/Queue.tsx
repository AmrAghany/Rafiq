import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { claimReview, fetchQueue } from './api';
import { monthName, shortDate } from './format';
import type { QueueItem } from './types';

export function Queue({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const queue = useQuery({ queryKey: ['queue'], queryFn: fetchQueue, refetchInterval: 60_000 });
  const claim = useMutation({
    mutationFn: claimReview,
    onSuccess: (_data, id) => onOpen(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
  });

  if (queue.isPending) return <p>{t('app.loading')}</p>;
  if (queue.isError) return <p className="warn">{t('app.error')}</p>;

  const items = queue.data;
  const sections: { title: string; rows: QueueItem[] }[] = [
    { title: t('queue.mine'), rows: items.filter((r) => r.is_mine && r.status === 'in_review') },
    { title: t('queue.open'), rows: items.filter((r) => r.status === 'requested') },
    {
      title: t('queue.delivered'),
      rows: items.filter((r) => r.is_mine && r.status === 'delivered'),
    },
  ];

  return (
    <>
      {claim.isError ? (
        <p role="alert" className="warn">
          {t('app.error')}
        </p>
      ) : null}
      {sections.map((s) => (
        <section key={s.title} className="card">
          <h2>{s.title}</h2>
          {s.rows.length === 0 ? <p className="muted">{t('queue.empty')}</p> : null}
          <ul className="rows">
            {s.rows.map((r) => (
              <li key={r.id} data-testid={`queue-${r.id}`}>
                <div>
                  <strong>{r.member_first_name || '—'}</strong>{' '}
                  <span className="muted">
                    {t('queue.month', { month: monthName(r.period, i18n.language) })} ·{' '}
                    {r.status === 'delivered' && r.delivered_at
                      ? t('queue.delivered_', { date: shortDate(r.delivered_at, i18n.language) })
                      : t('queue.requested', { date: shortDate(r.requested_at, i18n.language) })}
                  </span>
                  {r.member_note ? (
                    <p>
                      {t('queue.noteLabel')} <bdi>{r.member_note}</bdi>
                    </p>
                  ) : null}
                </div>
                {r.status === 'requested' ? (
                  <button disabled={claim.isPending} onClick={() => claim.mutate(r.id)}>
                    {t('queue.claim')}
                  </button>
                ) : (
                  <button className="ghost" onClick={() => onOpen(r.id)}>
                    {t('queue.open_')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
