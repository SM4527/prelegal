/** The Prelegal wordmark, linking home. */
export function Logo() {
  return (
    <a href="/" className="flex items-center gap-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue">
      <span aria-hidden className="relative flex size-8 items-center justify-center rounded-lg bg-brand-navy text-sm font-bold text-white">
        P
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-brand-yellow ring-2 ring-white" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-brand-navy">Prelegal</span>
    </a>
  );
}
