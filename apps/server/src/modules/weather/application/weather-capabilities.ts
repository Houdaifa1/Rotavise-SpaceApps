import {
  latestWeatherDate,
  MAX_WEATHER_DAYS,
  weatherVariableAvailability,
  weatherVariables,
} from "@rotavise/contracts";
import {
  WEATHER_REGISTRY,
  WEATHER_ADAPTER_VERSION,
} from "../providers/nasa-power/parameters.js";
export function weatherCapabilities(now = new Date()) {
  return {
    provider: "nasa-power",
    adapterVersion: WEATHER_ADAPTER_VERSION,
    location: "source-cell-centre-not-farm-position",
    temporalResolution: "daily",
    timeStandard: "UTC",
    earliestDate: "1981-01-01",
    latestAllowedDate: latestWeatherDate(now),
    dateAvailability: "policy-bound-not-a-guarantee-of-complete-data",
    maxDays: MAX_WEATHER_DAYS,
    variables: weatherVariables.map((id) => {
      const { earliestDate, source, latitudeDegrees, longitudeDegrees } =
        weatherVariableAvailability[id];
      return {
        id,
        ...WEATHER_REGISTRY[id],
        earliestDate,
        source,
        sourceResolution: {
          latitudeDegrees,
          longitudeDegrees,
          basis: "documented-source-grid-not-field-resolution",
        },
      };
    }),
    warning:
      "Reanalysis grid estimates for the source cell that contains the point; requests use the cell centre. Not measured field weather, forecasts or crop advice. Missing observations are null.",
  };
}
