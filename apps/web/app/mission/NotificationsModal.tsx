'use client';

import { useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useI18n } from '../components/I18nProvider';

type NotificationSettings = {
  enabled: boolean;
  time: string;
  days: string[];
  channel: 'email';
  email: string;
};

type NotificationsModalProps = {
  open: boolean;
  onClose: () => void;
};

const defaultSettings: NotificationSettings = {
  enabled: false,
  time: '08:30',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  channel: 'email',
  email: '',
};

export default function NotificationsModal({ open, onClose }: NotificationsModalProps) {
  const { t } = useI18n();
  const [settings, setSettings] = useLocalStorage<NotificationSettings>(
    'loe-notifications',
    defaultSettings,
  );

  const orderedDays = useMemo(() => Object.keys(t.weekdayShort), [t.weekdayShort]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel modal-panel-sm">
        <div className="modal-header">
          <div>
            <span className="modal-label">{t.notificationsTitle}</span>
            <h2>{t.notificationsSubtitle}</h2>
          </div>
          <button className="text-button" onClick={onClose}>
            {t.notificationsClose}
          </button>
        </div>

        <div className="modal-content">
          <label className="toggle-row">
            <span>{t.notificationsEnable}</span>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  enabled: event.target.checked,
                })
              }
            />
          </label>

          <label className="input-label" htmlFor="notification-time">
            {t.notificationsTime}
          </label>
          <input
            id="notification-time"
            type="time"
            value={settings.time}
            onChange={(event) => setSettings({ ...settings, time: event.target.value })}
          />

          <div className="input-label">{t.notificationsDays}</div>
          <div className="day-grid">
            {orderedDays.map((day) => (
              <button
                key={day}
                type="button"
                className={`day-pill ${settings.days.includes(day) ? 'day-pill-active' : ''}`}
                onClick={() => {
                  const nextDays = settings.days.includes(day)
                    ? settings.days.filter((item) => item !== day)
                    : [...settings.days, day];
                  setSettings({ ...settings, days: nextDays });
                }}
              >
                {t.weekdayShort[day]}
              </button>
            ))}
          </div>

          <label className="input-label" htmlFor="notification-email">
            {t.notificationsChannel}
          </label>
          <div className="channel-row">
            <span>{t.notificationsEmail}</span>
            <input
              id="notification-email"
              type="email"
              placeholder={t.notificationsPlaceholder}
              value={settings.email}
              onChange={(event) => setSettings({ ...settings, email: event.target.value })}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="primary-button" onClick={onClose}>
            {t.notificationsSave}
          </button>
        </div>
      </div>
    </div>
  );
}
