type StravaEvent = {
  aspect_type: 'create' | 'update' | 'delete';
  object_type: 'activity';
  object_id: number;
  owner_id: number;
};

type StravaStats = {
  totalLoad: number;
  zoneDistribution: {
    z1: number;
    z2: number;
    z3: number;
    z4: number;
    z5: number;
  };
};

type StravaMap = {
  id: string;
  polyline: string;
  summary_polyline: string;
};

type StravaSplit = {
  distance: number;
  elapsed_time: number;
  moving_time: number;

  average_speed: number;
  average_grade_adjusted_speed: number;

  elevation_difference: number;

  average_heartrate?: number;

  split: number;
  pace_zone: number;
};

type StravaLap = {
  id: number;

  name: string;

  elapsed_time: number;
  moving_time: number;

  start_date: string;
  start_date_local: string;

  distance: number;

  average_speed: number;
  max_speed: number;

  total_elevation_gain: number;

  average_watts?: number;
  average_heartrate?: number;
  max_heartrate?: number;
};

type StravaGear = {
  id: string;
  name: string;
  nickname?: string;

  distance: number;
  converted_distance: number;

  primary: boolean;
  retired: boolean;
};

type StravaActivity = {
  id: number;
  name: string;

  distance: number;
  moving_time: number;
  elapsed_time: number;

  total_elevation_gain: number;

  type: string;
  sport_type: string;

  start_date: string;
  start_date_local: string;
  timezone: string;

  average_speed: number;
  max_speed: number;

  average_heartrate?: number;
  max_heartrate?: number;

  average_watts?: number;
  kilojoules?: number;

  calories?: number;
  suffer_score?: number;

  description?: string;

  map: StravaMap;

  splits_metric?: StravaSplit[];
  splits_standard?: StravaSplit[];

  laps?: StravaLap[];

  gear?: StravaGear;

  start_latlng?: [number, number];
  end_latlng?: [number, number];

  has_heartrate: boolean;

  visibility: string;
  private: boolean;
};

type Goal = {
  type: 'distance' | 'event';
  targetDistance?: number; // e.g. 200km/week
  eventDate?: Date;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
};

type CoachInput = {
  currentLoad: number;
  targetLoad: number;
  fatigue: number;
  plan: any[];
  goal: any;
};
