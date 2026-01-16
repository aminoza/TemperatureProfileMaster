import React from 'react';
import { TemperatureProfile } from '../types';
import { Trash2, Calendar, Activity, Clock } from 'lucide-react';
import ProfileChart from './ProfileChart';

interface ProfileCardProps {
  profile: TemperatureProfile;
  onEdit: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ profile, onEdit, onDelete }) => {
  // Safe access to steps/points for visualization
  const points = profile.points || [];
  const maxTemp = points.length > 0 ? Math.max(...points.map(p => p.temperature)) : 0;
  const duration = points.length > 0 ? Math.max(...points.map(p => p.time)) : 0;
  
  // Calculate total steps
  const stepCount = profile.steps ? profile.steps.length : (points.length || 0);

  // Calculate steps for chart visualization (background colors)
  const stepsForChart = React.useMemo(() => {
    if (!profile.steps) return undefined;
    let cumulative = 0;
    return profile.steps.map(s => {
       // Match logic: Start/End/Off often have 0 duration in chart progression unless specified
       const duration = (s.type === 'Start' || s.type === 'END' || s.type === 'START') ? 0 : (Number(s.duration) || 0);
       const start = cumulative;
       cumulative += duration;
       return { ...s, startHours: start, endHours: cumulative };
    });
  }, [profile.steps]);

  return (
    <div 
      onClick={onEdit}
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md hover:border-blue-300 transition-all group cursor-pointer"
    >
      <div className="h-32 bg-gray-50 border-b border-gray-100 relative">
         {/* Mini Chart Preview */}
         <div className="absolute inset-0 opacity-100 pointer-events-none w-full h-full">
            <ProfileChart data={points} steps={stepsForChart} height="100%" minimal />
         </div>
      </div>
      
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-gray-900 line-clamp-1 text-xl group-hover:text-blue-600 transition-colors" title={profile.name}>
              {profile.name}
            </h3>
        </div>
        
        <p className="text-base text-gray-500 mb-4 line-clamp-2 min-h-[48px]">
          {profile.description || "No description provided."}
        </p>

        <div className="flex items-center gap-3 text-sm text-gray-500 mb-4 font-medium flex-wrap">
          <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded">
            <Activity className="w-4 h-4" />
            Max: {maxTemp}°C
          </div>
          <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
            <Clock className="w-4 h-4" />
            {duration}h
          </div>
          <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
            <span className="font-bold">{stepCount}</span> Steps
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
            className="flex items-center justify-center p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Profile"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;