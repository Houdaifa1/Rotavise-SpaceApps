import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { cropDetailParamsSchema } from "@rotavise/contracts";
import { useApi, useBoot } from "../../app/providers/Runtime.js";
import { getCropDetail } from "../../api/catalog.js";
import { keys } from "../../api/keys.js";
import { failureText } from "../../api/errors.js";
import { Skeleton } from "../../design/primitives/feedback.js";
import { useMessages } from "../../i18n/messages.js";
import { RetryButton } from "../../shared/RetryButton.js";
import { CropPicker } from "./CropPicker.js";
import { CropProfile } from "./CropProfile.js";

export function Component() {
  const { id } = useParams();
  const { catalog, glossary } = useBoot();
  const client = useApi();
  const navigate = useNavigate();
  const details = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (id) details.current?.focus({ preventScroll: true });
  }, [id]);
  const { t, language } = useMessages();
  const params =
    catalog.data && id
      ? cropDetailParamsSchema.safeParse({
          catalogId: catalog.data.catalogId,
          version: catalog.data.catalogVersion,
          cropId: id,
        })
      : undefined;
  const detail = useQuery({
    queryKey: keys.cropDetail(
      catalog.data?.catalogId ?? "",
      catalog.data?.catalogVersion ?? "",
      id ?? "",
    ),
    enabled: params?.success === true,
    staleTime: Infinity,
    queryFn: ({ signal }) =>
      getCropDetail(client, { params: params!.data!, signal }),
  });
  return (
    <section className="f1-page">
      <h1>{t("nav.crops")}</h1>
      <div className="f4-catalog-layout" data-crop-open={!!id}>
        <CropPicker
          label={t("crops.search")}
          value={id}
          onChange={(crop) => void navigate(`/crops/${crop}`)}
        />
        {id && (
          <div
            className="f4-catalog-detail"
            key={id}
            ref={details}
            tabIndex={-1}
          >
            <Link to="/crops">{t("crops.back")}</Link>
            {params?.success === false && (
              <p role="status">{t("error.notFoundText")}</p>
            )}
            {(detail.isFetching || catalog.isPending) && !detail.data && (
              <Skeleton shape="row" />
            )}
            {!catalog.data && catalog.isError && (
              <div role="status">
                <p>{t("boot.catalogUnavailable")}</p>
                <RetryButton
                  error={catalog.error}
                  busy={catalog.isFetching}
                  retry={() => void catalog.refetch()}
                />
              </div>
            )}
            {detail.error && (
              <div role="status">
                <p>{failureText(detail.error, language, glossary.data)}</p>
                <RetryButton
                  error={detail.error}
                  busy={detail.isFetching}
                  retry={() => void detail.refetch()}
                />
              </div>
            )}
            {detail.data && <CropProfile crop={detail.data} />}
          </div>
        )}
      </div>
    </section>
  );
}
