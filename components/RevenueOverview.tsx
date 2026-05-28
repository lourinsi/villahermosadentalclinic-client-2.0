"use client";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface RevenueOverviewProps {
  portal: "admin" | "doctor" | "patient";
  revenueData: any[];
}

export function RevenueOverview({ portal, revenueData }: RevenueOverviewProps) {
  if (portal === "patient") return null;

  return (
    <Card className="border border-gray-100 shadow-sm overflow-hidden bg-white rounded-3xl">
      <CardHeader className="flex flex-row items-center justify-between border-b border-gray-50 p-8">
        <div>
          <CardTitle className="text-xl font-black text-gray-900 tracking-tight">
            {portal === "admin" ? "Revenue Overview" : "Appointment Trends"}
          </CardTitle>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Monthly statistics for clinic growth
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold border border-emerald-100">
            <TrendingUp className="h-3 w-3" />
            <span>+12.5% Growth</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={revenueData}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.08}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}}
              tickFormatter={(value) => `₱${value/1000}k`}
            />
            <Tooltip 
              contentStyle={{borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', padding: '12px'}}
              itemStyle={{fontSize: '12px', fontWeight: 'bold'}}
              labelStyle={{fontSize: '10px', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '800'}}
              formatter={(value, name) => [
                name === 'revenue' ? `₱${Number(value).toLocaleString()}` : value,
                name === 'revenue' ? 'Revenue' : 'Appointments'
              ]} 
            />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="#3b82f6" 
              strokeWidth={4}
              fillOpacity={1} 
              fill="url(#colorRevenue)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
