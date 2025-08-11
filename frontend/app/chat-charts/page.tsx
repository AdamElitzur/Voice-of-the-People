"use client";

import React, { useCallback, useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Tooltip,
    Legend,
    RadialLinearScale,
    Filler,
    TimeScale,
    TimeSeriesScale,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut, Radar, PolarArea, Scatter, Bubble } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Tooltip,
    Legend,
    RadialLinearScale,
    Filler,
    TimeScale,
    TimeSeriesScale,
);

type ChartTypeUnion =
    | 'bar'
    | 'line'
    | 'pie'
    | 'doughnut'
    | 'radar'
    | 'polarArea'
    | 'scatter'
    | 'bubble';

type GenericDataset = {
    label: string;
    data: number[];
    [key: string]: unknown;
};

type GenericChartData = {
    labels: Array<string | number>;
    datasets: GenericDataset[];
};

type GenericChartOptions = Record<string, unknown> | undefined;

type ChartPayload = {
    title: string;
    description: string;
    chart: {
        type: ChartTypeUnion;
        data: GenericChartData;
        options?: GenericChartOptions;
    };
    assistantText?: string;
};

function ChartRenderer({ payload }: { payload: ChartPayload | null }) {
    if (!payload) return null;
    const { chart } = payload;
    const commonProps: { data: GenericChartData; options?: GenericChartOptions } = {
        data: chart.data,
        options: chart.options,
    };

    switch (chart.type) {
        case 'bar':
            return <Bar {...commonProps} />;
        case 'line':
            return <Line {...commonProps} />;
        case 'pie':
            return <Pie {...commonProps} />;
        case 'doughnut':
            return <Doughnut {...commonProps} />;
        case 'radar':
            return <Radar {...commonProps} />;
        case 'polarArea':
            return <PolarArea {...commonProps} />;
        case 'scatter':
            return <Scatter {...commonProps} />;
        case 'bubble':
            return <Bubble {...commonProps} />;
        default:
            return null;
    }
}

export default function ChatChartsPage() {
    const [input, setInput] = useState('Show a bar chart of monthly revenue for 2024');
    const [chartType, setChartType] = useState<ChartTypeUnion | ''>('bar');
    const [payload, setPayload] = useState<ChartPayload | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [useCampaignAnalyzer, setUseCampaignAnalyzer] = useState<boolean>(false);
    const [campaignId, setCampaignId] = useState<string>('');
    const [limitResponses, setLimitResponses] = useState<string>('');
    const [analyzerUrl, setAnalyzerUrl] = useState<string>('');

    // Example data users can tweak; in real use pass any JSON
    const [dataJson, setDataJson] = useState(
        JSON.stringify(
            {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                series: [12000, 15000, 9000, 18000, 22000, 20000, 25000],
            },
            null,
            2,
        ),
    );

    const onSubmit = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // If using Supabase -> Analyzer pipeline, fetch analyzer result first
            let dataForChart: unknown = null;
            if (useCampaignAnalyzer) {
                if (!campaignId) {
                    throw new Error('Campaign ID is required when using analyzer');
                }
                const aRes = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/analyze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        analyzerUrl: analyzerUrl || undefined,
                        limitResponses: limitResponses ? Number(limitResponses) : undefined,
                    }),
                });
                if (!aRes.ok) {
                    const err = await aRes.json().catch(() => ({}));
                    throw new Error(err?.error || 'Analyzer request failed');
                }
                const aJson = await aRes.json();
                dataForChart = aJson?.analyzer ?? null;
                if (!dataForChart) {
                    throw new Error('Analyzer returned no data');
                }
            }

            const res = await fetch('/api/chat-charts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: input }],
                    chartType: chartType || undefined,
                    data: useCampaignAnalyzer ? dataForChart : (JSON.parse(dataJson || 'null') as unknown),
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || 'Request failed');
            }
            const json = (await res.json()) as ChartPayload;
            setPayload(json);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setIsLoading(false);
        }
    }, [input, chartType, dataJson, useCampaignAnalyzer, campaignId, limitResponses, analyzerUrl]);

    const cardStyle: React.CSSProperties = {
        width: '100%',
        maxWidth: 1100,
        margin: '30px auto',
        background: '#0b0c10',
        color: '#e5e7eb',
        border: '1px solid #1f2937',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: 14,
        marginBottom: 6,
        color: '#cbd5e1',
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '12px 14px',
        background: '#111827',
        color: '#f1f5f9',
        border: '1px solid #374151',
        borderRadius: 10,
        outline: 'none',
    };

    const rowStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: '1fr 220px',
        gap: 12,
        marginTop: 12,
    };

    const selectStyle: React.CSSProperties = {
        width: '100%',
        padding: '12px 14px',
        background: '#111827',
        color: '#f1f5f9',
        border: '1px solid #374151',
        borderRadius: 10,
    };

    const buttonStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 16px',
        background: '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: 10,
        cursor: 'pointer',
        marginTop: 12,
        fontWeight: 600,
    };

    const gridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 16,
    };

    const chartContainerStyle: React.CSSProperties = {
        width: '100%',
        height: 420,
    };

    return (
        <div style={{ padding: 20 }}>
            <div style={cardStyle}>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Chat → Chart (Chart.js)</h2>
                <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
                    Ask for a visualization. The API uses OpenAI Tools to return a Chart.js config. Charts are rendered with react-chartjs-2.
                </p>
                <div style={gridStyle}>
                    <div>
                        <label style={labelStyle}>Prompt</label>
                        <input
                            style={inputStyle}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="e.g., Compare signups by source in a doughnut"
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Use Supabase Analyzer</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input
                                type="checkbox"
                                checked={useCampaignAnalyzer}
                                onChange={(e) => setUseCampaignAnalyzer(e.target.checked)}
                                style={{ width: 18, height: 18 }}
                            />
                            <span style={{ fontSize: 13, color: '#9ca3af' }}>Pull campaign responses → format → send to analyzer, then chart that output</span>
                        </div>
                        {useCampaignAnalyzer && (
                            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={labelStyle}>Campaign ID</label>
                                    <input
                                        style={inputStyle}
                                        value={campaignId}
                                        onChange={(e) => setCampaignId(e.target.value)}
                                        placeholder="e.g., 123"
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Limit Responses (optional)</label>
                                    <input
                                        style={inputStyle}
                                        value={limitResponses}
                                        onChange={(e) => setLimitResponses(e.target.value.replace(/[^0-9]/g, ''))}
                                        placeholder="e.g., 200"
                                    />
                                </div>
                                <div style={{ gridColumn: '1 / span 2' }}>
                                    <label style={labelStyle}>Analyzer URL (optional)</label>
                                    <input
                                        style={inputStyle}
                                        value={analyzerUrl}
                                        onChange={(e) => setAnalyzerUrl(e.target.value)}
                                        placeholder="default: http://127.0.0.1:8000/analyze"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <div style={rowStyle}>
                        <div>
                            <label style={labelStyle}>Data JSON</label>
                            <textarea
                                style={{ ...inputStyle, minHeight: 160, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}
                                value={dataJson}
                                onChange={(e) => setDataJson(e.target.value)}
                                disabled={useCampaignAnalyzer}
                            />
                            {useCampaignAnalyzer && (
                                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
                                    Data JSON is disabled because analyzer output will be used as the dataset.
                                </div>
                            )}
                        </div>
                        <div>
                            <label style={labelStyle}>Preferred Chart Type</label>
                            <select
                                style={selectStyle}
                                value={chartType}
                                onChange={(e) => setChartType((e.target.value as ChartTypeUnion) || '')}
                            >
                                <option value="bar">bar</option>
                                <option value="line">line</option>
                                <option value="pie">pie</option>
                                <option value="doughnut">doughnut</option>
                                <option value="radar">radar</option>
                                <option value="polarArea">polarArea</option>
                                <option value="scatter">scatter</option>
                                <option value="bubble">bubble</option>
                            </select>
                            <button style={buttonStyle} onClick={onSubmit} disabled={isLoading}>
                                {isLoading ? 'Generating…' : 'Generate Chart'}
                            </button>
                            {error && (
                                <div style={{ marginTop: 8, color: '#fca5a5', fontSize: 13 }}>{error}</div>
                            )}
                        </div>
                    </div>
                </div>

                {payload && (
                    <div style={{ marginTop: 16 }}>
                        <div style={{ marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{payload.title}</div>
                            <div style={{ color: '#9ca3af', fontSize: 13 }}>{payload.description}</div>
                        </div>
                        <div style={chartContainerStyle}>
                            <ChartRenderer payload={payload} />
                        </div>
                        {payload.assistantText && (
                            <div style={{ marginTop: 10, fontSize: 13, color: '#9ca3af' }}>{payload.assistantText}</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}


