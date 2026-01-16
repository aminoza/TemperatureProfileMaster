
export interface DataPoint {
  time: number; // Time in Hours
  temperature: number; // Temperature in Celsius
}

export type StepType = 'Start' | 'RAMP' | 'HOLD' | 'OFF' | 'END';

export interface ProfileStep {
  id: string;
  type: StepType;
  objective?: string; // Purpose/Objective of the step
  targetTemp: number;
  settingTemp?: number;
  criteria?: string; // Acceptance criteria or limits
  position: string; // e.g. "Inlet", "Center"
  duration: number; // in hours
  notes: string;
}

export interface TemperatureProfile {
  id?: string;
  name: string;
  description: string;
  startDate: string; // ISO string for the profile start time
  steps: ProfileStep[];
  // derived points for backward compatibility or simple charting
  points?: DataPoint[]; 
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProfileAnalysis {
  summary: string;
  recommendations: string[];
  maxTemp: number;
  maxSlope: number;
}
