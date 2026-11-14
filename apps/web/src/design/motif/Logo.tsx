export function Logo({ markOnly = false }: { markOnly?: boolean }) {
  return (
    <span className="rv-logo" role="img" aria-label="Rotavise">
      <svg aria-hidden="true" width="32" height="32" viewBox="0 0 32 32">
        <rect
          x="1"
          y="10"
          width="6"
          height="21"
          rx="2"
          fill="var(--logo-wheat)"
        />
        <rect
          x="9"
          y="2"
          width="6"
          height="29"
          rx="2"
          fill="var(--logo-lentil)"
        />
        <rect
          x="17"
          y="7"
          width="6"
          height="24"
          rx="2"
          fill="var(--logo-fallow)"
        />
        <rect
          x="25"
          y="0"
          width="6"
          height="31"
          rx="2"
          fill="var(--logo-faba)"
        />
      </svg>
      {!markOnly && <span>Rotavise</span>}
    </span>
  );
}
