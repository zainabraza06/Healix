'use client';

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    Legend,
} from 'recharts';

interface ChartData {
    [key: string]: string | number;
}

interface AreaChartWrapperProps {
    data: ChartData[];
    areas: { dataKey: string; stroke: string; gradientId: string }[];
}

export function AreaChartWrapper({ data, areas }: AreaChartWrapperProps) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <defs>
                    {areas.map((area) => (
                        <linearGradient key={area.gradientId} id={area.gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={area.stroke} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={area.stroke} stopOpacity={0} />
                        </linearGradient>
                    ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                    contentStyle={{
                        background: 'rgba(255,255,255,0.9)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    }}
                />
                {areas.map((area) => (
                    <Area
                        key={area.dataKey}
                        type="monotone"
                        dataKey={area.dataKey}
                        stroke={area.stroke}
                        fill={`url(#${area.gradientId})`}
                        strokeWidth={2}
                    />
                ))}
            </AreaChart>
        </ResponsiveContainer>
    );
}

interface PieChartWrapperProps {
    data: { name: string; value: number; color: string }[];
}

export function PieChartWrapper({ data }: PieChartWrapperProps) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="70%"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip />
                <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value, entry: any) => <span style={{ color: entry.color }}>{value}</span>}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}

interface BarChartWrapperProps {
    data: ChartData[];
    dataKey: string;
    categoryKey: string;
    layout?: 'horizontal' | 'vertical';
}

export function BarChartWrapper({ data, dataKey, categoryKey, layout = 'vertical' }: BarChartWrapperProps) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout={layout}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                {layout === 'vertical' ? (
                    <>
                        <XAxis type="number" stroke="#64748b" fontSize={12} />
                        <YAxis dataKey={categoryKey} type="category" stroke="#64748b" fontSize={12} width={80} />
                    </>
                ) : (
                    <>
                        <XAxis dataKey={categoryKey} stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} />
                    </>
                )}
                <Tooltip
                    contentStyle={{
                        background: 'rgba(255,255,255,0.9)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    }}
                />
                <Bar dataKey={dataKey} fill="#10b981" radius={layout === 'vertical' ? [0, 8, 8, 0] : [8, 8, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}
