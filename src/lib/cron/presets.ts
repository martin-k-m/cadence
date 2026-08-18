export interface Preset {
  id: string;
  expression: string;
  name: string;
  note: string;
}

export const PRESETS: Preset[] = [
  { id: "5min", expression: "*/5 * * * *", name: "Every five minutes", note: "Health checks, queue drains." },
  { id: "hourly", expression: "0 * * * *", name: "Hourly, on the hour", note: "Same as @hourly." },
  { id: "nightly", expression: "0 3 * * *", name: "Nightly at 03:00", note: "The classic batch window." },
  {
    id: "workday",
    expression: "30 9 * * 1-5",
    name: "Weekday mornings at 09:30",
    note: "Weekdays only, in the schedule's own timezone.",
  },
  { id: "weekly", expression: "0 8 * * 1", name: "Monday mornings at 08:00", note: "Weekly report." },
  { id: "monthly", expression: "0 0 1 * *", name: "First of the month", note: "Same as @monthly." },
  {
    id: "quarter",
    expression: "0 0 1 1,4,7,10 *",
    name: "Start of each quarter",
    note: "January, April, July and October.",
  },
  {
    id: "twice",
    expression: "0 9,17 * * 1-5",
    name: "Twice each working day",
    note: "Start and end of the day.",
  },
  {
    id: "business-hours",
    expression: "*/15 9-17 * * 1-5",
    name: "Every 15 minutes, business hours",
    note: "Nine to five, Monday to Friday.",
  },
  {
    id: "friday-13th",
    expression: "0 0 13 * 5",
    name: "The 13th, or any Friday",
    note: "A demonstration of cron's OR rule — this is not “Friday the 13th”.",
  },
  {
    id: "leap",
    expression: "0 0 29 2 *",
    name: "29 February",
    note: "Fires once every four years. Worth checking your assumptions.",
  },
  {
    id: "month-end",
    expression: "0 23 28-31 * *",
    name: "Last days of the month",
    note: "Cron has no “last day” token, so this is the usual approximation.",
  },
];
