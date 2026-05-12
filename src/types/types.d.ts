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

type Goal = {
  type: 'distance' | 'event';
  targetDistance?: number; // e.g. 200km/week
  eventDate?: Date;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
};
