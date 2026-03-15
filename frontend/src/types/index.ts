export type Role = 'officer' | 'traveller' | 'ngo' | 'mea';
export type OfficerRole = 'border_officer' | 'command_officer';

export interface AuthUser {
  token: string;
  role: Role;
  name: string;
  user_id: string;
  officer_role?: OfficerRole;
}

export interface VerificationResult {
  check: string;
  passed: boolean;
  detail: string;
}

export interface BorderId {
  border_id: string;
  integrity_hash: string;
  qr_code_base64: string;
  qr_data: string;
  valid_until: string;
}

export interface Traveller {
  passport_number: string;
  name: string;
  nationality: string;
  dob: string;
  passport_expiry: string;
  visa_type: string;
  checkpoint: string;
  flag: 'green' | 'black' | 'red' | 'amber';
  verification_status: string;
  fraud_type?: string;
  border_id?: BorderId;
}

export interface Refugee {
  temp_id: string;
  name: string;
  country_of_origin: string;
  dob: string;
  age: number;
  entry_checkpoint: string;
  assigned_ngo: string;
  criminal_flag: boolean;
  status: string;
  registered_at: string;
  health_condition: string;
  family_size: number;
}

export interface NGO {
  name: string;
  ngo_id: string;
  headquarters: string;
  capacity: number;
  refugee_count?: number;
  flagged_count?: number;
  pending_requests?: number;
  available_slots?: number;
  specialization?: string;
}

export interface NGORequest {
  id: number;
  refugee_temp_id: string;
  refugee_name: string;
  ngo_name: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  requested_at: string;
  responded_at?: string;
  notes?: string;
  attempt_number: number;
  country_of_origin?: string;
  age?: number;
  health_condition?: string;
  family_size?: number;
  criminal_flag?: boolean;
  dob?: string;
  entry_checkpoint?: string;
}

export interface ScanLog {
  border_id: string;
  traveller_name?: string;
  officer_id: string;
  result: string;
  flag: string;
  timestamp: string;
}

export interface DashboardData {
  cleared: number;
  flagged: number;
  pending: number;
  refugees: number;
  ngo_pending: number;
  recent: Traveller[];
}

export interface BorderStats {
  total_travellers_today: number;
  suspicious_travellers: number;
  refugees_registered: number;
  ngo_requests_pending: number;
  monthly_refugee_arrivals: { month: string; count: number }[];
  verification_distribution: { label: string; count: number }[];
}

export interface EmergencyRegion {
  id: number;
  region_name: string;
  is_emergency: number;
  declared_by?: string;
  declared_at?: string;
  resolved_at?: string;
  notes?: string;
}

// Offline sync types
export interface OfflineScanLog {
  border_id: string;
  passport_number?: string;
  traveller_name: string;
  result: string;
  flag: string;
  timestamp: string;
}

export interface OfflineRefugee extends Omit<Refugee, 'criminal_flag'> {
  criminal_flag: boolean;
  biometric_notes?: string;
}
