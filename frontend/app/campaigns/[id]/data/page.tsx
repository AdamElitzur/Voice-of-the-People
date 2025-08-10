"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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

export default function CampaignDataPage() {
    const params = useParams<{ id: string }>();
    const campaignId = (params?.id as string) || '';

    const [responses, setResponses] = useState<any[] | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [prompt, setPrompt] = useState<string>('Show responses per day as a line chart');
    const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter' | 'bubble' | ''>('line');
    const [payload, setPayload] = useState<ChartPayload | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setLoadError(null);
                if (!campaignId) return;
                const res = await fetch(`/api/campaigns/${campaignId}/responses`);
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error || 'Failed to fetch responses');
                }
                const data = await res.json();
                setResponses(Array.isArray(data) ? data : []);
            } catch (e: any) {
                setLoadError(e?.message || String(e));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [campaignId]);

    const onGenerate = useCallback(async () => {
        try {
            setIsSubmitting(true);
            setSubmitError(null);
            const res = await fetch('/api/chat-charts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    chartType: chartType || undefined,
                    data: { campaignId, responses },
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || 'Request failed');
            }
            const json = (await res.json()) as ChartPayload;
            setPayload(json);
        } catch (e: any) {
            setSubmitError(e?.message || String(e));
        } finally {
            setIsSubmitting(false);
        }
    }, [prompt, chartType, campaignId, responses]);

    const pageStyle: React.CSSProperties = { padding: 20 };
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
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, marginBottom: 6, color: '#cbd5e1' };
    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '12px 14px',
        background: '#111827',
        color: '#f1f5f9',
        border: '1px solid #374151',
        borderRadius: 10,
        outline: 'none',
    };
    const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, marginTop: 12 };
    const selectStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', background: '#111827', color: '#f1f5f9', border: '1px solid #374151', borderRadius: 10 };
    const buttonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', marginTop: 12, fontWeight: 600 };
    const chartContainerStyle: React.CSSProperties = { width: '100%', height: 420 };

    return (
        <div style={pageStyle}>
            <div style={cardStyle}>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Campaign Data & Charts</h2>
                <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
                    Use OpenAI to chat with this campaign's responses and render Chart.js visualizations.
                </p>

                {loading ? (
                    <div style={{ fontSize: 14, color: '#9ca3af' }}>Loading responses…</div>
                ) : loadError ? (
                    <div style={{ fontSize: 14, color: '#fca5a5' }}>{loadError}</div>
                ) : (
                    <>
                        <div>
                            <label style={labelStyle}>Prompt</label>
                            <input
                                style={inputStyle}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g., Show top 5 options chosen for Question 2 as a bar chart"
                            />
                        </div>

                        <div style={rowStyle}>
                            <div>
                                <label style={labelStyle}>Dataset (read-only preview)</label>
                                <textarea
                                    style={{ ...inputStyle, minHeight: 160, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}
                                    value={JSON.stringify({ campaignId, total: responses?.length || 0, sample: (responses || []).slice(0, 3) }, null, 2)}
                                    readOnly
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Preferred Chart Type</label>
                                <select style={selectStyle} value={chartType} onChange={(e) => setChartType((e.target.value as any) || '')}>
                                    <option value="line">line</option>
                                    <option value="bar">bar</option>
                                    <option value="pie">pie</option>
                                    <option value="doughnut">doughnut</option>
                                    <option value="radar">radar</option>
                                    <option value="polarArea">polarArea</option>
                                    <option value="scatter">scatter</option>
                                    <option value="bubble">bubble</option>
                                </select>
                                <button style={buttonStyle} onClick={onGenerate} disabled={isSubmitting || !responses}>
                                    {isSubmitting ? 'Generating…' : 'Generate Chart'}
                                </button>
                                {submitError && (
                                    <div style={{ marginTop: 8, color: '#fca5a5', fontSize: 13 }}>{submitError}</div>
                                )}
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
                    </>
                )}
            </div>
        </div>
    );
}


