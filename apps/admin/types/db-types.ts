// types/db-types.ts

// Sesuai dengan tabel 'sections'
export type Section = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

// Sesuai dengan tabel 'geojson_files'
export type GeojsonFile = {
  id: string;
  section_id: string;
  name: string;
  file_path: string;
  original_filename: string | null;
  metadata: Record<string, any> | null; // JSON
  created_at: string;
  updated_at: string;
};

// Sesuai dengan tabel 'road_segments'
export type RoadSegment = {
  id: string;
  geojson_file_id: string;
  segment_index: number;
  geometry: Record<string, any>; // JSON
  no_ruas: string | null;
  nama_ruas: string;
  titik_pangkal: string | null;
  titik_ujung: string | null;
  masuk_kecamatan: string | null;
  jenis_konstruksi: string | null;
  panjang_km: number | null;
  lebar_m: number | null;
  klasifikasi: string | null;
  kondisi_m: string | null;
  kondisi_persen: number | null;
  kode_status: string | null;
  tahun: number | null;
  properties: Record<string, any> | null; // JSON
  created_at: string;
  updated_at: string;
};

// Sesuai dengan tabel 'attachments'
export type Attachment = {
  id: string;
  attachable_type: 'road_segment' | 'geojson_file' | 'section';
  attachable_id: string;
  type: 'image' | 'document' | 'video' | 'other';
  file_path: string;
  original_name: string;
  file_size: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  description: string | null;
  metadata: Record<string, any> | null; // JSON
  created_at: string;
  updated_at: string;
};