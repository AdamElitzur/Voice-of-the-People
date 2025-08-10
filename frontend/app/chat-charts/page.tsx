"use client";

import React, { useCallback, useMemo, useRef, useState } from 'react';
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

type ChartPayload = {
    title: string;
    description: string;
    chart: {
        type:
        | 'bar'
        | 'line'
        | 'pie'
        | 'doughnut'
        | 'radar'
        | 'polarArea'
        | 'scatter'
        | 'bubble';
        data: any;
        options?: any;
    };
    assistantText?: string;
};

function ChartRenderer({ payload }: { payload: ChartPayload | null }) {
    if (!payload) return null;
    const { chart } = payload;
    const commonProps = { data: chart.data, options: chart.options } as any;

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
    const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter' | 'bubble' | ''>('bar');
    const [payload, setPayload] = useState<ChartPayload | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            const res = await fetch('/api/chat-charts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: input }],
                    chartType: chartType || undefined,
                    data: JSON.parse(dataJson || 'null'),
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || 'Request failed');
            }
            const json = (await res.json()) as ChartPayload;
            setPayload(json);
        } catch (e: any) {
            setError(e?.message || String(e));
        } finally {
            setIsLoading(false);
        }
    }, [input, chartType, dataJson]);

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
                    <div style={rowStyle}>
                        <div>
                            <label style={labelStyle}>Data JSON</label>
                            <textarea
                                style={{ ...inputStyle, minHeight: 160, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}
                                value={dataJson}
                                onChange={(e) => setDataJson(e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Preferred Chart Type</label>
                            <select
                                style={selectStyle}
                                value={chartType}
                                onChange={(e) => setChartType((e.target.value as any) || '')}
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


