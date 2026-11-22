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
const INK = "#0f172a";
const INK_2 = "#4a5465";
const INK_3 = "#687284";
const LINE = "#e5e8ed";
const BRAND = "#2f5bff";

// The Bolt Z wordmark (brand kit 2026-11: ink letters, voltage-blue z), inlined so
// the image needs no file or network access.
const LOGO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="27 36 788 167"><path fill="#0F172A" d="M44.2 186V110.6H28.4V86H44.2V76.72Q44.2 60.36 52.8 51.02Q61.4 41.68 79.12 41.68Q85.84 41.68 93.04 43.92Q100.24 46.16 105.4 49.2L93.8 71.24Q91.32 69.56 88.94 68.88Q86.56 68.2 84.52 68.2Q79.8 68.2 77.6 71.48Q75.4 74.76 75.4 82.48V86H98V110.6H75.4V186Z M112.6 186V46H143.8V186Z M163.56 186V86H194.76V186ZM179.2 73.12Q172.16 73.12 166.88 67.84Q161.6 62.56 161.6 55.52Q161.6 48.28 166.88 43.1Q172.16 37.92 179.2 37.92Q186.44 37.92 191.62 43.1Q196.8 48.28 196.8 55.52Q196.8 62.56 191.62 67.84Q186.44 73.12 179.2 73.12Z M257.52 188.4Q239.88 188.4 231.12 179.9Q222.36 171.4 222.36 155.6V112.2H206.8V86H222.36V54.8H253.56V86H276.4V112.2H253.56V147.76Q253.56 153.84 255.76 156.66Q257.96 159.48 262.64 159.48Q264.4 159.48 266.78 158.54Q269.16 157.6 271.16 156.2L281.92 179.08Q277.16 182.92 270.52 185.66Q263.88 188.4 257.52 188.4Z M462.26 186 428.26 86H460.1L478.38 144.44L496.86 86H527.58L545.54 143.08L564.26 86H596.1L561.94 186H531.34L512.14 123.44L492.9 186Z M653.76 188.4Q638.26 188.4 626.26 181.75Q614.26 175.1 607.46 163.3Q600.66 151.5 600.66 136Q600.66 120.5 607.51 108.7Q614.36 96.9 626.41 90.25Q638.46 83.6 654.16 83.6Q668.46 83.6 679.86 90.4Q691.26 97.2 697.96 110.65Q704.66 124.1 704.66 144H633.06Q634.06 152.7 640.11 157.8Q646.16 162.9 654.66 162.9Q662.06 162.9 667.11 159.6Q672.16 156.3 674.16 151.2L701.76 160.7Q697.86 170.1 690.56 176.3Q683.26 182.5 673.81 185.45Q664.36 188.4 653.76 188.4ZM633.86 123.2H672.06Q671.26 117.3 668.26 113.8Q665.26 110.3 661.26 108.75Q657.26 107.2 653.26 107.2Q649.36 107.2 645.21 108.7Q641.06 110.2 637.91 113.7Q634.76 117.2 633.86 123.2Z M775.14 188.4Q765.5 188.4 758.26 184.5Q751.02 180.6 746.18 173.24L745.1 186H715.46V46H746.66V97.96Q751.5 90.92 758.58 87.26Q765.66 83.6 775.14 83.6Q789.14 83.6 799.26 89.9Q809.38 96.2 814.86 107.92Q820.34 119.64 820.34 136.01Q820.34 152.16 814.86 163.98Q809.38 175.8 799.26 182.1Q789.14 188.4 775.14 188.4ZM766.98 159.68Q773.03 159.68 777.68 156.62Q782.34 153.56 785.1 148.23Q787.86 142.91 787.86 135.99Q787.86 129.08 785.23 123.77Q782.6 118.46 777.92 115.47Q773.25 112.48 767.18 112.48Q761.21 112.48 756.54 115.48Q751.88 118.48 749.27 123.8Q746.66 129.11 746.66 136.02Q746.66 142.92 749.26 148.28Q751.86 153.64 756.44 156.66Q761.03 159.68 766.98 159.68Z"/><path fill="#2F5BFF" d="M299.93 70 L303.97 63 L416.26 63 L362.56 156 L414.52 186 L410.48 193 L298.2 193 L351.89 100 Z"/></svg>',
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
        background: "#f5f8fc",
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
            <img src={LOGO} width={207} height={44} alt="FlitzWeb" />
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 600,
              color: BRAND,
              background: "#ebefff",
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
                background: "#ebefff",
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
