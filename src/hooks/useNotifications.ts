import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

interface UseNotificationsProps {
  enabled: boolean;
  targetBedtime: string; // HH:MM format
  windDownMinutes: number;
}

export function useNotifications({ enabled, targetBedtime, windDownMinutes }: UseNotificationsProps) {
  const [permission, setPermission] = useState<string>('default');

  const localDateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    const checkPerms = async () => {
      if (Capacitor.isNativePlatform()) {
        const { display } = await LocalNotifications.checkPermissions();
        setPermission(display);
      } else {
        if (!('Notification' in window)) return;
        setPermission(Notification.permission);
      }
    };
    checkPerms();
  }, []);

  const requestPermission = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await LocalNotifications.requestPermissions();
        setPermission(result.display);
        return result.display === 'granted';
      } else {
        if (!('Notification' in window)) return false;
        const perm = await Notification.requestPermission();
        setPermission(perm);
        return perm === 'granted';
      }
    } catch (e) {
      console.warn('Notification API error:', e);
      return false;
    }
  };

  useEffect(() => {
    if (permission !== 'granted') return;

    // NATIVE SCHEDULING
    if (Capacitor.isNativePlatform()) {
      const manageNativeSchedule = async () => {
        // Clear any existing schedules first
        await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
        
        if (!enabled || !targetBedtime) return;

        const [targetHours, targetMins] = targetBedtime.split(':').map(Number);
        const targetTime = new Date();
        targetTime.setHours(targetHours, targetMins, 0, 0);
        const alertTime = new Date(targetTime.getTime() - windDownMinutes * 60000);

        await LocalNotifications.schedule({
          notifications: [
            {
              title: 'Wind-Down Time 🌙',
              body: `Time to start unwinding! It's exactly ${windDownMinutes} minutes before your targeted bedtime. Dim the lights and relax!`,
              id: 1,
              schedule: { 
                on: { 
                  hour: alertTime.getHours(), 
                  minute: alertTime.getMinutes() 
                }, 
                allowWhileIdle: true 
              },
            }
          ]
        });
      };
      
      manageNativeSchedule();
      return;
    }

    // WEB FALLBACK (setInterval approach)
    if (!enabled || !targetBedtime) return;

    let lastNotifiedDate = localStorage.getItem('last_notified_date');

    const checkTime = () => {
      const now = new Date();
      const todayStr = localDateKey(now);
      
      if (lastNotifiedDate === todayStr) return;

      const [targetHours, targetMins] = targetBedtime.split(':').map(Number);
      const targetTime = new Date();
      targetTime.setHours(targetHours, targetMins, 0, 0);
      const alertTime = new Date(targetTime.getTime() - windDownMinutes * 60000);

      const diffMs = now.getTime() - alertTime.getTime();
      
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

    const intervalId = setInterval(checkTime, 60000);
    checkTime();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkTime();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
