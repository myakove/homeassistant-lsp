/**
 * Home Assistant Type Definitions
 */

export interface Entity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface Service {
  domain: string;
  service: string;
  name?: string;
  description?: string;
  fields?: Record<string, any>;
}

export interface Services {
  [domain: string]: {
    [service: string]: Service;
  };
}

export interface Config {
  latitude: number;
  longitude: number;
  elevation: number;
  unit_system: {
    length: string;
    mass: string;
    temperature: string;
    volume: string;
  };
  location_name: string;
  time_zone: string;
  version: string;
}

export interface Dashboard {
  id: string;
  url_path: string;
  title: string;
  icon: string | null;
  require_admin: boolean;
  show_in_sidebar: boolean;
  mode: 'storage' | 'yaml';
}

export interface DashboardConfig {
  views: any[];
  title?: string;
  [key: string]: any;
}
