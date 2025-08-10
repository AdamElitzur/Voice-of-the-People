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

    const [prompt, setPrompt] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; chart?: ChartPayload['chart'] | null };
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: `m_${Math.random().toString(36).slice(2, 9)}`,
            role: 'assistant',
            content:
                "Hi! Ask me to explore and visualize this campaign's responses. For example: 'Show responses per day', or 'Which multiple-choice option was most popular?'",
            chart: null,
        },
    ]);

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
            const nextUser: ChatMessage = {
                id: `m_${Math.random().toString(36).slice(2, 9)}`,
                role: 'user',
                content: prompt.trim(),
                chart: null,
            };
            setMessages((prev) => [...prev, nextUser]);

            const res = await fetch('/api/chat-charts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        ...messages.map((m) => ({ role: m.role, content: m.content })),
                        { role: 'user', content: prompt },
                    ],
                    data: { campaignId, responses },
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || 'Request failed');
            }
            const json = (await res.json()) as ChartPayload;
            const assistantMsg: ChatMessage = {
                id: `m_${Math.random().toString(36).slice(2, 9)}`,
                role: 'assistant',
                content: json.assistantText || json.description || 'Here is the chart.',
                chart: json.chart,
            };
            setMessages((prev) => [...prev, assistantMsg]);
        } catch (e: any) {
            setSubmitError(e?.message || String(e));
        } finally {
            setIsSubmitting(false);
        }
    }, [prompt, campaignId, responses, messages]);

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
    const chatWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 540, overflowY: 'auto', padding: 8, background: '#0b0f1a', border: '1px solid #1f2937', borderRadius: 10 };
    const bubbleUser: React.CSSProperties = { alignSelf: 'flex-end', maxWidth: '75%', background: '#1d4ed8', color: 'white', padding: '10px 12px', borderRadius: 12 };
    const bubbleAssistant: React.CSSProperties = { alignSelf: 'flex-start', maxWidth: '75%', background: '#111827', color: '#e5e7eb', padding: '10px 12px', borderRadius: 12 };

    return (
        <div style={pageStyle}>
            <div style={cardStyle}>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Campaign Chat</h2>
                <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>Ask questions about this campaign and I will answer and visualize with Chart.js when helpful.</p>

                {loading ? (
                    <div style={{ fontSize: 14, color: '#9ca3af' }}>Loading responses…</div>
                ) : loadError ? (
                    <div style={{ fontSize: 14, color: '#fca5a5' }}>{loadError}</div>
                ) : (
                    <>
                        <div style={chatWrap}>
                            {messages.map((m) => (
                                <div key={m.id} style={m.role === 'user' ? bubbleUser : bubbleAssistant}>
                                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.3 }}>{m.content}</div>
                                    {m.chart && (
                                        <div style={{ marginTop: 10 }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Chart</div>
                                            <div style={chartContainerStyle}>
                                                <ChartRenderer payload={{ title: '', description: '', chart: m.chart }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: 12 }}>
                            <label style={labelStyle}>Your message</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
                                <input
                                    style={inputStyle}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Ask a question or request a chart"
                                />
                                <button style={buttonStyle} onClick={onGenerate} disabled={isSubmitting || !responses}>
                                    {isSubmitting ? 'Sending…' : 'Send'}
                                </button>
                            </div>
                            {submitError && (
                                <div style={{ marginTop: 8, color: '#fca5a5', fontSize: 13 }}>{submitError}</div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}


