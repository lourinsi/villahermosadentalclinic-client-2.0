"use client";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Appointment } from "../hooks/useAppointments";
import { getAppointmentTypeName } from "../lib/appointment-types";

interface VisitStatisticsProps {
  appointments: Appointment[];
  filteredAppointments: Appointment[];
  colorPalette: string[];
  viewMode?: "day" | "week" | "month";
}

export function VisitStatistics({
  appointments,
  filteredAppointments,
  colorPalette,
  viewMode
}: VisitStatisticsProps) {
  const appointmentsToAnalyze = filteredAppointments.length === 0 ? appointments : filteredAppointments;

  const getDescription = () => {
    if (filteredAppointments.length === 0) return "All Time";
    switch (viewMode) {
      case "day": return "Today";
      case "week": return "This Week";
      case "month": return "This Month";
      default: return "All Time";
    }
  };

  if (appointmentsToAnalyze.length === 0) {
    return (
      <Card className="border border-gray-100 shadow-sm bg-white rounded-3xl flex flex-col h-full">
        <CardHeader className="border-b border-gray-50 p-8">
          <CardTitle className="text-xl font-black text-gray-900 tracking-tight">Visit Statistics</CardTitle>
          <p className="text-sm font-medium text-gray-500 mt-1">{getDescription()}</p>
        </CardHeader>
        <CardContent className="p-8 flex-1 flex items-center justify-center">
          <div className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">No data available</div>
        </CardContent>
      </Card>
    );
  }

  const typeCounts = appointmentsToAnalyze.reduce<Record<string, number>>((acc, apt: Appointment) => {
    const key = getAppointmentTypeName(apt.type, apt.customType);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const total = Object.values(typeCounts).reduce((s: number, v: number) => s + v, 0) || 1;
  const chartData = Object.keys(typeCounts).map((name, idx) => ({
    name,
    value: Math.round((typeCounts[name] / total) * 100),
    color: colorPalette[idx % colorPalette.length]
  }));

  return (
    <Card className="border border-gray-100 shadow-sm bg-white rounded-3xl flex flex-col h-full">
      <CardHeader className="border-b border-gray-50 p-8">
        <CardTitle className="text-xl font-black text-gray-900 tracking-tight">Visit Statistics</CardTitle>
        <p className="text-sm font-medium text-gray-500 mt-1">{getDescription()}</p>
      </CardHeader>
      <CardContent className="p-8 flex-1 flex flex-col justify-between">
        <div className="space-y-8 h-full flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px'}}
                  itemStyle={{fontSize: '12px', fontWeight: '900'}}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 max-h-[180px] overflow-y-auto pr-2 scrollbar-hide">
            {chartData.map((type, index) => (
              <div key={index} className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center space-x-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: type.color }} />
                  <span className="text-gray-600">{type.name}</span>
                </div>
                <span className="text-gray-900 font-black">{type.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
