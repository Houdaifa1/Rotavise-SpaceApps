import type { SVGProps } from "react";

// Original Rotavise paths. A shared viewBox and pen keep the set consistent.
export const iconPaths = {
  map: "M3 5 9 3l6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16",
  fields: "M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z",
  "field-add": "m4 4 10-1 3 10-6 7-8-4L4 4Zm14 12v6m-3-3h6",
  crop: "M12 21V4m0 7C6 11 5 7 6 4c4 0 6 3 6 7Zm0 6c6 0 8-4 7-7-4 0-7 3-7 7Z",
  rotation:
    "M5 7a8 8 0 0 1 13-1l2 2m0-5v5h-5M19 17a8 8 0 0 1-13 1l-2-2m0 5v-5h5",
  calendar:
    "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2-2v5m10-5v5M3 11h18M7 15h2m6 0h2m-10 3h2",
  droplet: "M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Zm-3 13c0 2 1 3 3 3",
  thermometer: "M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Zm3-6v10m5-10h3m-3 4h2",
  snowflake:
    "M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3M9 20l3-3 3 3M3 11l4-1V6m14 7-4 1v4M3 13l4 1v4m14-7-4-1V6",
  leaf: "M4 20c3-10 8-12 16-16 0 12-4 17-12 14M8 16l6-6",
  layers: "m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5",
  ruler: "m3 16 13-13 5 5L8 21l-5-5Zm6-6 2 2m2-6 2 2M5 14l2 2",
  locate: "m3 10 18-7-7 18-3-8-8-3Z",
  "zoom-in": "M5 12h14M12 5v14",
  "zoom-out": "M5 12h14",
  search: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  filter: "M3 6h18M6 12h12m-9 6h6M7 3v6m10 0v6m-5 0v6",
  sort: "M5 4v16m-3-3 3 3 3-3m3-12h10m-10 5h7m-7 5h4",
  "chevron-down": "m6 9 6 6 6-6",
  "chevron-left": "m15 6-6 6 6 6",
  "chevron-right": "m9 6 6 6-6 6",
  close: "m6 6 12 12M6 18 18 6",
  check: "m4 12 5 5L20 6",
  warning: "m12 3 10 18H2L12 3Zm0 6v5m0 3v.1",
  info: "M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  help: "M9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 3m0 3v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  language:
    "M3 5h12M9 2v3m-4 3c2 5 5 7 9 8m-2-11c0 5-4 10-9 12m12 4 4-11 4 11m-7-3h6",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  "sign-out": "M10 3H4v18h6m5-14 5 5-5 5m-7-5h12",
  camera: "M3 7h4l2-3h6l2 3h4v13H3V7Zm13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M9 10v7m6-7v7",
  edit: "m4 16-1 5 5-1L21 7l-4-4L4 16Zm10-10 4 4",
  save: "M4 3h13l4 4v14H3V3h1Zm3 0v7h9V3M7 21v-7h10v7",
  undo: "M8 5 3 10l5 5m-5-5h12a6 6 0 0 1 0 12",
  redo: "m16 5 5 5-5 5m5-5H9a6 6 0 0 0 0 12",
  play: "m7 3 14 9-14 9V3Z",
  pause: "M7 3v18M17 3v18",
  share:
    "M17 5 7 11m0 2 10 6M7 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm16-8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm0 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  download: "M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4",
  source:
    "M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1m0-16c4-3 8-2 10-1v16c-4-2-7-1-10 1V5Z",
  grid: "M3 3h18v18H3V3Zm6 0v18m6-18v18M3 9h18M3 15h18",
} as const;
export type IconName = keyof typeof iconPaths;
export type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  label?: string;
};
export function Icon({
  name,
  label,
  ...props
}: IconProps & { name: IconName }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...props}
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}
// Named SVG components, as well as Icon, are available to feature consumers.
export const icons = Object.fromEntries(
  Object.keys(iconPaths).map((name) => [
    name,
    (props: IconProps) => <Icon name={name as IconName} {...props} />,
  ]),
) as Record<IconName, (props: IconProps) => React.ReactNode>;
