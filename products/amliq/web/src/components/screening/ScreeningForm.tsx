import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import type { EntityType } from '../../types';

interface FormData {
  firstName: string;
  lastName: string;
  companyName: string;
  dob: string;
  nationality: string;
  threshold: number;
}

interface ScreeningFormProps {
  onSubmit: (data: FormData, type: EntityType) => void;
  loading?: boolean;
}

export function ScreeningForm({ onSubmit, loading }: ScreeningFormProps) {
  const { t } = useTranslation('screening');
  const [entityType, setEntityType] = useState<EntityType>('individual');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [data, setData] = useState<FormData>({
    firstName: '', lastName: '', companyName: '', dob: '', nationality: '', threshold: 80,
  });

  const tabClass = (active: boolean) =>
    `flex-1 py-md text-center text-[14px] font-semibold rounded-apple-md transition-all cursor-pointer ${active
      ? 'bg-[#1A1814] text-[#C9A96E]'
      : 'text-apple-label-secondary hover:text-[var(--dash-text)] hover:bg-[var(--dash-surface)]'}`;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const MIN = 2;
    const COMBINED_MIN = 4;
    if (entityType === 'individual') {
      const fn = data.firstName.trim();
      const ln = data.lastName.trim();
      if (!fn) errs.firstName = 'First name is required';
      else if (fn.length < MIN) errs.firstName = `Minimum ${MIN} characters`;
      if (!ln) errs.lastName = 'Last name is required';
      else if (ln.length < MIN) errs.lastName = `Minimum ${MIN} characters`;
      if (!errs.firstName && !errs.lastName && (fn.length + ln.length) < COMBINED_MIN) {
        errs.firstName = `Full name must be at least ${COMBINED_MIN} characters`;
      }
    } else {
      const cn = data.companyName.trim();
      if (!cn) errs.companyName = 'Company name is required';
      else if (cn.length < COMBINED_MIN) errs.companyName = `Minimum ${COMBINED_MIN} characters`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(data, entityType);
  };

  const inputCls = (field: string) =>
    `input-field w-full ${errors[field] ? 'border-apple-red' : ''}`;

  return (
    <div className="card-vibrancy p-xl">
      <div className="flex gap-sm p-xs rounded-apple-md mb-xl" style={{ background: 'var(--dash-surface)', border: '0.5px solid var(--dash-border)' }}>
        <button type="button" className={tabClass(entityType === 'individual')}
          onClick={() => setEntityType('individual')}>{t('form.individual')}</button>
        <button type="button" className={tabClass(entityType === 'company')}
          onClick={() => setEntityType('company')}>{t('form.company')}</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-lg">
        {entityType === 'individual' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-lg">
              <div>
                <input type="text" required aria-label={t('form.first_name')}
                  placeholder={t('form.first_name')} className={inputCls('firstName')}
                  value={data.firstName} onChange={(e) => setData({ ...data, firstName: e.target.value })} />
                {errors.firstName && <p className="text-apple-red text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <input type="text" required aria-label={t('form.last_name')}
                  placeholder={t('form.last_name')} className={inputCls('lastName')}
                  value={data.lastName} onChange={(e) => setData({ ...data, lastName: e.target.value })} />
                {errors.lastName && <p className="text-apple-red text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>
            <input type="date" aria-label={t('form.dob')} className="input-field w-full"
              value={data.dob} onChange={(e) => setData({ ...data, dob: e.target.value })} />
            <input type="text" aria-label={t('form.nationality')} placeholder={t('form.nationality')}
              className="input-field w-full" value={data.nationality}
              onChange={(e) => setData({ ...data, nationality: e.target.value })} />
          </>
        ) : (
          <div>
            <input type="text" required aria-label={t('form.company_name')}
              placeholder={t('form.company_name')} className={inputCls('companyName')}
              value={data.companyName} onChange={(e) => setData({ ...data, companyName: e.target.value })} />
            {errors.companyName && <p className="text-apple-red text-xs mt-1">{errors.companyName}</p>}
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-xs">
            <label className="text-xs font-medium" style={{ color: 'var(--dash-text-secondary)' }}>
              Fuzzy match threshold
            </label>
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--dash-text)' }}>
              {data.threshold}%
            </span>
          </div>
          <input type="range" min={50} max={100} step={1} value={data.threshold}
            aria-label="Fuzzy match threshold"
            onChange={(e) => setData({ ...data, threshold: Number(e.target.value) })}
            className="w-full accent-[#C9A96E] cursor-pointer" />
          <div className="flex justify-between text-[10px] mt-xs" style={{ color: 'var(--dash-text-tertiary)' }}>
            <span>Broader (more hits)</span>
            <span>Stricter (fewer hits)</span>
          </div>
        </div>
        <button type="submit" disabled={loading}
          className="button-primary w-full flex items-center justify-center gap-sm disabled:opacity-50 text-[15px] font-bold tracking-wide">
          <Search className="w-5 h-5" />
          {loading ? t('form.submitting') : t('form.submit')}
        </button>
      </form>
    </div>
  );
}
