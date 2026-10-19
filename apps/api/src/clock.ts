export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * 86_400_000);
