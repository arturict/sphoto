import { Link, type LinkProps } from '@tanstack/react-router';
import { useId, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { SpinnerIcon } from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 min-h-11';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-fg hover:bg-sunken',
  danger: 'bg-danger text-white hover:bg-danger-hover',
};

export const buttonClasses = (variant: ButtonVariant = 'primary'): string => `${base} ${variants[variant]}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  pending?: boolean;
}

export function Button({ variant = 'primary', pending = false, disabled, children, className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={`${buttonClasses(variant)} ${className}`} disabled={disabled || pending} aria-busy={pending || undefined} {...rest}>
      {pending ? <SpinnerIcon /> : null}
      {children}
    </button>
  );
}

export function ExternalLinkButton({ variant = 'primary', className = '', ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant }) {
  return <a className={`${buttonClasses(variant)} ${className}`} {...rest} />;
}

export function RouterLinkButton({ variant = 'primary', className = '', ...rest }: LinkProps & { variant?: ButtonVariant; className?: string }) {
  return <Link className={`${buttonClasses(variant)} ${className}`} {...rest} />;
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
}

export function TextField({ label, hint, className = '', ...rest }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hint ? hintId : undefined}
        className={`min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base placeholder:text-muted ${className}`}
        {...rest}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type Tone = 'danger' | 'ok' | 'warn' | 'info';

const toneClasses: Record<Tone, string> = {
  danger: 'border-danger-text/40 bg-danger-soft text-danger-text',
  ok: 'border-ok-text/40 bg-ok-soft text-ok-text',
  warn: 'border-warn-text/40 bg-warn-soft text-warn-text',
  info: 'border-accent/40 bg-accent-soft text-fg',
};

export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className={`rounded-lg border px-4 py-3 text-sm ${toneClasses.danger}`}>
      {children}
    </div>
  );
}

export function Notice({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${toneClasses[tone]}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
    </div>
  );
}

export function Card({ children, className = '', as: Tag = 'div', ...rest }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' } & Omit<HTMLAttributes<HTMLElement>, 'className'>) {
  return (
    <Tag className={`rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6 ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function Loading({ label = 'Wird geladen…' }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-muted">
      <SpinnerIcon className="size-5" />
      {label}
    </p>
  );
}

export function StatusBadge({ tone, children }: { tone: Tone | 'neutral'; children: ReactNode }) {
  const classes = tone === 'neutral' ? 'border-line bg-sunken text-muted' : toneClasses[tone];
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${classes}`}>{children}</span>;
}
