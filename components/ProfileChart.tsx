import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea
} from 'recharts';
import { DataPoint } from '../types';

interface ProfileChartProps {
  data: DataPoint[];
  steps?: any[]; // Accepts calculated steps with startHours/endHours
  height?: number | string;
  minimal?: boolean;
}

export const STEP_COLORS = [
  '#2563eb', // blue-600
  '#dc2626', // red-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#db2777', // pink-600
  '#0891b2', // cyan-600
  '#ea580c', // orange-600
  '#4f46e5', // indigo-600
  '#65a30d', // lime-600
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg z-50">
        <p className="font-semibold text-gray-700 text-sm">{`Time: ${Number(label).toFixed(2)}h`}</p>
        <p className="text-blue-600 text-sm">{`Temp: ${payload[0].value}°C`}</p>
      </div>
    );
  }
  return null;
};

const CustomizedLabel = (props: any) => {
  const { x, y, value } = props;
  return (
    <text 
      x={x} 
      y={y} 
      dy={-15} 
      fill="#374151" 
      fontSize={14} 
      fontWeight={600} 
      textAnchor="middle"
      style={{ pointerEvents: 'none' }}
    >
      {value}°C
    </text>
  );
};

const ProfileChart: React.FC<ProfileChartProps> = ({ data, steps, height = 300, minimal = false }) => {
  if (!data || data.length === 0) {
    return (
      <div 
        className={`w-full min-w-0 ${minimal ? '' : 'bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg'} flex items-center justify-center text-gray-400 text-lg`}
        style={{ height }}
      >
        {!minimal && "No data to visualize"}
      </div>
    );
  }

  // Calculate total duration for gradient offsets
  const totalDuration = data.length > 0 ? data[data.length - 1].time : 0;

  return (
    <div 
      className={`w-full min-w-0 ${minimal ? '' : 'bg-white rounded-lg p-2'} box-border relative overflow-hidden`} 
      style={{ height, width: '100%' }}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart
          data={data}
          margin={minimal ? { top: 5, right: 0, left: 0, bottom: 5 } : {
            top: 25, 
            right: 30,
            left: 0,
            bottom: 20,
          }}
        >
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              {steps && totalDuration > 0 && steps.map((step, index) => {
                // Skip steps with no duration contribution for the gradient 
                // (e.g. initial start point if it has 0 duration)
                if (step.startHours === step.endHours) return null;

                const startPct = (step.startHours / totalDuration) * 100;
                const endPct = (step.endHours / totalDuration) * 100;
                // Color by Index
                const color = STEP_COLORS[index % STEP_COLORS.length];

                return (
                  <React.Fragment key={step.id || index}>
                    <stop offset={`${startPct}%`} stopColor={color} />
                    <stop offset={`${endPct}%`} stopColor={color} />
                  </React.Fragment>
                );
              })}
              {/* Fallback if no steps or duration is 0 */}
              {(!steps || totalDuration === 0) && <stop offset="0%" stopColor="#3b82f6" />}
            </linearGradient>
          </defs>

          {!minimal && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          
          {/* Background Areas for Steps */}
          {steps && steps.map((step, index) => {
             // Only render areas for steps that have duration
             if (step.startHours === undefined || step.endHours === undefined) return null;
             if (step.startHours === step.endHours) return null;

             const stepColor = STEP_COLORS[index % STEP_COLORS.length];

             return (
               <ReferenceArea
                 key={`area-${step.id || index}`}
                 x1={step.startHours}
                 x2={step.endHours}
                 fill={stepColor}
                 fillOpacity={0.15}
                 strokeOpacity={0}
                 label={minimal ? undefined : { 
                    value: `Step ${index + 1}`, 
                    position: 'insideTop', 
                    fill: stepColor, 
                    fontSize: 14, 
                    fontWeight: 'bold',
                    offset: 10
                 }}
               />
             );
          })}

          {minimal ? (
             <>
               <XAxis dataKey="time" type="number" hide domain={['dataMin', 'dataMax']} />
               <YAxis domain={['auto', 'auto']} hide />
             </>
          ) : (
             <>
                <XAxis 
                  dataKey="time" 
                  type="number" 
                  label={{ value: 'Time (Hours)', position: 'insideBottomRight', offset: -5, fontSize: 14 }} 
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontSize: 14, fill: '#6b7280' }}
                />
                <YAxis 
                  label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', fontSize: 14 }} 
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 14, fill: '#6b7280' }}
                />
                <Tooltip content={<CustomTooltip />} />
             </>
          )}
          
          <Line
            type="monotone" 
            dataKey="temperature"
            stroke="url(#lineGradient)"
            strokeWidth={minimal ? 2 : 3}
            dot={minimal ? false : { r: 4, strokeWidth: 2, fill: '#fff', stroke: '#9ca3af' }}
            activeDot={minimal ? false : { r: 6, fill: '#3b82f6', stroke: 'none' }}
            animationDuration={500}
            label={minimal ? undefined : <CustomizedLabel />}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProfileChart;