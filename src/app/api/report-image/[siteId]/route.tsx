/* eslint-disable @next/next/no-img-element -- rendered to a PNG by next/og, not shown in a page */
import { ImageResponse } from "next/og";
import { highlights } from "@/features/summary/message";
import { hiddenParts } from "@/features/summary/parts";
import {
  getMonthSummary,
  getReportNote,
  summaryMonth,
} from "@/features/summary/queries";
import { formatMonth } from "@/lib/dates";
import { displayHost } from "@/lib/format";
import { sessionEmail } from "@/lib/auth";
import { getSite } from "@/lib/sites";

// The monthly report as a picture (1080 × 1350, the tall format WhatsApp and
// Instagram show in full) to send to the client. Login required.
// next/og only does flexbox, so every box with more than one child sets display: flex.

const W = 1080;
const H = 1350;
const PAD = 32; // grey margin around the white card
const INNER = 56; // card padding left and right
const CONTENT = W - 2 * PAD - 2 * INNER - 4; // usable width inside the card (minus its border)
const INK = "#0e1420";
const INK_2 = "#4a5465";
const INK_3 = "#687284";
const LINE = "#e5e8ed";
const BRAND = "#2563eb";

// public/brand/mark.svg, inlined so the image needs no file or network access.
const MARK = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="36 166 276 202"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B82F6"/><stop offset="1" stop-color="#06B6D4"/></linearGradient></defs><g transform="rotate(-14 228 256)"><rect x="64" y="196" width="64" height="22" rx="11" fill="url(#g)" opacity="0.3"/><rect x="52" y="250" width="94" height="22" rx="11" fill="url(#g)" opacity="0.55"/><rect x="70" y="304" width="72" height="22" rx="11" fill="url(#g)" opacity="0.78"/><path d="M156,152 L156,344 L204,296 L240,360 L276,344 L240,284 L300,284 Z" fill="url(#g)"/></g></svg>',
)}`;

const dayFmt = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  if (!(await sessionEmail())) {
    return new Response(null, { status: 401 });
  }
  const id = Number((await params).siteId);
  const site = Number.isInteger(id) ? await getSite(id) : undefined;
  if (!site) return new Response(null, { status: 404 });

  const url = new URL(request.url);
  const { month } = summaryMonth(url.searchParams.get("maand"));
  const [summary, note] = await Promise.all([
    getMonthSummary(site.id, site.trackers, month, site.reportChartEvent),
    getReportNote(site.id, month),
  ]);
  const done = note?.done ?? "";
  // One page (or none) makes a pointless "most viewed" list: show only where visitors came from.
  const hidden = hiddenParts(site.reportHidden);
  const showPages = !hidden.has("pages") && summary.pages.length > 1;
  const showSources = !hidden.has("sources");
  const tiles = highlights(summary, hidden, site.reportLead);
  const { chart } = summary;
  const maxDay = Math.max(...chart.days.map((d) => d.value), 1);
  const peak = chart.days.find((d) => d.value === maxDay && d.value > 0);
  // Small numbers fit above every bar; with big ones only the busiest day gets its number.
  const labelAll = maxDay < 100 && !chart.isMoney;
  const fmtValue = (v: number) =>
    chart.isMoney
      ? `€ ${Math.round(v).toLocaleString("nl-NL")}`
      : v.toLocaleString("nl-NL");
  const monthLabel = capitalize(formatMonth(month));

  const image = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f3f5f8",
        padding: PAD,
        fontFamily: "sans-serif",
        color: INK,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          borderRadius: 36,
          border: `2px solid ${LINE}`,
          padding: `44px ${INNER}px 36px`,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={MARK} width={58} height={42} alt="" />
            <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>
              FlitzWeb
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 600,
              color: BRAND,
              background: "#eaf1fe",
              borderRadius: 999,
              padding: "10px 22px",
            }}
          >
            Maandoverzicht
          </div>
        </div>

        {/* Everything between header and footer sits in the middle, so a report with few parts has no empty bottom half. */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingTop: 28,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, color: INK_3, fontWeight: 500 }}>
              {monthLabel}
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                letterSpacing: -2,
                lineHeight: 1.1,
                marginTop: 4,
              }}
            >
              {site.name}
            </div>
            <div style={{ fontSize: 26, color: INK_3, marginTop: 8 }}>
              {displayHost(site.url)}
            </div>
          </div>

          {/* The numbers that matter, two per row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              marginTop: 26,
            }}
          >
            {tiles.map((t, i) => (
              <div
                key={t.label}
                style={{
                  width:
                    tiles.length % 2 === 1 && i === tiles.length - 1
                      ? CONTENT
                      : (CONTENT - 20) / 2,
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 24,
                  padding: "16px 26px",
                  background: i === 0 ? BRAND : "#f6f7f9",
                  color: i === 0 ? "#fff" : INK,
                }}
              >
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 500,
                    color: i === 0 ? "#dbe7ff" : INK_2,
                  }}
                >
                  {t.label}
                </div>
                <div
                  style={{
                    fontSize: 58,
                    fontWeight: 700,
                    letterSpacing: -2,
                    lineHeight: 1.15,
                  }}
                >
                  {t.value}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    color: i === 0 ? "#dbe7ff" : INK_3,
                    minHeight: 28,
                  }}
                >
                  {t.note ?? " "}
                </div>
              </div>
            ))}
          </div>

          {/* One bar per day, with the day of the month under it */}
          {!hidden.has("chart") && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 600, color: INK_2 }}>
                  {`${chart.label} per dag`}
                </div>
                {peak && (
                  <div style={{ display: "flex", fontSize: 21, color: INK_3 }}>
                    {`Beste dag: ${dayFmt.format(new Date(`${peak.day}T12:00:00Z`))} (${fmtValue(peak.value)})`}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 4,
                  height: 112,
                  marginTop: 10,
                  borderBottom: `2px solid ${LINE}`,
                }}
              >
                {chart.days.map((d) => {
                  const isPeak = d === peak;
                  return (
                    <div
                      key={d.day}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-end",
                      }}
                    >
                      {d.value > 0 && (labelAll || isPeak) && (
                        <div
                          style={{
                            display: "flex",
                            fontSize: 15,
                            fontWeight: 600,
                            color: isPeak ? BRAND : INK_3,
                            marginBottom: 2,
                          }}
                        >
                          {fmtValue(d.value)}
                        </div>
                      )}
                      <div
                        style={{
                          width: "100%",
                          height:
                            d.value > 0
                              ? Math.max(Math.round((d.value / maxDay) * 88), 4)
                              : 2,
                          borderRadius: "5px 5px 0 0",
                          background: isPeak
                            ? BRAND
                            : d.value > 0
                              ? "#c9dafc"
                              : LINE,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                {chart.days.map((d) => {
                  const weekend = [0, 6].includes(
                    new Date(`${d.day}T12:00:00Z`).getUTCDay(),
                  );
                  return (
                    <div
                      key={d.day}
                      style={{
                        flex: 1,
                        display: "flex",
                        justifyContent: "center",
                        fontSize: 15,
                        fontWeight: weekend ? 700 : 400,
                        color: weekend ? INK : INK_3,
                      }}
                    >
                      {Number(d.day.slice(8))}
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 17,
                  color: INK_3,
                  marginTop: 4,
                }}
              >
                Dag van de maand · vetgedrukt = weekend
              </div>
            </div>
          )}

          {/* Top pages and sources */}
          {(showPages || showSources) && (
            <div style={{ display: "flex", gap: 40, marginTop: 22 }}>
              {showPages && (
                <TopList title="Meest bekeken" rows={summary.pages} />
              )}
              {showSources && (
                <TopList
                  title="Bezoekers kwamen via"
                  rows={summary.referrers}
                />
              )}
            </div>
          )}

          {done && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 20,
                borderRadius: 20,
                background: "#eaf1fe",
                padding: "14px 24px",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 600, color: BRAND }}>
                Deze maand gedaan
              </div>
              <div style={{ fontSize: 25, lineHeight: 1.35, marginTop: 4 }}>
                {done}
              </div>
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            color: INK_3,
            borderTop: `2px solid ${LINE}`,
            paddingTop: 18,
            marginTop: 16,
          }}
        >
          <div>Gemaakt en onderhouden door FlitzWeb</div>
          <div>flitzweb.nl</div>
        </div>
      </div>
    </div>,
    { width: W, height: H },
  );

  const slug =
    site.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "site";
  image.headers.set(
    "Content-Disposition",
    `inline; filename="maandoverzicht-${slug}-${month.slice(0, 7)}.png"`,
  );
  image.headers.set("Cache-Control", "private, no-store");
  return image;
}

function TopList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 24, fontWeight: 600, color: INK_2 }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 24, color: INK_3, marginTop: 10 }}>
          Nog niets gemeten
        </div>
      ) : (
        rows.slice(0, 3).map((r) => (
          <div
            key={r.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              fontSize: 25,
              marginTop: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                maxWidth: 300,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {r.label === "/" ? "Homepagina" : r.label}
            </div>
            <div style={{ display: "flex", fontWeight: 600, color: INK_2 }}>
              {r.count.toLocaleString("nl-NL")}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
