import { useState, useEffect } from 'react';

interface UseNotificationsProps {
  enabled: boolean;
  targetBedtime: string; // HH:MM format
  windDownMinutes: number;
}

export function useNotifications({ enabled, targetBedtime, windDownMinutes }: UseNotificationsProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (!('Notification' in window)) return;
    setPermission(Notification.permission);
  }, []);

  const requestPermission = async () => {
    try {
      if (!('Notification' in window)) return false;
      const perm = await Notification.requestPermission();
      setPermission(perm);
      return perm === 'granted';
    } catch (e) {
      console.warn('Notification API not supported in this WebView context:', e);
      return false;
    }
  };

  useEffect(() => {
    if (!enabled || permission !== 'granted' || !targetBedtime) return;

    let lastNotifiedDate = localStorage.getItem('last_notified_date');

    const checkTime = () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      
      // If we already sent it today, do not spam.
      if (lastNotifiedDate === todayStr) return;

      const [targetHours, targetMins] = targetBedtime.split(':').map(Number);
      
      const targetTime = new Date();
      targetTime.setHours(targetHours, targetMins, 0, 0);

      // We want to notify exactly `windDownMinutes` before targetTime
      const alertTime = new Date(targetTime.getTime() - windDownMinutes * 60000);

      // If the alertTime is within the last minute, fire it
      const diffMs = now.getTime() - alertTime.getTime();
      
      // If we are tightly within a 2-minute window past the alert frame, and haven't fired:
      if (diffMs >= 0 && diffMs <= 120000) {
        try {
          new Notification('Wind-Down Time 🌙', {
            body: `Time to start unwinding! It's exactly ${windDownMinutes} minutes before your targeted bedtime. Dim the lights and relax!`,
            icon: '/icon.svg',
          });
        } catch (e) {
          console.warn('Failed to fire native notification:', e);
        }
        lastNotifiedDate = todayStr;
        localStorage.setItem('last_notified_date', todayStr);
      }
    };

    const intervalId = setInterval(checkTime, 60000); // Check every 60 seconds
    
    // immediate check on load
    checkTime();

    return () => clearInterval(intervalId);
  }, [enabled, permission, targetBedtime, windDownMinutes]);

  const downloadCalendarEvent = () => {
    if (!targetBedtime) return;

    const [targetHours, targetMins] = targetBedtime.split(':').map(Number);
    const now = new Date();
    
    // Create start time for today minus wind down minutes
    const startTime = new Date(now);
    startTime.setHours(targetHours, targetMins, 0, 0);
    startTime.setTime(startTime.getTime() - windDownMinutes * 60000);
    
    // Add 15 mins to event for calendar block
    const endTime = new Date(startTime.getTime() + 15 * 60000);

    const pad = (n: number) => n.toString().padStart(2, '0');
    
    // iCalendar format requires specifically structured UTC or local times. For a repeating daily alarm, local time strings like YYYYMMDDTHHMMSS are easiest if un-suffixed with Z.
    // However, to assure it binds perfectly, we can format in YYYYMMDDTHHMMSS
    const formatIcsTime = (d: Date) => 
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Rest & Renewal//Sleep Tracker//EN',
      'BEGIN:VEVENT',
      `DTSTART:${formatIcsTime(startTime)}`,
      `DTEND:${formatIcsTime(endTime)}`,
      `RRULE:FREQ=DAILY`,
      'SUMMARY:Wind-down for bed 🌙',
      `DESCRIPTION:Time to start your wind-down routine to protect your sleep streak. Disconnect from screens and relax!`,
      // Apple Calendar requires an explicit VALARM to guarantee a native push/sound
      'BEGIN:VALARM',
      'TRIGGER:-PT0M', // Trigger exactly at DTSTART
      'ACTION:DISPLAY',
      'DESCRIPTION:Wind-down Reminder',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wind-down-routine.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return { permission, requestPermission, downloadCalendarEvent };
}
