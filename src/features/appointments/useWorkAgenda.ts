import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';

import { useAppointmentsInMonth, useCreateAppointment, useDeleteAppointment } from '@/features/appointments/hooks';
import { useNotificationSync } from '@/features/appointments/useNotificationSync';
import { formatIsoDate, getWeekDays, parseIsoDate } from '@/lib/dateTimeInput';
import type { AppointmentListItem } from '@/services/appointments';

const getToday = (): string => formatIsoDate(new Date());

const monthAnchorOf = (isoDate: string): Date => {
  const date = parseIsoDate(isoDate);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

export interface WorkAgenda {
  selectedDate: string;
  selectDate: (isoDate: string) => void;
  weekDays: string[];
  todayDateKey: string;
  /** Cantidad de turnos por fecha, para los puntos del selector de semana. */
  countsByDate: Map<string, number>;
  dayAppointments: AppointmentListItem[];
  isLoading: boolean;
  createAppointment: ReturnType<typeof useCreateAppointment>;
  deleteAppointment: ReturnType<typeof useDeleteAppointment>;
}

/**
 * Estado y datos de la agenda semanal. Vive fuera de los componentes para que el
 * selector de semana pueda renderizarse en el encabezado de AppScreen y el
 * timeline en el cuerpo, compartiendo la misma selección.
 */
export const useWorkAgenda = (): WorkAgenda => {
  const isFocused = useIsFocused();
  const [selectedDate, setSelectedDate] = useState(getToday);

  // Sincroniza las notificaciones locales con los turnos próximos al montar.
  useNotificationSync();

  useEffect(() => {
    if (!isFocused) return;
    setSelectedDate(getToday());
  }, [isFocused]);

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  // Una semana puede cruzar dos meses y el hook trae los turnos por mes: se
  // consultan ambos extremos. Si caen en el mismo mes, React Query comparte la
  // misma query y no hay pedido de más.
  const firstMonth = useMemo(() => monthAnchorOf(weekDays[0] ?? selectedDate), [weekDays, selectedDate]);
  const lastMonth = useMemo(() => monthAnchorOf(weekDays[weekDays.length - 1] ?? selectedDate), [weekDays, selectedDate]);
  const firstMonthQuery = useAppointmentsInMonth(firstMonth);
  const lastMonthQuery = useAppointmentsInMonth(lastMonth);

  const appointments = useMemo(() => {
    const byId = new Map<string, AppointmentListItem>();
    [...(firstMonthQuery.data ?? []), ...(lastMonthQuery.data ?? [])].forEach((appointment) => {
      byId.set(appointment.id, appointment);
    });
    return [...byId.values()];
  }, [firstMonthQuery.data, lastMonthQuery.data]);

  const countsByDate = useMemo(() => {
    const map = new Map<string, number>();
    appointments.forEach((appointment) => {
      map.set(appointment.scheduled_for, (map.get(appointment.scheduled_for) ?? 0) + 1);
    });
    return map;
  }, [appointments]);

  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.scheduled_for === selectedDate)
        .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? '')),
    [appointments, selectedDate],
  );

  return {
    selectedDate,
    selectDate: setSelectedDate,
    weekDays,
    todayDateKey: getToday(),
    countsByDate,
    dayAppointments,
    isLoading: firstMonthQuery.isLoading || lastMonthQuery.isLoading,
    createAppointment: useCreateAppointment(),
    deleteAppointment: useDeleteAppointment(),
  };
};
