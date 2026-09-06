"use client";

/**
 * Monitoring tab — hook wiring only.
 *
 * All layout lives in `@/components/monitoring/MonitoringView`, which takes every input
 * as a prop. That split exists so the layout can also be rendered from fixtures at
 * `/dev/monitoring` — the only place fixture data is allowed — instead of needing a
 * control plane, a deployed project and real traffic to look at.
 * FE1-S5 (openship#23): this production tab no longer imports fixture data itself.
 *
 * Four sources, deliberately separate — they have genuinely different shapes:
 *   useProjectUsageStream  — SSE, ~5s. Live resources; keeps nothing.
 *   useProjectUsageHistory — sampled 5-minute buckets. What the stream forgets.
 *   useAnalyticsGeo        — per-DAY rollups: countries, visitors, paths, statuses.
 *   useAnalyticsData       — per-MINUTE series for the traffic chart.
 *
 * The geo/overview split isn't arbitrary: countries, visitors and paths are only
 * aggregated daily at the edge (per-minute would multiply its shared-dict cardinality
 * by ~1440 and evict the request counters they annotate), so they can't come from the
 * same fetch as the minute series.
 */

import React, { useMemo, useState } from "react";
import { TrafficChart, TopPaths } from "./general";
import { MonitoringView } from "@/components/monitoring/MonitoringView";
import { useProjectSettings } from "@/context/ProjectSettingsContext";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n, interpolate } from "@/components/i18n-provider";
import { formatCount } from "@/components/monitoring/format";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/api/endpoints";
import {
  useAnalyticsData,
  useAnalyticsGeo,
  useProjectUsageHistory,
} from "@/hooks/useProjectEndpoints";
import { useProjectUsageStream } from "@/hooks/useProjectUsageStream";
import { useLiveHits } from "@/components/monitoring/LiveHits";
import { TopPathsEmptyState } from "@/components/monitoring/TopPathsEmptyState";
import { useRequestLogStream } from "@/hooks/useRequestLogStream";

/** The sampler writes a point every 5 min; a 60s poll picks up new buckets soon after
 *  they land so the chart grows without a page reload, at a cost of one small GET/min. */
const USAGE_HISTORY_POLL_MS = 60_000;

export const MonitoringTab = () => {
  const { id, projectData, domain } = useProjectSettings();
  // Desktop runs no background sampler, so the persisted history series is always
  // empty there — hide the chart and skip its poll. The live "right now" card still
  // works (it reads the local Docker socket) and is unaffected.
  const { deployMode } = usePlatform();
  const isDesktop = deployMode === "desktop";

  /**
   * Which domain the whole tab is scoped to. `null` = All.
   *
   * Deliberately NOT the context's `selectedDomain`: that one defaults to the project's
   * PRIMARY domain, so a multi-domain project silently showed one domain's traffic as if
   * it were the project's. Local state defaulting to All means the first thing you see is
   * everything, and narrowing is an explicit act.
   *
   * The edge already keys its counters by host, and every analytics endpoint takes
   * `?domain=`, so scoping is a query param — no new server work.
   */
  const { t } = useI18n();
  const [domainScope, setDomainScope] = useState<string | null>(null);
  const domains = useMemo<string[]>(() => {
    const list = (projectData?.domains ?? []) as Array<{ domain?: string }>;
    return Array.from(
      new Set(list.map((d) => d.domain?.trim()).filter((d): d is string => !!d)),
    );
  }, [projectData?.domains]);
  // Primary-first, so the live-stream cap (MAX_STREAMS) drops the least-used tail, not the
  // domain that matters most. Mirrors ServerLogs so the map's default All scope fans out
  // across every route instead of tailing only the primary — a busy secondary domain must
  // still ripple when the primary is idle.
  const streamDomains = useMemo(
    () => (domain && domains.includes(domain) ? [domain, ...domains.filter((d) => d !== domain)] : domains),
    [domains, domain],
  );

  // Atomic fetches — own state, own loading, no context coupling. Backed by
  // module-level caches shared with OverviewTab, so both tabs make one request each.
  // Hooks always run — calling them conditionally would break the hook order.
  const liveId = id;
  const { data: liveAnalytics, isLoading: isLoadingAnalytics } = useAnalyticsData(liveId, domainScope);
  const { data: liveGeo, isLoading: isLoadingGeo } = useAnalyticsGeo(liveId, domainScope);
  const { usage: liveUsage, isConnected, error: usageError, reconnect } = useProjectUsageStream(liveId);

  /** Scope for the history read. Held here rather than in the view because it keys the
   *  fetch — the view raises changes through `onServiceKeyChange`. */
  const [serviceKey, setServiceKey] = React.useState<string | null>(null);
  const { data: liveHistory, isLoading: isLoadingHistory } = useProjectUsageHistory(
    liveId,
    serviceKey,
    isDesktop ? undefined : USAGE_HISTORY_POLL_MS,
  );

  /**
   * Live hits on the map, off by default.
   *
   * Wired HERE rather than inside the map because opening the stream needs the projectId
   * and the cloud-vs-self-hosted token branch.
   *
   * Same feed as the Logs tab (`useRequestLogStream`), so a ripple corresponds to a row
   * you can go and read there — and the country on it is the one the edge resolved, which
   * behind Cloudflare is the visitor rather than the PoP.
   */
  const [liveOn, setLiveOn] = useState(false);
  const hits = useLiveHits();
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  useRequestLogStream({
    projectId: id,
    domain: domainScope,
    // When no single domain is scoped (default All), fan out across every route so the map
    // aggregates all domains combined; a scoped `domainScope` still wins over this list.
    domains: streamDomains,
    enabled: liveOn,
    onEntry: (e) => hits.push({ country: e.country, path: e.path, statusCode: e.statusCode }),
    onStatus: (st) => setLiveStatus(st.state === "error" || st.state === "unavailable" ? st.state : null),
  });


  // Turning it off, or changing which domain is in scope, clears the counter and the feed —
  // carrying a total across a scope change would attribute one domain's hits to another.
  // Same reason as above: depend on the stable `reset`, not on the whole object. As a prop
  // on VisitorMap, an unstable `setLive` also re-rendered the map on every tick.
  const resetHits = hits.reset;
  const setLive = React.useCallback(
    (on: boolean) => {
      resetHits();
      setLiveOn(on);
    },
    [resetHits],
  );
  React.useEffect(() => {
    resetHits();
  }, [domainScope, resetHits]);

  const analytics = liveAnalytics;
  const geo = liveGeo;
  const usage = liveUsage;
  const history = liveHistory;


  /**
   * Turn per-path collection on or off.
   *
   * Optimistic on the client but authoritative on the server: the API persists the row
   * THEN pushes to the edge's shared dict, and every route apply re-pushes from the row —
   * so a failed edge push self-heals rather than leaving the two disagreeing. The local
   * flag is only so the card flips immediately instead of after the next geo refetch.
   */
  const [pathsOverride, setPathsOverride] = React.useState<boolean | null>(null);
  const [pathsBusy, setPathsBusy] = React.useState(false);
  const setPathsCollection = React.useCallback(
    async (enabled: boolean) => {
      setPathsBusy(true);
      try {
        await api.post(`${endpoints.analytics.pathsCollection}/${encodeURIComponent(id)}`, {
          enabled,
        });
        setPathsOverride(enabled);
      } catch {
        // Leave the card as it was — pretending it flipped would misreport what the edge
        // is actually doing to every request.
      } finally {
        setPathsBusy(false);
      }
    },
    [id],
  );

  // Cloud reports pathsEnabled: true unconditionally — Oblien's edge aggregates paths
  // regardless, so there is nothing to switch and no button should be offered.
  const canTogglePaths = geo?.source === "self-hosted";
  const pathsEnabled = pathsOverride ?? geo?.pathsEnabled ?? false;

  // Share is against the summed PATH hits, not totalRequests: static assets are
  // excluded from path counting, so dividing by total requests would make every share
  // look artificially small.
  const topPaths = React.useMemo(() => {
    const list = geo?.topPaths ?? [];
    const total = list.reduce((sum, p) => sum + p.count, 0);
    return list.map((p) => ({
      ...p,
      percentage: total > 0 ? ((p.count / total) * 100).toFixed(1) : "0.0",
    }));
  }, [geo]);

  const dateRange = analytics
    ? `${new Date(analytics.summary.firstRequest).toLocaleDateString()} - ${new Date(analytics.summary.lastRequest).toLocaleDateString()}`
    : undefined;

  return (
    <MonitoringView
      analytics={analytics}
      isLoadingAnalytics={isLoadingAnalytics}
      geo={geo}
      isLoadingGeo={isLoadingGeo}
      history={history}
      isLoadingHistory={isLoadingHistory}
      historySupported={!isDesktop}
      usage={usage}
      isUsageConnected={isConnected}
      usageError={usageError}
      onReconnectUsage={reconnect}
      serviceKey={serviceKey}
      onServiceKeyChange={setServiceKey}
      // Shown on the traffic block's fold line, so a collapsed block still states the
      // number and only the shape of the curve costs a click.
      trafficSummary={
        analytics
          ? interpolate(t.projects.monitoring.trafficSummary, {
              count: formatCount(analytics.summary.totalRequests),
            })
          : undefined
      }
      trafficChart={
        <TrafficChart
          trafficData={analytics?.trafficByHour ?? []}
          isLoading={isLoadingAnalytics}
          dateRange={dateRange}
          totalRequests={analytics?.summary.totalRequests}
        />
      }
      topPaths={
        // Three states, and they must not collapse into one: collection OFF (offer to turn
        // it on), ON with data, and ON with nothing yet (the card renders its own zero
        // state). Before `pathsEnabled` existed, off and on-but-empty looked identical.
        pathsEnabled ? (
          topPaths.length > 0 ? (
            <TopPaths
              paths={topPaths}
              onDisable={canTogglePaths ? () => setPathsCollection(false) : undefined}
              isBusy={pathsBusy}
            />
          ) : null
        ) : canTogglePaths ? (
          <TopPathsEmptyState onEnable={() => setPathsCollection(true)} isBusy={pathsBusy} />
        ) : null
      }
      domains={domains}
      domainScope={domainScope}
      live={{
        enabled: liveOn,
        onEnabledChange: setLive,
        total: hits.total,
        ripples: hits.ripples,
        feed: hits.feed,
        status: liveStatus,
      }}
      onDomainScopeChange={setDomainScope}
    />
  );
};
