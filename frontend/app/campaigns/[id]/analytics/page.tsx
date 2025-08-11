"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart as BarChartIcon,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Trash2,
  Sparkles,
  LayoutDashboard,
  Users,
  Map as MapIcon,
  Table as TableIcon,
  X as XIcon,
  Send,
  MessageSquare,
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Chart.js imports for AI-generated charts
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  RadialLinearScale,
  Filler,
} from "chart.js";
import {
  Bar as ChartBar,
  Line as ChartLine,
  Pie as ChartPie,
  Doughnut,
  Radar,
  PolarArea,
  Scatter as ChartScatter,
} from "react-chartjs-2";
import type { ChartData, ChartOptions, TooltipItem } from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  ChartTooltip,
  ChartLegend,
  RadialLinearScale,
  Filler
);

// --------------------------- Types ---------------------------
type ResponseRow = {
  id: string;
  campaign_id: string;
  created_at: string; // ISO
  answers: Record<string, unknown>;
  respondent_meta?: any; // { age?: string; gender?: string; party?: string; region?: string; ... }
};

type ViewRow = {
  id: string;
  date: string; // YYYY-MM-DD
  age: string;
  gender: string;
  party: string;
  region: string;
  answers: Record<string, number | string>;
};

// Chart spec used by NL command builder
type ChartSpec = {
  id: string;
  kind: "bar" | "line" | "pie" | "table";
  question?: string; // e.g., "Q1"
  by?: keyof ViewRow | "answers.Q3" | "answers.Q4";
  title: string;
};

// Chart.js payload type for AI-generated charts
type ChartPayload = {
  title: string;
  description: string;
  chart: {
    type: "bar" | "line" | "pie" | "doughnut" | "radar" | "polarArea";
    data: any;
    options?: any;
  };
  assistantText?: string;
};

// --------------------------- Theme ---------------------------
const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#7c3aed",
  "#0ea5e9",
  "#22c55e",
  "#eab308",
  "#d946ef",
  "#14b8a6",
];

// --------------------------- Chart Renderer for AI-generated charts ---------------------------
function ChartRenderer({ payload }: { payload: ChartPayload | null }) {
  if (!payload) return null;
  const { chart } = payload;
  const commonProps = { data: chart.data, options: chart.options } as any;

  switch (chart.type) {
    case "bar":
      return <ChartBar {...commonProps} />;
    case "line":
      return <ChartLine {...commonProps} />;
    case "pie":
      return <ChartPie {...commonProps} />;
    case "doughnut":
      return <Doughnut {...commonProps} />;
    case "radar":
      return <Radar {...commonProps} />;
    case "polarArea":
      return <PolarArea {...commonProps} />;
    default:
      return null;
  }
}

// --------------------------- Helper Functions ---------------------------
function getQuestionText(questionId: string, campaign: any): string {
  // Handle standard questions
  if (questionId === "Q1") return "Approval Rating";
  if (questionId === "Q2") return "Likelihood to Vote";
  if (questionId === "Q3") return "Most Important Issue";
  if (questionId === "Q4") return "Political Leaning";

  // Handle dynamic questions from campaign form_schema
  if (campaign?.form_schema) {
    try {
      // Parse the form_schema JSON if it's a string
      const schema =
        typeof campaign.form_schema === "string"
          ? JSON.parse(campaign.form_schema)
          : campaign.form_schema;

      if (schema?.questions && Array.isArray(schema.questions)) {
        const question = schema.questions.find((q: any) => q.id === questionId);
        if (question) {
          return (
            question.title || question.text || question.label || questionId
          );
        }
      }
    } catch (error) {
      console.error("Error parsing form_schema:", error);
    }
  }

  // Fallback: try the old questions format
  if (campaign?.questions) {
    const question = campaign.questions.find((q: any) => q.id === questionId);
    if (question) return question.text || question.label || questionId;
  }

  return questionId;
}

// --------------------------- Responses View Component ---------------------------
function ResponsesView({
  responses,
  campaign,
}: {
  responses: ResponseRow[];
  campaign: any;
}) {
  const [selectedResponse, setSelectedResponse] = useState<ResponseRow | null>(
    null
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const itemsPerPage = 20;

  // Filter responses based on search term
  const filteredResponses = useMemo(() => {
    if (!searchTerm) return responses;
    return responses.filter((response) => {
      const meta = response.respondent_meta || {};
      const searchableText = [
        meta.age,
        meta.gender,
        meta.party,
        meta.region,
        ...Object.values(response.answers || {}),
      ]
        .join(" ")
        .toLowerCase();
      return searchableText.includes(searchTerm.toLowerCase());
    });
  }, [responses, searchTerm]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredResponses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentResponses = filteredResponses.slice(startIndex, endIndex);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Auto-select first response when changing pages
  useEffect(() => {
    if (currentResponses.length > 0 && !selectedResponse) {
      setSelectedResponse(currentResponses[0]);
    }
  }, [currentResponses, selectedResponse]);

  const getResponsePreview = (response: ResponseRow) => {
    const meta = response.respondent_meta || {};
    const firstAnswer = Object.entries(response.answers || {})[0];
    return {
      meta,
      firstAnswer: firstAnswer
        ? `${firstAnswer[0]}: ${firstAnswer[1]}`
        : "No answers",
      totalAnswers: Object.keys(response.answers || {}).length,
    };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* Left Sidebar - Response List */}
      <div className="lg:col-span-1">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">All Responses</CardTitle>
            <CardDescription>
              {filteredResponses.length} of {responses.length} responses
            </CardDescription>
            {/* Search Box */}
            <Input
              placeholder="Search responses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-2"
            />
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden flex flex-col">
            {/* Response List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {currentResponses.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No responses found.
                </div>
              ) : (
                currentResponses.map((response, index) => {
                  const preview = getResponsePreview(response);
                  const globalIndex = startIndex + index + 1;
                  const isSelected = selectedResponse?.id === response.id;

                  return (
                    <div
                      key={response.id}
                      onClick={() => setSelectedResponse(response)}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50",
                        isSelected
                          ? "bg-blue-50 border-blue-200"
                          : "bg-white border-gray-200"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs">
                          #{globalIndex}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(response.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Demographics */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {preview.meta.age && (
                          <Badge variant="secondary" className="text-xs">
                            {preview.meta.age}
                          </Badge>
                        )}
                        {preview.meta.gender && (
                          <Badge variant="secondary" className="text-xs">
                            {preview.meta.gender}
                          </Badge>
                        )}
                        {preview.meta.party && (
                          <Badge variant="secondary" className="text-xs">
                            {preview.meta.party}
                          </Badge>
                        )}
                      </div>

                      {/* Preview */}
                      <div className="text-sm text-gray-600 truncate">
                        {preview.firstAnswer}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {preview.totalAnswers} answer
                        {preview.totalAnswers !== 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Detailed View */}
      <div className="lg:col-span-2">
        {selectedResponse ? (
          <ResponseDetailView response={selectedResponse} campaign={campaign} />
        ) : (
          <Card className="h-full flex items-center justify-center">
            <CardContent>
              <div className="text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a response to view details</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// --------------------------- Response Detail View Component ---------------------------
function ResponseDetailView({
  response,
  campaign,
}: {
  response: ResponseRow;
  campaign: any;
}) {
  const meta = response.respondent_meta || {};

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Response Details</CardTitle>
          <Badge variant="outline">
            {new Intl.DateTimeFormat("en-US", {
              year: "numeric",
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "UTC",
            }).format(new Date(response.created_at))}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="overflow-y-auto">
        {/* Demographics Section */}
        {(meta.age || meta.gender || meta.party || meta.region) && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Demographics
            </h3>
            <div className="flex flex-wrap gap-2">
              {meta.age && <Badge variant="secondary">Age: {meta.age}</Badge>}
              {meta.gender && <Badge variant="secondary">{meta.gender}</Badge>}
              {meta.party && <Badge variant="secondary">{meta.party}</Badge>}
              {meta.region && <Badge variant="secondary">{meta.region}</Badge>}
            </div>
          </div>
        )}

        {/* Questions and Answers */}
        <div className="space-y-6">
          {Object.entries(response.answers || {}).map(
            ([questionId, answer]) => (
              <div key={questionId} className="space-y-2">
                {/* Question Label */}
                <h3 className="text-lg font-semibold text-gray-800">
                  {getQuestionText(questionId, campaign)}
                </h3>

                {/* Answer */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-gray-900">
                    {typeof answer === "number" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-semibold">{answer}</span>
                        {(questionId === "Q1" || questionId === "Q2") && (
                          <span className="text-sm text-gray-500">
                            (1 = Strongly Disagree, 5 = Strongly Agree)
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-lg">{String(answer)}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// --------------------------- Helpers: transform + summarize ---------------------------
const makeId = (() => {
  let c = 0;
  return () => `c_${++c}`;
})();

function safeStr(v: unknown, fallback = "Unknown"): string {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s.length ? s : fallback;
}

function toDateKey(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "0000-00-00";
  }
}

// Try to coerce numeric-ish answers (e.g., "5") into numbers
function maybeNum(v: unknown): number | string {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(+v)) {
    return +v;
  }
  return typeof v === "string" ? v : String(v ?? "");
}

function transformResponses(responses: ResponseRow[]): ViewRow[] {
  return responses.map((r) => {
    const m = r.respondent_meta || {};
    const age = safeStr(m.age ?? m.Age ?? m.demographics?.age ?? "All");
    const gender = safeStr(
      m.gender ?? m.Gender ?? m.demographics?.gender ?? "All"
    );
    const party = safeStr(m.party ?? m.Party ?? m.demographics?.party ?? "All");
    const region = safeStr(
      m.region ?? m.Region ?? m.demographics?.region ?? "All"
    );
    const answers: Record<string, number | string> = {};
    for (const [k, v] of Object.entries(r.answers || {})) {
      answers[k] = maybeNum(v);
    }
    return {
      id: r.id,
      date: toDateKey(r.created_at),
      age,
      gender,
      party,
      region,
      answers,
    };
  });
}

function groupBy<T, K extends string>(
  items: T[],
  key: (t: T) => K
): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const it of items) {
    const k = key(it);
    (out[k] ||= []).push(it);
  }
  return out;
}

function getBy(row: ViewRow, by: ChartSpec["by"] | undefined): string {
  if (!by) return row.party;
  if (by === "answers.Q3") return safeStr(row.answers["Q3"], "Unknown");
  if (by === "answers.Q4") return safeStr(row.answers["Q4"], "Unknown");
  return safeStr((row as any)[by], "Unknown");
}

function summarizeByCategory(
  rows: ViewRow[],
  question: string,
  by: ChartSpec["by"] = "party"
) {
  const groups = groupBy(rows, (r) => getBy(r, by));
  const out: {
    name: string;
    avg: number;
    positiveShare: number;
    count: number;
  }[] = [];
  for (const name of Object.keys(groups)) {
    const arr = groups[name];
    let avg = 0;
    let pos = 0;
    let cnt = 0;
    for (const r of arr) {
      const v = r.answers[question];
      if (typeof v === "number") {
        avg += v;
        cnt++;
        if (v >= 4) pos++;
      }
    }
    if (cnt === 0) {
      out.push({ name, avg: 0, positiveShare: 0, count: arr.length });
    } else {
      out.push({
        name,
        avg: +(avg / cnt).toFixed(2),
        positiveShare: +((pos / cnt) * 100 || 0).toFixed(1),
        count: arr.length,
      });
    }
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

function timeSeries(rows: ViewRow[], question: string) {
  const byDate = groupBy(rows, (r) => r.date);
  const out: { date: string; avg: number; count: number }[] = [];
  for (const date of Object.keys(byDate)) {
    const arr = byDate[date];
    let sum = 0;
    let cnt = 0;
    for (const r of arr) {
      const v = r.answers[question];
      if (typeof v === "number") {
        sum += v;
        cnt++;
      }
    }
    if (cnt > 0) out.push({ date, avg: +(sum / cnt).toFixed(2), count: cnt });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

function pieBy(rows: ViewRow[], by: ChartSpec["by"] = "party") {
  const groups = groupBy(rows, (r) => getBy(r, by));
  return Object.keys(groups).map((name) => ({
    name,
    value: groups[name].length,
  }));
}

function kpi(rows: ViewRow[]) {
  const n = rows.length || 1;
  let approve = 0;
  let likely = 0;
  const issueCounts: Record<string, number> = {};
  for (const r of rows) {
    const q1 = r.answers["Q1"];
    const q2 = r.answers["Q2"];
    if (typeof q1 === "number" && q1 >= 4) approve++;
    if (typeof q2 === "number" && q2 >= 4) likely++;
    const iss = safeStr(r.answers["Q3"], "—");
    issueCounts[iss] = (issueCounts[iss] || 0) + 1;
  }
  const topIssue =
    Object.entries(issueCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  return {
    n: rows.length,
    approve: Math.round((approve / n) * 1000) / 10,
    likely: Math.round((likely / n) * 1000) / 10,
    topIssue,
  };
}

// --------------------------- NL command + QA ---------------------------
function includesOne(hay: string, list: string[]) {
  return list.some((w) => hay.includes(w));
}

function llmInterpret(command: string): ChartSpec[] | string {
  const cmd = command.toLowerCase().trim();
  if (includesOne(cmd, ["remove last", "delete last", "undo"]))
    return "__REMOVE_LAST__";
  const isBar = includesOne(cmd, ["bar chart", "histogram"]);
  const isLine = includesOne(cmd, ["line chart", "over time", "trend"]);
  const isPie = includesOne(cmd, ["pie chart", "share", "breakdown"]);
  const isTable = cmd.includes("table");
  const q = includesOne(cmd, ["q1", "approval"])
    ? "Q1"
    : includesOne(cmd, ["q2", "likely", "vote"])
      ? "Q2"
      : includesOne(cmd, ["q3", "issue"])
        ? "Q3"
        : includesOne(cmd, ["q4", "lean"])
          ? "Q4"
          : "Q1";
  let by: ChartSpec["by"] | undefined;
  if (cmd.includes("by age")) by = "age";
  else if (cmd.includes("by gender")) by = "gender";
  else if (cmd.includes("by party")) by = "party";
  else if (cmd.includes("by region")) by = "region";
  else if (cmd.includes("by issue")) by = "answers.Q3";
  else if (cmd.includes("by q4") || cmd.includes("by lean")) by = "answers.Q4";

  const panes: ChartSpec[] = [];
  if (isBar)
    panes.push({
      id: makeId(),
      kind: "bar",
      question: q,
      by: by || "party",
      title: `Bar: ${q} by ${by || "party"}`,
    });
  if (isLine)
    panes.push({
      id: makeId(),
      kind: "line",
      question: q,
      title: `Trend: ${q} over time`,
    });
  if (isPie && by)
    panes.push({ id: makeId(), kind: "pie", by, title: `Pie: ${by} share` });
  if (
    !isBar &&
    !isLine &&
    !isPie &&
    (isTable || cmd.includes("pane") || cmd.includes("panel"))
  )
    panes.push({
      id: makeId(),
      kind: "table",
      question: q,
      by: by || "region",
      title: `Table: ${q} by ${by || "region"}`,
    });
  if (panes.length === 0)
    panes.push({
      id: makeId(),
      kind: "bar",
      question: q,
      by: by || "party",
      title: `Bar: ${q} by ${by || "party"}`,
    });
  return panes;
}

function parseLastDays(cmd: string): number | null {
  const idx = cmd.indexOf("last ");
  if (idx === -1) return null;
  const tail = cmd.slice(idx + 5).trim();
  const parts = tail.split(" ");
  const num = Number(parts[0]);
  if (!Number.isFinite(num)) return null;
  return Math.max(7, Math.min(60, num));
}

function answerQuestion(rows: ViewRow[], text: string): string {
  const cmd = text.toLowerCase();
  const metrics = kpi(rows);
  if (
    includesOne(cmd, [
      "overall",
      "summary",
      "kpi",
      "how are we doing",
      "top issue",
    ])
  ) {
    return `In view: ${metrics.n.toLocaleString()} responses. Approval ≥4: ${metrics.approve
      }%. Likely-to-vote ≥4: ${metrics.likely}%. Top issue: ${metrics.topIssue}.`;
  }
  const groupKey = ["party", "age", "gender", "region", "issue"].find((k) =>
    cmd.includes("by " + k)
  );
  const q = includesOne(cmd, ["q1", "approval"])
    ? "Q1"
    : includesOne(cmd, ["q2", "likely", "vote"])
      ? "Q2"
      : includesOne(cmd, ["q3", "issue"])
        ? "Q3"
        : includesOne(cmd, ["q4", "lean"])
          ? "Q4"
          : undefined;
  if (groupKey && q) {
    const by = groupKey === "issue" ? "answers.Q3" : (groupKey as any);
    const rowsum = summarizeByCategory(rows, q, by as any);
    const lines = rowsum.map(
      (r) => `${r.name}: avg ${r.avg}, +% ${r.positiveShare} (n=${r.count})`
    );
    return `${q} by ${groupKey} — ${lines.join("; ")}`;
  }
  const d = parseLastDays(cmd);
  if (includesOne(cmd, ["trend", "over time"]) || d) {
    const which = q || "Q1";
    const days = d || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const filtered = rows.filter((r) => new Date(r.date) >= cutoff);
    const ts = timeSeries(filtered, which);
    if (!ts.length) return "No data for the requested window.";
    const first = ts[0].avg;
    const last = ts[ts.length - 1].avg;
    const delta = +(last - first).toFixed(2);
    return `Trend for ${which} over last ${days} days: ${first} → ${last} (Δ ${delta}).`;
  }
  return `I can report overall stats, compare by party/age/gender/region/issue, or describe trends (e.g., "trend of Q1 over last 14 days").`;
}

// --------------------------- Chart Card ---------------------------
function ChartCard({
  spec,
  rows,
  onRemove,
}: {
  spec: ChartSpec;
  rows: ViewRow[];
  onRemove: () => void;
}) {
  return (
    <Card className="rounded-2xl shadow-sm border border-gray-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {spec.kind === "bar" && <BarChartIcon className="w-4 h-4" />}
            {spec.kind === "line" && <LineChartIcon className="w-4 h-4" />}
            {spec.kind === "pie" && <PieChartIcon className="w-4 h-4" />}
            {spec.kind === "table" && <TableIcon className="w-4 h-4" />}
            <h3 className="text-sm font-semibold">{spec.title}</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onRemove} title="Remove">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {spec.kind === "bar" && (
          <div className="w-full h-64">
            <ResponsiveContainer>
              <BarChart
                data={summarizeByCategory(
                  rows,
                  spec.question || "Q1",
                  spec.by || "party"
                )}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avg" name="Avg Score" fill={COLORS[0]} />
                <Bar
                  dataKey="positiveShare"
                  name="% Positive"
                  fill={COLORS[2]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {spec.kind === "line" && (
          <div className="w-full h-64">
            <ResponsiveContainer>
              <LineChart data={timeSeries(rows, spec.question || "Q1")}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avg"
                  name="Avg Score"
                  stroke={COLORS[4]}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {spec.kind === "pie" && (
          <div className="w-full h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  dataKey="value"
                  nameKey="name"
                  data={pieBy(rows, spec.by || "party")}
                  outerRadius={96}
                  label
                >
                  {pieBy(rows, spec.by || "party").map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {spec.kind === "table" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-2">Group</th>
                  <th className="py-2 pr-2">Avg</th>
                  <th className="py-2 pr-2">% Positive</th>
                  <th className="py-2 pr-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {summarizeByCategory(
                  rows,
                  spec.question || "Q1",
                  spec.by || "region"
                ).map((r) => (
                  <tr key={r.name} className="border-b last:border-0">
                    <td className="py-1 pr-2">{r.name}</td>
                    <td className="py-1 pr-2">{r.avg}</td>
                    <td className="py-1 pr-2">{r.positiveShare}%</td>
                    <td className="py-1 pr-2">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --------------------------- Filters ---------------------------
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <div className="text-xs text-gray-600">{label}</div>
      <select
        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o, index) => (
          <option key={`${label}-${o}-${index}`} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

// Chat dock + window (client-side QA over currently filtered rows)
function ChatDock({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-4 flex justify-center pointer-events-none">
      <div className="pointer-events-auto">
        <div className="gradient-border rounded-2xl p-[2px]">
          <div className="bg-white rounded-2xl shadow-lg">
            <button
              className="flex items-center gap-2 px-4 py-3 text-left min-w-[680px] max-w-[90vw]"
              onClick={onOpen}
              aria-label="Open data chat"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-gray-600">
                Ask about your poll data or create charts… (e.g., &quot;Show a bar
                chart of Q1 by party&quot;, &quot;Pie chart of top issues&quot;)
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatWindow({
  open,
  onClose,
  rows,
  campaignId,
}: {
  open: boolean;
  onClose: () => void;
  rows: ViewRow[];
  campaignId: string;
}) {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<
    { role: "user" | "assistant"; content: string; chart?: ChartPayload }[]
  >([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
  }, [msgs, open]);

  async function callAskAPI(question: string) {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        let messageContent = result.answer || "No response";

        // Add the top 10% response data to the message
        if (result.responseData && result.responseData.length > 0) {
          messageContent += `\n\n**Top ${result.used} responses (${Math.round(
            (result.used / result.totalResponses) * 100
          )}% of total):**\n`;
          result.responseData.forEach((response: any, index: number) => {
            const answers = Object.entries(response.answers || {})
              .map(([key, value]) => `${key}: ${value}`)
              .join(", ");
            messageContent += `\n${index + 1}. **Response ${response.id
              }** (${new Date(
                response.created_at
              ).toLocaleDateString()})\n   ${answers}`;
          });
        }

        const newMessage: any = {
          role: "assistant",
          content: messageContent,
        };

        // If there's a graphic, create a chart payload
        if (result.graphic) {
          newMessage.chart = {
            title: "AI Generated Chart",
            description: "Chart based on poll data analysis",
            chart: result.graphic,
            assistantText:
              result.answer || "Here's your chart based on the poll data:",
          };
        }

        setMsgs((m) => [...m, newMessage]);
      } else {
        // Fallback to local answer if API fails
        const a = answerQuestion(rows, question);
        setMsgs((m) => [...m, { role: "assistant", content: a }]);
      }
    } catch (error) {
      console.error("Ask API error:", error);
      // Fallback to local answer if API fails
      const a = answerQuestion(rows, question);
      setMsgs((m) => [...m, { role: "assistant", content: a }]);
    }
  }

  async function onSend() {
    if (!input.trim() || isGenerating) return;
    const q = input.trim();
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setIsGenerating(true);

    try {
      // Check if the user is asking for a chart
      const isChartRequest = /chart|graph|plot|visualiz|show.*data/i.test(q);

      if (isChartRequest) {
        // Generate chart using the chat-charts API
        const pollData = rows.map((row) => ({
          id: row.id,
          date: row.date,
          age: row.age,
          gender: row.gender,
          party: row.party,
          region: row.region,
          ...row.answers,
        }));

        const res = await fetch("/api/chat-charts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: q }],
            data: pollData,
          }),
        });

        if (res.ok) {
          const chartPayload = (await res.json()) as ChartPayload;
          setMsgs((m) => [
            ...m,
            {
              role: "assistant",
              content:
                chartPayload.assistantText ||
                "Here's your chart based on the poll data:",
              chart: chartPayload,
            },
          ]);
        } else {
          // Fallback to ask API for text response
          await callAskAPI(q);
        }
      } else {
        // Regular text response using ask API
        await callAskAPI(q);
      }
    } catch (error) {
      console.error("Chat error:", error);
      // Fallback to local answer if API fails
      const a = answerQuestion(rows, q);
      setMsgs((m) => [...m, { role: "assistant", content: a }]);
    } finally {
      setIsGenerating(false);
    }
  }
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-white z-50 flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <span className="font-medium">Polls Copilot</span>
              <Badge variant="secondary">Demo</Badge>
            </div>
            <Button variant="ghost" onClick={onClose}>
              <XIcon className="w-5 h-5" />
            </Button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-4">
            <div className="max-w-4xl mx-auto space-y-3">
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"
                    }`}
                >
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm max-w-full ${m.role === "user"
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-gray-50 border border-gray-200"
                      }`}
                  >
                    <div>{m.content}</div>
                    {m.chart && (
                      <div className="mt-3 p-4 bg-white rounded-lg border">
                        <div className="mb-2">
                          <div className="font-semibold text-gray-900">
                            {m.chart.title}
                          </div>
                          <div className="text-xs text-gray-600">
                            {m.chart.description}
                          </div>
                        </div>
                        <div className="w-full h-64">
                          <ChartRenderer payload={m.chart} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
                      Generating chart...
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="border-t px-4 py-3">
            <div className="max-w-3xl mx-auto flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question or request a chart about your poll data…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isGenerating) onSend();
                }}
                disabled={isGenerating}
              />
              <Button onClick={onSend} disabled={isGenerating}>
                <Send className="w-4 h-4 mr-1" />
                {isGenerating ? "Generating..." : "Send"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --------------------------- Page ---------------------------
export default function CampaignAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{ total: number } | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [campaign, setCampaign] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<"overview" | "responses">(
    "overview"
  );

  // NEW: local UI state (filters, specs, chat)
  const [days, setDays] = useState<number>(60);
  const [age, setAge] = useState<string>("All");
  const [gender, setGender] = useState<string>("All");
  const [party, setParty] = useState<string>("All");
  const [region, setRegion] = useState<string>("All");
  const [command, setCommand] = useState("");
  const [specs, setSpecs] = useState<ChartSpec[]>([
    {
      id: makeId(),
      kind: "bar",
      question: "Q1",
      by: "party",
      title: "Approval (Q1) by party",
    },
    {
      id: makeId(),
      kind: "line",
      question: "Q1",
      title: "Approval trend (Q1) over time",
    },
    { id: makeId(), kind: "pie", by: "answers.Q3", title: "Top Issues share" },
  ]);
  const [chatOpen, setChatOpen] = useState(false);

  // Analyzer-driven Chart.js (proxy to /api/campaigns/[id]/analyze → /api/chat-charts)
  const [useAnalyzer, setUseAnalyzer] = useState<boolean>(true);
  const [analyzerLimit, setAnalyzerLimit] = useState<string>("");
  const [analyzerUrl, setAnalyzerUrl] = useState<string>("");
  const [analyzerPrompt, setAnalyzerPrompt] = useState<string>(
    "Create a clear chart from the analyzer output. Pick a suitable chart type and explain briefly."
  );
  const [analyzerChartType, setAnalyzerChartType] = useState<
    "bar" | "line" | "pie" | "doughnut" | "radar" | "polarArea" | ""
  >("bar");
  const [analyzerLoading, setAnalyzerLoading] = useState<boolean>(false);
  const [analyzerError, setAnalyzerError] = useState<string | null>(null);
  const [analyzerChart, setAnalyzerChart] = useState<ChartPayload | null>(null);
  type AnalyzerResponse = { items?: AnalyzerItem[] } | null;
  const [analyzerRaw, setAnalyzerRaw] = useState<AnalyzerResponse>(null);
  const [projection, setProjection] = useState<"umap" | "pca" | "tsne">(
    "umap"
  );

  type AnalyzerItem = {
    id: string;
    question: string;
    answer: string;
    pred_label?: string;
    ideology_score?: number;
    projections?: {
      pca?: [number, number];
      tsne?: [number, number];
      umap?: [number, number];
    };
  };

  const labelColors = useMemo<Record<string, string>>(
    () => ({ left: "#2563eb", center: "#10b981", right: "#ef4444" }),
    []
  );

  const projectionChart = useMemo((): {
    data: ChartData<"scatter", { x: number; y: number }[], unknown>;
    options: ChartOptions<"scatter">;
  } | null => {
    const items: AnalyzerItem[] = (analyzerRaw?.items as AnalyzerItem[]) || [];
    if (!Array.isArray(items) || items.length === 0) return null;
    const grouped: Record<string, { x: number; y: number; _meta: AnalyzerItem }[]> = {};
    for (const it of items) {
      const coords = it?.projections?.[projection];
      if (!coords || coords.length !== 2) continue;
      const key = (it.pred_label || "unknown").toLowerCase();
      (grouped[key] ||= []).push({ x: coords[0], y: coords[1], _meta: it });
    }
    const datasets = Object.keys(grouped).map((label) => ({
      label,
      data: grouped[label].map((p) => ({ x: p.x, y: p.y })),
      backgroundColor: labelColors[label] || "#6b7280",
      pointRadius: 3,
    }));
    const axisTitle = projection.toUpperCase();
    return {
      data: { datasets } as ChartData<"scatter", { x: number; y: number }[], unknown>,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx: TooltipItem<"scatter">) => {
                const d = ctx.raw as unknown as { x: number; y: number };
                const dsIndex = ctx.datasetIndex;
                const pointIndex = ctx.dataIndex;
                const label = String(datasets[dsIndex]?.label ?? "");
                const metaItem = grouped[label]?.[pointIndex]?._meta as AnalyzerItem | undefined;
                const q = metaItem?.question || "";
                const ans = metaItem?.answer || "";
                const ideol = metaItem?.ideology_score;
                const prefix = `${label}: (${d.x.toFixed(2)}, ${d.y.toFixed(2)})`;
                const extra = ideol !== undefined ? `, ideology: ${ideol}` : "";
                return `${prefix}${extra}\n${q} — ${ans}`;
              },
            },
          },
          legend: { position: "top" as const },
        },
        scales: {
          x: { title: { display: true, text: `${axisTitle} — 1` } },
          y: { title: { display: true, text: `${axisTitle} — 2` } },
        },
      } as ChartOptions<"scatter">,
    };
  }, [analyzerRaw, projection, labelColors]);

  async function onGenerateAnalyzerChart() {
    if (!campaignId) return;
    try {
      setAnalyzerLoading(true);
      setAnalyzerError(null);
      setAnalyzerChart(null);
      setAnalyzerRaw(null);

      const analyzeRes = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analyzerUrl: analyzerUrl || undefined,
          limitResponses: analyzerLimit ? Number(analyzerLimit) : undefined,
        }),
      });
      if (!analyzeRes.ok) {
        const err = await analyzeRes.json().catch(() => ({}));
        throw new Error(err?.error || "Analyzer request failed");
      }
      const analyzeJson: unknown = await analyzeRes.json();
      const analyzerData = (analyzeJson as { analyzer?: AnalyzerResponse })?.analyzer ?? null;
      if (!analyzerData) throw new Error("Analyzer returned no data");
      setAnalyzerRaw(analyzerData);

      const chartRes = await fetch("/api/chat-charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: analyzerPrompt }],
          chartType: analyzerChartType || undefined,
          data: analyzerData,
        }),
      });
      if (!chartRes.ok) {
        const err = await chartRes.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to generate chart");
      }
      const payload = (await chartRes.json()) as ChartPayload;
      setAnalyzerChart(payload);
    } catch (e: any) {
      setAnalyzerError(e?.message || String(e));
    } finally {
      setAnalyzerLoading(false);
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [mRes, rRes, cRes] = await Promise.all([
          fetch(`/api/campaigns/${campaignId}/metrics`, { cache: "no-store" }),
          fetch(`/api/campaigns/${campaignId}/responses`, {
            cache: "no-store",
          }),
          fetch(`/api/campaigns/${campaignId}`, { cache: "no-store" }),
        ]);
        if (!mRes.ok) {
          const data = await mRes.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to load metrics");
        }
        if (!rRes.ok) {
          const data = await rRes.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to load responses");
        }
        if (!cRes.ok) {
          const data = await cRes.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to load campaign");
        }
        const m = await mRes.json();
        const r = await rRes.json();
        const c = await cRes.json();
        setMetrics(m);
        setResponses(Array.isArray(r) ? r : []);
        setCampaign(c);
      } catch (e) {
        console.error(e);
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    if (campaignId) load();
  }, [campaignId]);

  // Derived data
  const viewRowsAll = useMemo(() => transformResponses(responses), [responses]);

  const options = useMemo(() => {
    const ages = new Set<string>();
    const genders = new Set<string>();
    const parties = new Set<string>();
    const regions = new Set<string>();
    viewRowsAll.forEach((r) => {
      if (r.age) ages.add(r.age);
      if (r.gender) genders.add(r.gender);
      if (r.party) parties.add(r.party);
      if (r.region) regions.add(r.region);
    });
    const sortAlpha = (a: string, b: string) => a.localeCompare(b);
    return {
      ages: ["All", ...Array.from(ages).sort(sortAlpha)],
      genders: ["All", ...Array.from(genders).sort(sortAlpha)],
      parties: ["All", ...Array.from(parties).sort(sortAlpha)],
      regions: ["All", ...Array.from(regions).sort(sortAlpha)],
    };
  }, [viewRowsAll]);

  const filteredRows = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return viewRowsAll.filter((r) => {
      const okDate = new Date(r.date) >= cutoff;
      const okAge = age === "All" || r.age === age;
      const okGender = gender === "All" || r.gender === gender;
      const okParty = party === "All" || r.party === party;
      const okRegion = region === "All" || r.region === region;
      return okDate && okAge && okGender && okParty && okRegion;
    });
  }, [viewRowsAll, days, age, gender, party, region]);

  const kpis = useMemo(() => kpi(filteredRows), [filteredRows]);

  const runCommand = () => {
    const out = llmInterpret(command);
    if (typeof out === "string") {
      if (out === "__REMOVE_LAST__") setSpecs((s) => s.slice(0, -1));
      setCommand("");
      return;
    }
    setSpecs((s) => [...out, ...s]);
    setCommand("");
  };

  // Original "Responses per day" (for backward-compat maxCount)
  const groupedByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of responses) {
      const d = new Date(row.created_at);
      const key = d.toISOString().slice(0, 10);
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, count]) => ({ date, count }));
  }, [responses]);

  const maxCount = useMemo(
    () => groupedByDay.reduce((m, x) => Math.max(m, x.count), 0) || 1,
    [groupedByDay]
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <SignedOut>
          <RedirectToSignIn
            redirectUrl={`/campaigns/${campaignId}/analytics`}
          />
        </SignedOut>
        <SignedIn>
          {loading ? (
            <Card>
              <CardHeader>
                <CardTitle>Loading analytics…</CardTitle>
                <CardDescription>Please wait</CardDescription>
              </CardHeader>
            </Card>
          ) : error ? (
            <Card>
              <CardHeader>
                <CardTitle>Error</CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              {/* Tabs */}
              <div className="mb-6 flex items-center gap-3">
                <Button
                  variant={activeTab === "overview" ? "default" : "outline"}
                  onClick={() => setActiveTab("overview")}
                >
                  Overview
                </Button>
                <Button
                  variant={activeTab === "responses" ? "default" : "outline"}
                  onClick={() => setActiveTab("responses")}
                >
                  Responses
                </Button>
              </div>

              {/* OVERVIEW: new advanced dashboard UI */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Static (non-rotating) gradient border style for chat dock */}
                  <style>{`.gradient-border { background: conic-gradient(from 0deg, #fde68a, #bfdbfe, #d9f99d, #fbcfe8, #fde68a); }`}</style>

                  {/* Header bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <LayoutDashboard className="w-6 h-6" />
                      <h1 className="text-2xl font-bold tracking-tight">
                        Campaign Dashboard
                      </h1>
                      <Badge variant="secondary">Live</Badge>
                    </div>
                    <div className="hidden md:flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" /> {kpis.n.toLocaleString()}{" "}
                        in view
                      </div>
                      <div className="flex items-center gap-1">
                        <MapIcon className="w-4 h-4" /> Regions
                      </div>
                    </div>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="rounded-2xl border border-gray-200">
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500">
                          Total in view
                        </div>
                        <div className="text-2xl font-semibold">
                          {kpis.n.toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl border border-gray-200">
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500">
                          Approve (Q1) ≥ 4
                        </div>
                        <div className="text-2xl font-semibold text-blue-700">
                          {kpis.approve}%
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl border border-gray-200">
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500">
                          Likely to Vote (Q2) ≥ 4
                        </div>
                        <div className="text-2xl font-semibold text-emerald-700">
                          {kpis.likely}%
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl border border-gray-200">
                      <CardContent className="p-4">
                        <div className="text-xs text-gray-500">Top Issue</div>
                        <div className="text-2xl font-semibold text-fuchsia-700">
                          {kpis.topIssue}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Controls */}
                  <Card className="rounded-2xl border border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-end gap-4">
                        <div className="flex-1">
                          <label className="text-xs text-gray-600">
                            Create with natural language
                          </label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              value={command}
                              onChange={(e) => setCommand(e.target.value)}
                              placeholder='e.g. "bar chart Q1 by party"; "line chart Q2 over time"; "remove last"'
                            />
                            <Button onClick={runCommand}>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Add
                            </Button>
                          </div>
                        </div>
                        <Separator
                          orientation="vertical"
                          className="hidden md:block h-10"
                        />
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 w-full md:w-auto">
                          <Select
                            label="Days"
                            value={String(days)}
                            onChange={(v) => setDays(Number(v))}
                            options={["7", "14", "30", "60"]}
                          />
                          <Select
                            label="Age"
                            value={age}
                            onChange={setAge}
                            options={options.ages}
                          />
                          <Select
                            label="Gender"
                            value={gender}
                            onChange={setGender}
                            options={options.genders}
                          />
                          <Select
                            label="Party"
                            value={party}
                            onChange={setParty}
                            options={options.parties}
                          />
                          <Select
                            label="Region"
                            value={region}
                            onChange={setRegion}
                            options={options.regions}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Analyzer → Chart.js generator */}
                  <Card className="rounded-2xl border border-gray-200">
                    <CardContent className="p-4">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={useAnalyzer}
                            onChange={(e) => setUseAnalyzer(e.target.checked)}
                            style={{ width: 18, height: 18 }}
                          />
                          <div style={{ fontSize: 14, color: "#4b5563" }}>
                            Use external analyzer to transform Supabase responses, then generate a chart
                          </div>
                        </div>
                        {useAnalyzer && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Limit responses (optional)</div>
                              <Input
                                value={analyzerLimit}
                                onChange={(e) => setAnalyzerLimit(e.target.value.replace(/[^0-9]/g, ""))}
                                placeholder="e.g., 200"
                              />
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Projection</div>
                              <select
                                className="w-full border rounded-xl px-3 py-2 text-sm"
                                value={projection}
                                onChange={(e) => setProjection(e.target.value as any)}
                              >
                                <option value="umap">UMAP</option>
                                <option value="pca">PCA</option>
                                <option value="tsne">t-SNE</option>
                              </select>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Chart type (hint)</div>
                              <select
                                className="w-full border rounded-xl px-3 py-2 text-sm"
                                value={analyzerChartType}
                                onChange={(e) => setAnalyzerChartType((e.target.value as any) || "")}
                              >
                                <option value="bar">bar</option>
                                <option value="line">line</option>
                                <option value="pie">pie</option>
                                <option value="doughnut">doughnut</option>
                                <option value="radar">radar</option>
                                <option value="polarArea">polarArea</option>
                              </select>
                            </div>
                            <div style={{ gridColumn: "1 / span 2" }}>
                              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Analyzer URL (optional)</div>
                              <Input
                                value={analyzerUrl}
                                onChange={(e) => setAnalyzerUrl(e.target.value)}
                                placeholder="default: https://7b5e40bf3b2a.ngrok-free.app/analyze"
                              />
                            </div>
                            <div style={{ gridColumn: "1 / span 2" }}>
                              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Prompt to chart generator</div>
                              <Input
                                value={analyzerPrompt}
                                onChange={(e) => setAnalyzerPrompt(e.target.value)}
                                placeholder="Describe the chart you want from the analyzer output"
                              />
                            </div>
                            <div style={{ gridColumn: "1 / span 2", display: "flex", alignItems: "center", gap: 12 }}>
                              <Button onClick={onGenerateAnalyzerChart} disabled={analyzerLoading}>
                                {analyzerLoading ? "Generating…" : "Generate Analyzer Chart"}
                              </Button>
                              {analyzerError && (
                                <div style={{ fontSize: 13, color: "#ef4444" }}>{analyzerError}</div>
                              )}
                            </div>
                          </div>
                        )}
                        {analyzerChart && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ fontWeight: 600 }}>{analyzerChart.title}</div>
                              <div style={{ color: "#6b7280", fontSize: 13 }}>
                                {analyzerChart.description}
                              </div>
                            </div>
                            <div style={{ width: "100%", height: 420 }}>
                              <ChartRenderer payload={analyzerChart} />
                            </div>
                            {analyzerChart.assistantText && (
                              <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>
                                {analyzerChart.assistantText}
                              </div>
                            )}
                          </div>
                        )}
                        {projectionChart && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                              Projection scatter ({projection.toUpperCase()})
                            </div>
                            <div style={{ width: "100%", height: 420 }}>
                              <ChartScatter data={projectionChart.data as any} options={projectionChart.options as any} />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dynamic Grid of charts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <AnimatePresence>
                      {specs.map((spec) => (
                        <motion.div
                          key={spec.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                        >
                          <ChartCard
                            spec={spec}
                            rows={filteredRows}
                            onRemove={() =>
                              setSpecs((s) => s.filter((x) => x.id !== spec.id))
                            }
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Help */}
                  <Card className="rounded-2xl border border-gray-200">
                    <CardContent className="p-4 text-sm text-gray-600">
                      <div className="font-medium mb-1">
                        Try these commands:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "bar chart Q1 by party",
                          "bar chart Q1 by age",
                          "line chart Q2 over time",
                          "pie chart by gender for Q3",
                          "table of responses for Q1 by region",
                          "remove last",
                        ].map((c) => (
                          <Badge
                            key={c}
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => setCommand(c)}
                          >
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* (Optional) Original tiny "Responses per day" for continuity */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Responses per day</CardTitle>
                      <CardDescription>
                        Last {groupedByDay.length} days
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {groupedByDay.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No data yet
                        </div>
                      ) : (
                        <div className="flex items-end gap-2 h-40">
                          {groupedByDay.map((b) => (
                            <div
                              key={b.date}
                              className="flex flex-col items-center gap-1"
                            >
                              <div
                                className="w-8 bg-primary/70 rounded"
                                style={{
                                  height: `${Math.max(
                                    8,
                                    (b.count / maxCount) * 100
                                  )}%`,
                                }}
                                title={`${b.date}: ${b.count}`}
                              />
                              <div className="text-[10px] text-muted-foreground">
                                {b.date.slice(5)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* RESPONSES: paginated view with sidebar */}
              {activeTab === "responses" && (
                <ResponsesView responses={responses} campaign={campaign} />
              )}

              {/* Debug: Show first 10 responses */}
              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">
                  First 10 Responses (Debug)
                </h3>
                <div className="max-h-96 overflow-y-auto">
                  <pre className="text-xs bg-white p-3 rounded border">
                    {JSON.stringify(responses.slice(0, 10), null, 2)}
                  </pre>
                </div>
              </div>

              {/* Bottom chat dock + window available on all tabs (client-side QA over filtered rows) */}
              <ChatDock onOpen={() => setChatOpen(true)} />
              <ChatWindow
                open={chatOpen}
                onClose={() => setChatOpen(false)}
                rows={filteredRows}
                campaignId={campaignId}
              />
            </>
          )}
        </SignedIn>
      </main>
    </>
  );
}
