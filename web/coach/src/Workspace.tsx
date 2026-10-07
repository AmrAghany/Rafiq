import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchBundle, releaseReview, saveReview } from './api';
import { dash, monthName, shortDate } from './format';
import { adherence, exerciseName, isCareful, liftProgress, weeklySummary } from './summary';
import type { Bundle, ReviewDraft } from './types';

const DOCTOR_FLAGS = ['injury', 'heart', 'diabetes'];

/** One member's month, and the review the coach writes about it. */
export function Workspace({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useTranslation();
  const bundle = useQuery({ queryKey: ['bundle', id], queryFn: () => fetchBundle(id) });

  return (
    <>
      <button className="link" onClick={onBack}>
        {t('review.back')}
      </button>
      {bundle.isPending ? <p>{t('app.loading')}</p> : null}
      {bundle.isError ? <p className="warn">{t('app.error')}</p> : null}
      {bundle.data ? <Loaded bundle={bundle.data} onBack={onBack} /> : null}
    </>
  );
}

function Loaded({ bundle, onBack }: { bundle: Bundle; onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { review, profile, plan } = bundle;
  const flagNames = (flags: string[]) =>
    flags.map((f) => t(`flags.${f}` as 'flags.injury')).join(', ');
  const careful = isCareful(bundle);
  // As in the app: body numbers stay out of view for the eating-disorder answer.
  const hideBody = profile.health_flags.includes('eating_disorder');
  const doctorFlags = profile.health_flags.filter((f) => DOCTOR_FLAGS.includes(f));
  const weeks = weeklySummary(bundle);
  const lifts = liftProgress(bundle);
  const done = adherence(bundle);
  const sleep = (m: number | null) =>
    m == null ? '–' : t('duration', { h: Math.floor(m / 60), m: m % 60 });

  return (
    <>
      <h1>
        {t('review.member', {
          name: profile.first_name || '—',
          month: monthName(review.period, lang),
        })}
      </h1>

      {careful ? (
        <p role="alert" className="banner warn" data-testid="careful-banner">
          {t('review.careful', {
            flags: flagNames(
              profile.health_flags.filter((f) => f === 'eating_disorder' || f === 'pregnancy'),
            ),
          })}
        </p>
      ) : null}
      {doctorFlags.length ? (
        <p className="banner">{t('review.doctor', { flags: flagNames(doctorFlags) })}</p>
      ) : null}
      {profile.ramadan_mode ? <p className="banner">{t('review.ramadan')}</p> : null}

      {review.member_note ? (
        <section className="card">
          <h2>{t('review.note')}</h2>
          <p dir="auto">{review.member_note}</p>
        </section>
      ) : null}

      <div className="grid">
        <section className="card">
          <h2>{t('review.profile')}</h2>
          <p>
            {[
              profile.sex ? t(`facts.sex.${profile.sex}`) : null,
              profile.age != null ? t('facts.age', { age: profile.age }) : null,
              profile.height_cm != null ? t('facts.height', { cm: profile.height_cm }) : null,
              !hideBody && profile.weight_kg != null
                ? t('facts.weight', { kg: profile.weight_kg })
                : null,
              profile.goal ? t(`facts.goal.${profile.goal}`) : null,
              profile.experience
                ? t(`facts.experience.${profile.experience}` as 'facts.experience.beginner')
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {done ? <p className="muted">{t('facts.adherence', done)}</p> : null}
        </section>
        {plan ? (
          <section className="card">
            <h2>{t('review.plan', { version: plan.version })}</h2>
            <p>
              {t('review.targets', {
                kcal: plan.plan.targetKcal,
                protein: plan.plan.proteinG,
                bmr: plan.plan.bmrKcal,
                days: plan.plan.trainingDays,
              })}
            </p>
          </section>
        ) : null}
      </div>

      <section className="card">
        <h2>{t('review.weeks')}</h2>
        {weeks.length === 0 ? (
          <p className="muted">{t('review.noData')}</p>
        ) : (
          <div className="scroll">
            <table data-testid="weeks">
              <thead>
                <tr>
                  <th>{t('cols.week')}</th>
                  <th>{t('cols.readiness')}</th>
                  <th>{t('cols.sleep')}</th>
                  <th>{t('cols.steps')}</th>
                  <th>{t('cols.workouts')}</th>
                  <th>{t('cols.sets')}</th>
                  <th>{t('cols.meals')}</th>
                  <th>{t('cols.kcal')}</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.week}>
                    <td>{shortDate(w.week, lang)}</td>
                    <td>{dash(w.readiness)}</td>
                    <td>{sleep(w.sleepMinutes)}</td>
                    <td>{dash(w.steps)}</td>
                    <td>{w.workoutsDone}</td>
                    <td>{w.setsDone}</td>
                    <td>{w.mealsLogged}</td>
                    <td>{dash(w.kcalPerDay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid">
        <section className="card">
          <h2>{t('review.lifts')}</h2>
          {lifts.length === 0 ? (
            <p className="muted">{t('review.noData')}</p>
          ) : (
            <table data-testid="lifts">
              <thead>
                <tr>
                  <th>{t('cols.exercise')}</th>
                  <th>{t('cols.first')}</th>
                  <th>{t('cols.best')}</th>
                  <th>{t('cols.sessions')}</th>
                </tr>
              </thead>
              <tbody>
                {lifts.map((l) => (
                  <tr key={l.exerciseKey}>
                    <td>{exerciseName(l.exerciseKey, lang)}</td>
                    {/* "60 × 6" reads left to right in both languages, as on a gym log. */}
                    <td>
                      <span dir="ltr">{`${l.first.weightKg} × ${l.first.reps}`}</span>
                    </td>
                    <td>
                      <span dir="ltr">{`${l.best.weightKg} × ${l.best.reps}`}</span>
                    </td>
                    <td>{l.sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        {!hideBody ? (
          <section className="card">
            <h2>{t('review.scans')}</h2>
            {bundle.scans.length === 0 ? (
              <p className="muted">{t('review.noData')}</p>
            ) : (
              <table data-testid="scans">
                <thead>
                  <tr>
                    <th>{t('cols.date')}</th>
                    <th>{t('cols.weight')}</th>
                    <th>{t('cols.fat')}</th>
                    <th>{t('cols.muscle')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.scans.map((s) => (
                    <tr key={s.scanned_on}>
                      <td>{shortDate(s.scanned_on, lang)}</td>
                      <td>{dash(s.weight_kg, t('units.kg'))}</td>
                      <td>{dash(s.body_fat_pct, '%')}</td>
                      <td>{dash(s.skeletal_muscle_kg, t('units.kg'))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ) : null}
      </div>

      <ReviewForm bundle={bundle} onBack={onBack} />
    </>
  );
}

function ReviewForm({ bundle, onBack }: { bundle: Bundle; onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { review, profile } = bundle;
  const [draft, setDraft] = useState<ReviewDraft>({
    summary: review.summary ?? '',
    training: review.training ?? '',
    nutrition: review.nutrition ?? '',
    focus: review.focus ?? '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const delivered = review.status === 'delivered';
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['bundle', review.id] }),
      queryClient.invalidateQueries({ queryKey: ['queue'] }),
    ]);

  const save = useMutation({
    mutationFn: (deliver: boolean) => saveReview(review.id, draft, deliver),
    onSuccess: (_d, deliver) => {
      setMessage(deliver ? null : t('review.saved'));
      void refresh();
    },
    onError: () => setMessage(t('app.error')),
  });
  const release = useMutation({
    mutationFn: () => releaseReview(review.id),
    onSuccess: async () => {
      await refresh();
      onBack();
    },
  });

  function deliver() {
    if (!draft.summary.trim()) return setMessage(t('review.summaryRequired'));
    if (window.confirm(t('review.confirmDeliver', { name: profile.first_name }))) save.mutate(true);
  }

  const fields = ['summary', 'training', 'nutrition', 'focus'] as const;
  return (
    <section className="card">
      <h2>{t('review.write')}</h2>
      {delivered && review.delivered_at ? (
        <p className="ok">
          {t('review.deliveredNote', { date: shortDate(review.delivered_at, i18n.language) })}
        </p>
      ) : null}
      {fields.map((f) => (
        <label key={f}>
          {t(`review.${f}`)}
          <textarea
            data-testid={`field-${f}`}
            dir="auto"
            rows={f === 'summary' ? 5 : 4}
            maxLength={4000}
            readOnly={delivered}
            value={draft[f]}
            onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
          />
        </label>
      ))}
      {message ? (
        <p role="status" className="muted">
          {message}
        </p>
      ) : null}
      {!delivered ? (
        <div className="actions">
          <button disabled={save.isPending} onClick={deliver}>
            {t('review.deliver')}
          </button>
          <button className="ghost" disabled={save.isPending} onClick={() => save.mutate(false)}>
            {t('review.save')}
          </button>
          <button className="link" disabled={release.isPending} onClick={() => release.mutate()}>
            {t('review.release')}
          </button>
        </div>
      ) : null}
    </section>
  );
}
